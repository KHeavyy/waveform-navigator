/**
 * ITU-R BS.1770-4 integrated loudness (LUFS) measurement.
 *
 * Pure, directly testable functions — no DOM / Worker / React dependency.
 * Channel data is filtered and block mean-squares are accumulated in a single
 * pass per channel (no materialised K-weighted copy of the signal).
 */

/** Result of an integrated-loudness measurement. */
export interface LoudnessResult {
	/** BS.1770 integrated (gated) loudness in LUFS. -Infinity when nothing passes the gates. */
	integratedLufs: number;
	/** Sample rate of the decoded buffer, in Hz. */
	sampleRate: number;
	/** Channel count of the decoded buffer. */
	channels: number;
}

/** Direct-form I / II transposed biquad coefficients with a0 = 1. */
export interface BiquadCoeffs {
	b0: number;
	b1: number;
	b2: number;
	a1: number;
	a2: number;
}

export interface KWeightingCoeffs {
	shelf: BiquadCoeffs;
	highpass: BiquadCoeffs;
}

const ABSOLUTE_GATE_LUFS = -70.0;
const RELATIVE_GATE_OFFSET_LU = 10.0;
const LOUDNESS_OFFSET = -0.691;
const BLOCK_DURATION_S = 0.4;
const STEP_DURATION_S = 0.1;
/** Surround channel weight ≈ 10^(1.5/10). */
const SURROUND_WEIGHT = 1.41;

/**
 * Derive BS.1770 K-weighting biquad coefficients for an arbitrary sample rate.
 * Do not hardcode the 48 kHz published table — that silently mismeasures 44.1 kHz.
 *
 * @throws {RangeError} if `sampleRate` is not a finite number greater than 0.
 */
export function computeKWeightingCoefficients(
	sampleRate: number
): KWeightingCoeffs {
	if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
		throw new RangeError(
			`computeKWeightingCoefficients: sampleRate must be a finite number > 0 (got ${sampleRate})`
		);
	}

	const fs = sampleRate;

	// Stage 1 — high-shelf ("head effect")
	const shelfF0 = 1681.974450955533;
	const shelfG = 3.999843853973347;
	const shelfQ = 0.7071752369554196;
	const shelfK = Math.tan((Math.PI * shelfF0) / fs);
	const Vh = Math.pow(10, shelfG / 20);
	const Vb = Math.pow(Vh, 0.4996667741545416);
	const shelfA0 = 1 + shelfK / shelfQ + shelfK * shelfK;

	const shelf: BiquadCoeffs = {
		b0: (Vh + (Vb * shelfK) / shelfQ + shelfK * shelfK) / shelfA0,
		b1: (2 * (shelfK * shelfK - Vh)) / shelfA0,
		b2: (Vh - (Vb * shelfK) / shelfQ + shelfK * shelfK) / shelfA0,
		a1: (2 * (shelfK * shelfK - 1)) / shelfA0,
		a2: (1 - shelfK / shelfQ + shelfK * shelfK) / shelfA0,
	};

	// Stage 2 — RLB high-pass. Note: b coeffs are NOT divided by a0_.
	const hpF0 = 38.13547087602444;
	const hpQ = 0.5003270373238773;
	const hpK = Math.tan((Math.PI * hpF0) / fs);
	const hpA0 = 1 + hpK / hpQ + hpK * hpK;

	const highpass: BiquadCoeffs = {
		b0: 1.0,
		b1: -2.0,
		b2: 1.0,
		a1: (2 * (hpK * hpK - 1)) / hpA0,
		a2: (1 - hpK / hpQ + hpK * hpK) / hpA0,
	};

	return { shelf, highpass };
}

/**
 * BS.1770 channel weighting for Web Audio channel layouts.
 * L/R/C = 1.0, surrounds = 1.41, LFE (index 3 in 5.1/7.1) = 0.
 */
