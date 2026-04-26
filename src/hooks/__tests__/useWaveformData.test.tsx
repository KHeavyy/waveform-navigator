import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Top-level mocks so they apply before the hook module is imported
const fakeInitialPeaks = new Float32Array([0.1, 0.2]);
vi.mock('../../utils/peaksComputation', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../utils/peaksComputation')>();
	return {
		...actual,
		computePeaksFromChannelData: vi.fn(() => ({ peaks: fakeInitialPeaks })),
	};
});

// Prepare a fake worker object the hook will receive
const worker: any = {
	postMessage: vi.fn(),
	terminate: vi.fn(),
	onmessage: null,
};

vi.mock('../../utils/workerCreation', () => ({
	createPeaksWorker: vi.fn(() => worker),
}));

// Provide a simple AudioContext decode that returns channel data
(window as any).AudioContext = class {
	async decodeAudioData(_: ArrayBuffer) {
		return {
			numberOfChannels: 1,
			getChannelData: () => new Float32Array([1, 0.5, 0.2]),
		};
	}
	close() {}
};

// Import hook after mocks are declared
import { useWaveformData } from '../useWaveformData';

describe('useWaveformData', () => {
	it('computes peaks and responds to worker progress messages', async () => {
		function TestComponent() {
			const { peaks } = useWaveformData({
				audio: '/test.mp3',
				width: 100,
				barWidth: 2,
				gap: 1,
			} as any);

			return (
				<div data-testid="peaks">
					{peaks ? Array.from(peaks).join(',') : 'null'}
				</div>
			);
		}

		render(<TestComponent />);

		// Wait for initial main-thread peaks (from computePeaksFromChannelData)
		await waitFor(() =>
			expect(screen.getByTestId('peaks').textContent).toContain('0.1')
		);

		// Simulate worker sending a progress update
		const progressed = new Float32Array([0.3, 0.4]);
		// call the onmessage handler that the hook assigned
		if (typeof worker.onmessage === 'function') {
			worker.onmessage({
				data: { type: 'progress', peaksBuffer: progressed.buffer },
			} as any);
		}

		await waitFor(() =>
			expect(screen.getByTestId('peaks').textContent).toContain('0.3')
		);
	});

	it('resamples worker progress to the latest displayBarCount, even when the width changed before the message arrived', async () => {
		function TestComponent({ w }: { w: number }) {
			const { peaks } = useWaveformData({
				audio: '/resize-before-worker.mp3',
				width: w,
				barWidth: 3,
				gap: 2,
			} as any);

			return (
				<div data-testid="peaks-len">{peaks ? peaks.length : 'null'}</div>
			);
		}

		// width=10, barWidth=3, gap=2 → displayBarCount = floor(10/5) = 2
		const { rerender } = render(<TestComponent w={10} />);

		await waitFor(() => {
			expect(screen.getByTestId('peaks-len').textContent).toBe('2');
		});

		// Resize before any worker progress arrives.
		// width=50 → displayBarCount = floor(50/5) = 10
		rerender(<TestComponent w={50} />);

		await waitFor(() => {
			expect(screen.getByTestId('peaks-len').textContent).toBe('10');
		});

		// Worker progress arrives AFTER the resize. The handler must use the
		// current displayBarCount (10), not the value captured when the worker
		// effect first bound onmessage (2).
		const progressed = new Float32Array([0.7, 0.8]);
		if (typeof worker.onmessage === 'function') {
			worker.onmessage({
				data: { type: 'progress', peaksBuffer: progressed.buffer },
			} as any);
		}

		await waitFor(() => {
			expect(screen.getByTestId('peaks-len').textContent).toBe('10');
		});
	});
});
