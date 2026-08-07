import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression: decode often starts while the responsive fallback width is still in
 * effect (BandVolt passes width={1400} as that fallback). If computePeaks closes
 * over that displayBarCount, the waveform stays denser than a later visit that
 * loads the same canonical peaks via precomputedPeaks (which re-seeds after the
 * real container width is known).
 */

vi.mock('../../utils/peaksComputation', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../utils/peaksComputation')>();
	return {
		...actual,
		// Canonical length is independent of display width; keep it fixed so the
		// assertion is purely about display resampling.
		computePeaksFromChannelData: vi.fn(() => ({
			peaks: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]),
		})),
	};
});

vi.mock('../../utils/workerCreation', () => ({
	// No worker: the main-thread path is the one that historically closed over a
	// stale displayBarCount. Worker progress already used the live ref.
	createPeaksWorker: vi.fn(() => null),
}));

function makeDelayedFile(delayMs: number): File {
	const file = new File([new ArrayBuffer(8)], 'delayed.wav', {
		type: 'audio/wav',
	});
	(file as any).arrayBuffer = () =>
		new Promise<ArrayBuffer>((resolve) => {
			setTimeout(() => resolve(new ArrayBuffer(8)), delayMs);
		});
	return file;
}

describe('useWaveformData stale display bar count', () => {
	beforeEach(() => {
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

	it('resamples main-thread peaks to the current width when decode finishes after a resize', async () => {
		const { useWaveformData } = await import('../useWaveformData');
		const delayedFile = makeDelayedFile(40);

		function TestComponent({ w }: { w: number }) {
			const { peaks } = useWaveformData({
				audio: delayedFile,
				width: w,
				barWidth: 3,
				gap: 2,
				forceMainThread: true,
			} as any);

			return (
				<div data-testid="peaks-len">{peaks ? peaks.length : 'null'}</div>
			);
		}

		// Fallback width as used by BandVolt: 1400 → displayBarCount = floor(1400/5) = 280
		const { rerender } = render(<TestComponent w={1400} />);
		expect(screen.getByTestId('peaks-len').textContent).toBe('null');

		// Container measures in before decode completes: 500 → floor(500/5) = 100
		rerender(<TestComponent w={500} />);

		await waitFor(() => {
			expect(screen.getByTestId('peaks-len').textContent).toBe('100');
		});
	});
});
