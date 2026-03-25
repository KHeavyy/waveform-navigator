/**
 * Shared peak computation algorithm used by both worker and main thread.
 * Computes peak values from audio channel data for waveform visualization.
 */

export interface PeaksComputationParams {
	channelData: Float32Array;
	width: number;
	barWidth: number;
}

export interface PeaksComputationResult {
	peaks: Float32Array;
}

/**
 * Compute peaks from audio channel data.
 * This is the core algorithm used for waveform visualization.
 */
export function computePeaksFromChannelData({
	channelData,
	width,
	barWidth,
}: PeaksComputationParams): PeaksComputationResult {
	const slot = Math.max(1, Math.floor(width / barWidth));
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
