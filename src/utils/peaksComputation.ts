/**
 * Shared peak computation algorithm used by both worker and main thread.
 * Computes peak values from audio channel data for waveform visualization.
 */

export interface PeaksComputationParams {
	channelData: Float32Array;
	width: number;
	barWidth: number;
	gap: number;
}

export interface PeaksComputationResult {
	peaks: Float32Array;
}

/**
 * Linearly interpolate a peaks array to a new target length.
 * Returns a `Float32Array` of exactly `targetCount` values (minimum 1).
 * When the source length already equals `targetCount`, a copy is returned.
 * Handles edge cases: empty input, single sample, and targetCount of 1.
 */
export function resamplePeaks(
	peaks: number[] | Float32Array,
	targetCount: number
): Float32Array {
	const target = Math.max(1, targetCount);
	if (peaks.length === 0) return new Float32Array(target);
	if (peaks.length === target) return Float32Array.from(peaks);
	const out = new Float32Array(target);
	if (target === 1) {
		out[0] = peaks[0];
		return out;
	}
	const ratio = (peaks.length - 1) / (target - 1);
	for (let i = 0; i < target; i++) {
		const pos = i * ratio;
		const lo = Math.floor(pos);
		const hi = Math.min(lo + 1, peaks.length - 1);
		const t = pos - lo;
		out[i] = peaks[lo] * (1 - t) + peaks[hi] * t;
	}
	return out;
}

/**
 * Compute peaks from audio channel data.
 * This is the core algorithm used for waveform visualization.
 */
export function computePeaksFromChannelData({
	channelData,
	width,
	barWidth,
	gap,
}: PeaksComputationParams): PeaksComputationResult {
	const slot = Math.max(1, Math.floor(width / (barWidth + gap)));
	const peaks = new Float32Array(slot);
	const totalSamples = channelData.length;

	if (totalSamples === 0) {
		return { peaks };
	}

	// Map each visual slot to a proportional time window so all audio maps
	// across the full waveform width, including very short clips.
	for (let i = 0; i < slot; i++) {
		const start = Math.floor((i * totalSamples) / slot);
		const rawEnd = Math.floor(((i + 1) * totalSamples) / slot);
		const end = Math.max(start + 1, Math.min(totalSamples, rawEnd));
		let max = 0;
		for (let s = start; s < end; s++) {
			const v = Math.abs(channelData[s]);
			if (v > max) {
				max = v;
			}
		}
		peaks[i] = max;
	}

	return { peaks };
}