export function channelWeight(
	channelIndex: number,
	channelCount: number
): number {
	if (channelCount <= 3) {
		return 1.0;
	}

	if (channelCount === 4) {
		// L, R, SL, SR
		return channelIndex < 2 ? 1.0 : SURROUND_WEIGHT;
	}

	if (channelCount === 5) {
		// L, R, C, SL, SR
		return channelIndex < 3 ? 1.0 : SURROUND_WEIGHT;
	}

	if (channelCount === 6 || channelCount === 8) {
		// 5.1: L, R, C, LFE, SL, SR
		// 7.1: L, R, C, LFE, SL, SR, BL, BR
		if (channelIndex === 3) {
			return 0;
		}

		return channelIndex < 3 ? 1.0 : SURROUND_WEIGHT;
	}

	// Unknown layout — treat every channel equally.
	return 1.0;
}

interface BiquadState {
	x1: number;
	x2: number;
	y1: number;
	y2: number;
}

function createBiquadState(): BiquadState {
	return { x1: 0, x2: 0, y1: 0, y2: 0 };
}

function applyBiquad(
	coeffs: BiquadCoeffs,
	state: BiquadState,
	x: number
): number {
	const y =
		coeffs.b0 * x +
		coeffs.b1 * state.x1 +
		coeffs.b2 * state.x2 -
		coeffs.a1 * state.y1 -
		coeffs.a2 * state.y2;

	state.x2 = state.x1;
	state.x1 = x;
	state.y2 = state.y1;
	state.y1 = y;

	return y;
}

function blockLoudness(weightedMeanSquare: number): number {
	if (weightedMeanSquare <= 0 || !Number.isFinite(weightedMeanSquare)) {
		return Number.NEGATIVE_INFINITY;
	}

	return LOUDNESS_OFFSET + 10 * Math.log10(weightedMeanSquare);
}

function weightedMeanSquareSum(
	meanSquares: Float64Array[],
	blockIndex: number,
	weights: number[]
): number {
	let sum = 0;
	for (let c = 0; c < meanSquares.length; c++) {
		const w = weights[c];
		if (w === 0) {
			continue;
		}

		sum += w * meanSquares[c][blockIndex];
	}

	return sum;
}

/**
 * Accumulate per-block mean-square energy for one channel while K-weighting
 * in a single forward pass. Writes into `out` (length = numBlocks).
 */
function accumulateChannelBlockMeanSquares(
	channel: Float32Array,
	coeffs: KWeightingCoeffs,
	blockSamples: number,
	stepSamples: number,
	numBlocks: number,
	out: Float64Array
): void {
	const shelfState = createBiquadState();
	const hpState = createBiquadState();
	out.fill(0);

	const N = channel.length;
	const invBlock = 1 / blockSamples;

	for (let n = 0; n < N; n++) {
		const shelved = applyBiquad(coeffs.shelf, shelfState, channel[n]);
		const y = applyBiquad(coeffs.highpass, hpState, shelved);
		const y2 = y * y;

		// Blocks whose sample range contains n:
		// start = j * stepSamples, covering [start, start + blockSamples)
		const first = Math.max(0, Math.ceil((n - blockSamples + 1) / stepSamples));
		const last = Math.min(numBlocks - 1, Math.floor(n / stepSamples));

		for (let j = first; j <= last; j++) {
			out[j] += y2;
		}
	}

	for (let j = 0; j < numBlocks; j++) {
		out[j] *= invBlock;
	}
}

