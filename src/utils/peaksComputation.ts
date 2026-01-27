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
	const samplesPerSlot = Math.floor(channelData.length / slot) || 1;
	const peaks = new Float32Array(slot);

	// Compute peaks by finding max absolute value in each slot
	for (let i = 0; i < slot; i++) {
		const start = i * samplesPerSlot;
		const end = Math.min(start + samplesPerSlot, channelData.length);
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
