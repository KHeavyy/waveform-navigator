import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock computePeaksFromChannelData to return deterministic peaks
vi.mock('../../utils/peaksComputation', () => ({
	computePeaksFromChannelData: vi.fn(() => ({
		peaks: new Float32Array([0.2, 0.8]),
	})),
}));

// Provide a worker that throws only when asked to compute, but accepts terminate
vi.mock('../../utils/workerCreation', () => ({
	createPeaksWorker: vi.fn(() => ({
		postMessage: (msg: any) => {
			if (msg && msg.type === 'compute') {
				throw new Error('postMessage failed');
			}
			return undefined;
		},
		terminate: () => {},
		onmessage: null,
	})),
}));

describe('useWaveformData worker postMessage failure', () => {
	beforeEach(() => {
		// Minimal AudioContext mock for decoding
		(window as any).AudioContext = class {
			async decodeAudioData(_: ArrayBuffer) {
				return {
					numberOfChannels: 1,
					getChannelData: () => new Float32Array([0.1, 0.5, 0.3]),
				};
			}
			close() {}
		};
	});

	it('falls back to main-thread peaks when worker.postMessage throws', async () => {
		const onPeaksComputed = vi.fn();

		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent() {
			const file = new File([new ArrayBuffer(8)], 'test.wav', {
				type: 'audio/wav',
			});
			(file as any).arrayBuffer = async () => new ArrayBuffer(8);
			const { peaks } = useWaveformData({
				audio: file,
				width: 100,
				barWidth: 2,
				gap: 1,
				onPeaksComputed,
			} as any);
			return <div>{peaks ? peaks.length : 0}</div>;
		}

		render(<TestComponent />);

		await waitFor(() => expect(onPeaksComputed).toHaveBeenCalled());
	});
});