function gateIntegratedLoudness(
	meanSquares: Float64Array[],
	weights: number[],
	numBlocks: number
): number {
	if (numBlocks === 0) {
		return Number.NEGATIVE_INFINITY;
	}

	const channelCount = meanSquares.length;

	// Absolute gate: keep blocks where l[j] > -70 LUFS
	const absoluteSurvivors: number[] = [];
	for (let j = 0; j < numBlocks; j++) {
		const l = blockLoudness(weightedMeanSquareSum(meanSquares, j, weights));
		if (l > ABSOLUTE_GATE_LUFS) {
			absoluteSurvivors.push(j);
		}
	}

	if (absoluteSurvivors.length === 0) {
		return Number.NEGATIVE_INFINITY;
	}

	// Relative gate threshold from mean of z over absolute survivors
	const absMeanZ = new Float64Array(channelCount);
	for (const j of absoluteSurvivors) {
		for (let c = 0; c < channelCount; c++) {
			absMeanZ[c] += meanSquares[c][j];
		}
	}
	const absCount = absoluteSurvivors.length;
	for (let c = 0; c < channelCount; c++) {
		absMeanZ[c] /= absCount;
	}

	let absWeighted = 0;
	for (let c = 0; c < channelCount; c++) {
		absWeighted += weights[c] * absMeanZ[c];
	}
	const gammaR = blockLoudness(absWeighted) - RELATIVE_GATE_OFFSET_LU;

	// Relative gate: keep absolute survivors where l[j] > Γr
	const relativeSurvivors: number[] = [];
	for (const j of absoluteSurvivors) {
		const l = blockLoudness(weightedMeanSquareSum(meanSquares, j, weights));
		if (l > gammaR) {
			relativeSurvivors.push(j);
		}
	}

	if (relativeSurvivors.length === 0) {
		return Number.NEGATIVE_INFINITY;
	}

	const finalMeanZ = new Float64Array(channelCount);
	for (const j of relativeSurvivors) {
		for (let c = 0; c < channelCount; c++) {
			finalMeanZ[c] += meanSquares[c][j];
		}
	}
	const relCount = relativeSurvivors.length;
	for (let c = 0; c < channelCount; c++) {
		finalMeanZ[c] /= relCount;
	}

	let finalWeighted = 0;
	for (let c = 0; c < channelCount; c++) {
		finalWeighted += weights[c] * finalMeanZ[c];
	}

	const result = blockLoudness(finalWeighted);
	return Number.isFinite(result) ? result : Number.NEGATIVE_INFINITY;
}

function emptyResult(sampleRate: number, channels: number): LoudnessResult {
	return {
		integratedLufs: Number.NEGATIVE_INFINITY,
		sampleRate,
		channels,
	};
}

/**
 * Synchronous BS.1770 integrated loudness. Prefer
 * {@link computeIntegratedLoudnessAsync} on the main thread for long files.
 */
export function computeIntegratedLoudness(
	channels: Float32Array[],
	sampleRate: number
): LoudnessResult {
	const channelCount = channels.length;
	if (channelCount === 0 || sampleRate <= 0) {
		return emptyResult(sampleRate, channelCount);
	}

	const numSamples = channels[0].length;
	const blockSamples = Math.round(BLOCK_DURATION_S * sampleRate);
	const stepSamples = Math.round(STEP_DURATION_S * sampleRate);

	if (numSamples < blockSamples || blockSamples <= 0 || stepSamples <= 0) {
		return emptyResult(sampleRate, channelCount);
	}

	const numBlocks = Math.floor((numSamples - blockSamples) / stepSamples) + 1;
	if (numBlocks <= 0) {
		return emptyResult(sampleRate, channelCount);
	}

	const coeffs = computeKWeightingCoefficients(sampleRate);
	const weights = Array.from({ length: channelCount }, (_, i) =>
		channelWeight(i, channelCount)
	);
	const meanSquares: Float64Array[] = [];

	for (let c = 0; c < channelCount; c++) {
		const out = new Float64Array(numBlocks);
		accumulateChannelBlockMeanSquares(
			channels[c],
			coeffs,
			blockSamples,
			stepSamples,
			numBlocks,
			out
		);
		meanSquares.push(out);
	}

	return {
		integratedLufs: gateIntegratedLoudness(meanSquares, weights, numBlocks),
		sampleRate,
		channels: channelCount,
	};
}

