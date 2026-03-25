/* Worker: compute peaks from a Float32 PCM buffer and stream partial results back */
self.onmessage = (ev: MessageEvent) => {
	const msg = ev.data;
	switch (msg.type) {
		case 'compute': {
			const channel = new Float32Array(msg.channelBuffer);
			const channelLength = msg.channelLength;
			const width = msg.width;
			const barWidth = msg.barWidth;
			const slot = Math.max(1, Math.floor(width / barWidth));
			const peaks = new Float32Array(slot);
			const chunkSlots = Math.max(1, msg.chunkSize || 256);

			if (channelLength === 0) {
				const peaksCopy = peaks.slice();
				(self as any).postMessage(
					{
						type: 'progress',
						peaksBuffer: peaksCopy.buffer,
						done: true,
					},
					[peaksCopy.buffer]
				);
				break;
			}

			// Process in slot chunks and stream partial results for progressive rendering.
			for (let offset = 0; offset < slot; offset += chunkSlots) {
				const endSlot = Math.min(offset + chunkSlots, slot);
				for (let i = offset; i < endSlot; i++) {
					const start = Math.floor((i * channelLength) / slot);
					const rawEnd = Math.floor(((i + 1) * channelLength) / slot);
					const end = Math.max(start + 1, Math.min(channelLength, rawEnd));
					let max = 0;
					for (let s = start; s < end; s++) {
						const sample = Math.abs(channel[s]);
						if (sample > max) {
							max = sample;
						}
					}
					peaks[i] = max;
				}

				// stream partial peaks back so UI can show progressive waveform
				const peaksCopy = peaks.slice();
				(self as any).postMessage(
					{
						type: 'progress',
						peaksBuffer: peaksCopy.buffer,
						done: endSlot === slot,
					},
					[peaksCopy.buffer]
				);
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
