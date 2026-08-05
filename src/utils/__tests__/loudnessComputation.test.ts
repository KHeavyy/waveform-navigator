import { describe, it, expect } from 'vitest';
import {
	computeKWeightingCoefficients,
	computeIntegratedLoudness,
	channelWeight,
} from '../loudnessComputation';

/** BS.1770-4 published coefficients at 48 kHz. */
const TABLE_48K = {
	shelf: {
		b0: 1.53512485958697,
		b1: -2.69169618940638,
		b2: 1.19839281085285,
		a1: -1.69065929318241,
		a2: 0.73248077421585,
	},
	highpass: {
		b0: 1.0,
		b1: -2.0,
		b2: 1.0,
		a1: -1.99004745483398,
		a2: 0.99007225036621,
	},
};

function makeSine(
	sampleRate: number,
	durationSec: number,
	freqHz: number,
	amplitude = 0.5
): Float32Array {
	const N = Math.floor(sampleRate * durationSec);
	const out = new Float32Array(N);
	const w = (2 * Math.PI * freqHz) / sampleRate;
	for (let i = 0; i < N; i++) {
		out[i] = amplitude * Math.sin(w * i);
	}
	return out;
}

function scaleChannel(channel: Float32Array, factor: number): Float32Array {
	const out = new Float32Array(channel.length);
	for (let i = 0; i < channel.length; i++) {
		out[i] = channel[i] * factor;
	}
	return out;
}

function concatChannels(parts: Float32Array[]): Float32Array {
	let total = 0;
	for (const p of parts) {
		total += p.length;
	}
	const out = new Float32Array(total);
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.length;
	}
	return out;
}

describe('computeKWeightingCoefficients', () => {
	it('matches the BS.1770 table at 48 kHz within 1e-6', () => {
		const { shelf, highpass } = computeKWeightingCoefficients(48000);

		expect(shelf.b0).toBeCloseTo(TABLE_48K.shelf.b0, 6);
		expect(shelf.b1).toBeCloseTo(TABLE_48K.shelf.b1, 6);
		expect(shelf.b2).toBeCloseTo(TABLE_48K.shelf.b2, 6);
		expect(shelf.a1).toBeCloseTo(TABLE_48K.shelf.a1, 6);
		expect(shelf.a2).toBeCloseTo(TABLE_48K.shelf.a2, 6);

		expect(highpass.b0).toBeCloseTo(TABLE_48K.highpass.b0, 6);
		expect(highpass.b1).toBeCloseTo(TABLE_48K.highpass.b1, 6);
		expect(highpass.b2).toBeCloseTo(TABLE_48K.highpass.b2, 6);
		expect(highpass.a1).toBeCloseTo(TABLE_48K.highpass.a1, 6);
		expect(highpass.a2).toBeCloseTo(TABLE_48K.highpass.a2, 6);
	});

	it('derives different coefficients at 44.1 kHz (not hardcoded 48 kHz)', () => {
		const at48 = computeKWeightingCoefficients(48000);
		const at441 = computeKWeightingCoefficients(44100);

		expect(Math.abs(at48.shelf.b0 - at441.shelf.b0)).toBeGreaterThan(1e-4);
		expect(Math.abs(at48.highpass.a1 - at441.highpass.a1)).toBeGreaterThan(1e-4);
	});

	it('rejects non-positive or non-finite sample rates', () => {
		expect(() => computeKWeightingCoefficients(0)).toThrow(RangeError);
		expect(() => computeKWeightingCoefficients(-48000)).toThrow(RangeError);
		expect(() => computeKWeightingCoefficients(Number.NaN)).toThrow(RangeError);
		expect(() => computeKWeightingCoefficients(Number.POSITIVE_INFINITY)).toThrow(
			RangeError
		);
	});
});

describe('channelWeight', () => {
	it('weights mono and stereo as 1.0', () => {
		expect(channelWeight(0, 1)).toBe(1);
		expect(channelWeight(0, 2)).toBe(1);
		expect(channelWeight(1, 2)).toBe(1);
	});

	it('excludes LFE (index 3) in 5.1 and weights surrounds at 1.41', () => {
		expect(channelWeight(0, 6)).toBe(1);
		expect(channelWeight(1, 6)).toBe(1);
		expect(channelWeight(2, 6)).toBe(1);
		expect(channelWeight(3, 6)).toBe(0);
		expect(channelWeight(4, 6)).toBeCloseTo(1.41, 10);
		expect(channelWeight(5, 6)).toBeCloseTo(1.41, 10);
	});
});