export interface LoudnessAsyncOptions {
	/** Abort an in-flight measurement (e.g. when the audio source changes). */
	signal?: AbortSignal;
	/**
	 * Maximum contiguous main-thread work per slice, in milliseconds.
	 * @default 40
	 */
	maxSliceMs?: number;
	/** Called with 0–1 progress while filtering. */
	onProgress?: (progress: number) => void;
}

function yieldToEventLoop(): Promise<void> {
	return new Promise((resolve) => {
		if (typeof setTimeout === 'function') {
			setTimeout(resolve, 0);
		} else {
			resolve();
		}
	});
}

/**
 * Time-sliced integrated loudness. Yields to the event loop so a 6-minute
 * stereo file never blocks the main thread for longer than ~`maxSliceMs`.
 */
export async function computeIntegratedLoudnessAsync(
	channels: Float32Array[],
	sampleRate: number,
	options: LoudnessAsyncOptions = {}
): Promise<LoudnessResult> {
	const { signal, maxSliceMs = 40, onProgress } = options;
	const channelCount = channels.length;

	if (channelCount === 0 || sampleRate <= 0) {
		return emptyResult(sampleRate, channelCount);
	}

	const numSamples = channels[0].length;
	const blockSamples = Math.round(BLOCK_DURATION_S * sampleRate);
	const stepSamples = Math.round(STEP_DURATION_S * sampleRate);

	if (numSamples < blockSamples || blockSamples <= 0 || stepSamples <= 0) {
		return emptyResult(sampleRate, channelCount);
	}

	const numBlocks = Math.floor((numSamples - blockSamples) / stepSamples) + 1;
	if (numBlocks <= 0) {
		return emptyResult(sampleRate, channelCount);
	}

	const coeffs = computeKWeightingCoefficients(sampleRate);
	const weights = Array.from({ length: channelCount }, (_, i) =>
		channelWeight(i, channelCount)
	);
	const meanSquares: Float64Array[] = [];

	const totalWork = channelCount * numSamples;
	let workDone = 0;

	for (let c = 0; c < channelCount; c++) {
		if (signal?.aborted) {
			const err = new Error('Loudness computation aborted');
			err.name = 'AbortError';
			throw err;
		}

		const channel = channels[c];
		const sums = new Float64Array(numBlocks);
		const shelfState = createBiquadState();
		const hpState = createBiquadState();
		const invBlock = 1 / blockSamples;

		let n = 0;
		while (n < numSamples) {
			if (signal?.aborted) {
				const err = new Error('Loudness computation aborted');
				err.name = 'AbortError';
				throw err;
			}

			const sliceStart =
				typeof performance !== 'undefined' ? performance.now() : Date.now();

			while (n < numSamples) {
				const shelved = applyBiquad(coeffs.shelf, shelfState, channel[n]);
				const y = applyBiquad(coeffs.highpass, hpState, shelved);
				const y2 = y * y;

				const first = Math.max(0, Math.ceil((n - blockSamples + 1) / stepSamples));
				const last = Math.min(numBlocks - 1, Math.floor(n / stepSamples));

				for (let j = first; j <= last; j++) {
					sums[j] += y2;
				}

				n++;
				workDone++;

				// Check wall clock every 4k samples to keep the check cheap.
				if ((n & 4095) === 0) {
					const now =
						typeof performance !== 'undefined' ? performance.now() : Date.now();
					if (now - sliceStart >= maxSliceMs) {
						break;
					}
				}
			}

			onProgress?.(workDone / totalWork);

			if (n < numSamples) {
				await yieldToEventLoop();
			}
		}

		for (let j = 0; j < numBlocks; j++) {
			sums[j] *= invBlock;
		}
		meanSquares.push(sums);
	}

	return {
		integratedLufs: gateIntegratedLoudness(meanSquares, weights, numBlocks),
		sampleRate,
		channels: channelCount,
	};
}
