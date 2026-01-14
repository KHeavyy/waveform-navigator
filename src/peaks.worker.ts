/* Worker: compute peaks from a Float32 PCM buffer and stream partial results back */
self.onmessage = (ev: MessageEvent) => {
	const msg = ev.data;
	switch (msg.type) {
		case 'compute': {
			const channel = new Float32Array(msg.channelBuffer);
			const channelLength = msg.channelLength;
			const width = msg.width;
			const barWidth = msg.barWidth;
			const gap = msg.gap;
			const slot = Math.max(1, Math.floor(width / (barWidth + gap)));
			const samplesPerSlot = Math.floor(channelLength / slot) || 1;
			const peaks = new Float32Array(slot);
			const chunkSamples = msg.chunkSize || 262144;

			for (let offset = 0; offset < channelLength; offset += chunkSamples) {
				const end = Math.min(offset + chunkSamples, channelLength);
				for (let i = offset; i < end; i++) {
					const s = Math.abs(channel[i]);
					let idx = Math.floor(i / samplesPerSlot);
					if (idx >= slot) idx = slot - 1;
					if (s > peaks[idx]) peaks[idx] = s;
				}

				// stream partial peaks back so UI can show progressive waveform
				const peaksCopy = peaks.slice();
				(self as any).postMessage({ type: 'progress', peaksBuffer: peaksCopy.buffer, done: end === channelLength }, [peaksCopy.buffer]);
			}
			break;
		}
		case 'terminate': {
			// allow main thread request to terminate
			(self as any).close();
			break;
		}
		default:
			break;
	}
};