describe('computeIntegratedLoudness', () => {
	it('returns -Infinity (not NaN) for silence', () => {
		const silence = new Float32Array(48000 * 2); // 2 s
		const result = computeIntegratedLoudness([silence], 48000);

		expect(result.integratedLufs).toBe(Number.NEGATIVE_INFINITY);
		expect(Number.isNaN(result.integratedLufs)).toBe(false);
		expect(result.sampleRate).toBe(48000);
		expect(result.channels).toBe(1);
	});

	it('returns -Infinity (not NaN) for sub-400 ms input', () => {
		const short = makeSine(48000, 0.2, 1000, 0.5);
		const result = computeIntegratedLoudness([short], 48000);

		expect(result.integratedLufs).toBe(Number.NEGATIVE_INFINITY);
		expect(Number.isNaN(result.integratedLufs)).toBe(false);
	});

	it('is scale-invariant: doubling amplitude raises loudness by 6.02 ± 0.01 LU', () => {
		const base = makeSine(48000, 3, 1000, 0.25);
		const doubled = scaleChannel(base, 2);
		const halved = scaleChannel(base, 0.5);

		const baseL = computeIntegratedLoudness([base], 48000).integratedLufs;
		const doubledL = computeIntegratedLoudness([doubled], 48000).integratedLufs;
		const halvedL = computeIntegratedLoudness([halved], 48000).integratedLufs;

		expect(baseL).toBeGreaterThan(-70);
		expect(doubledL - baseL).toBeCloseTo(6.02, 1); // ±0.01 → 2 decimal places via toBeCloseTo( , 1) is ±0.05; use tighter:
		expect(Math.abs(doubledL - baseL - 6.020599913279624)).toBeLessThan(0.01);
		expect(Math.abs(baseL - halvedL - 6.020599913279624)).toBeLessThan(0.01);
	});

	it('measures the same content within 0.1 LU at 44.1 kHz and 48 kHz', () => {
		// Same 1 kHz tone, 3 s, amplitude 0.4 — band-limited so sample-rate
		// independent K-weighting should agree closely.
		const at48 = makeSine(48000, 3, 1000, 0.4);
		const at441 = makeSine(44100, 3, 1000, 0.4);

		const l48 = computeIntegratedLoudness([at48], 48000).integratedLufs;
		const l441 = computeIntegratedLoudness([at441], 44100).integratedLufs;

		expect(Math.abs(l48 - l441)).toBeLessThan(0.1);
	});

	it('absolute gate: content entirely below −70 LUFS yields -Infinity', () => {
		// Amplitude small enough that every 400 ms block is below the absolute gate.
		const belowGate = makeSine(48000, 2, 1000, 1e-6);
		const result = computeIntegratedLoudness([belowGate], 48000);

		expect(result.integratedLufs).toBe(Number.NEGATIVE_INFINITY);
		expect(Number.isNaN(result.integratedLufs)).toBe(false);
	});

	it('absolute gate: below-gate stretches do not pull loudness down like an ungated mean would', () => {
		const loud = makeSine(48000, 2, 1000, 0.5);
		const belowGate = makeSine(48000, 4, 1000, 1e-6);
		const mixed = concatChannels([loud, belowGate]);

		const loudOnly = computeIntegratedLoudness([loud], 48000).integratedLufs;
		const mixedLufs = computeIntegratedLoudness([mixed], 48000).integratedLufs;

		expect(loudOnly).toBeGreaterThan(-70);
		expect(mixedLufs).toBeGreaterThan(-70);
		// Overlapping 400 ms blocks at the boundary admit a small error; without the
		// absolute gate, four seconds of near-silence would drag the result down by
		// several LU. Gated measurement must stay within 1 LU of the loud-only value.
		expect(Math.abs(loudOnly - mixedLufs)).toBeLessThan(1.0);
	});

	it('dual-mono stereo measures roughly 3 LU louder than mono of the same content', () => {
		const mono = makeSine(48000, 2, 1000, 0.4);
		const monoL = computeIntegratedLoudness([mono], 48000).integratedLufs;
		const stereoL = computeIntegratedLoudness([mono, mono], 48000).integratedLufs;

		// 10*log10(2) ≈ 3.01 LU from the extra contributing channel.
		expect(stereoL - monoL).toBeCloseTo(3.01, 1);
	});

	it('never emits NaN for empty channel list', () => {
		const result = computeIntegratedLoudness([], 48000);
		expect(Number.isNaN(result.integratedLufs)).toBe(false);
		expect(result.integratedLufs).toBe(Number.NEGATIVE_INFINITY);
	});
});
