import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

// Mock computePeaksFromChannelData so we can count calls. Preserve resamplePeaks
// from the original module — the hook depends on it for display resampling.
vi.mock('../../utils/peaksComputation', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../utils/peaksComputation')>();
	return {
		...actual,
		computePeaksFromChannelData: vi.fn(() => ({
			peaks: new Float32Array([0.2, 0.4]),
		})),
	};
});

import { computePeaksFromChannelData } from '../../utils/peaksComputation';

function makeStableFile(): File {
	const file = new File([new ArrayBuffer(8)], 'test.wav', {
		type: 'audio/wav',
	});
	(file as any).arrayBuffer = async () => new ArrayBuffer(8);
	return file;
}

describe('useWaveformData recompute on dimension change', () => {
	it('does not recompute or fire onPeaksComputed when only the responsive width changes', async () => {
		(window as any).AudioContext = class {
			async decodeAudioData(_: ArrayBuffer) {
				return {
					numberOfChannels: 1,
					getChannelData: () => new Float32Array([0.1, 0.5, 0.3]),
				};
			}
			close() {}
		};

		const onPeaksComputed = vi.fn();
		const stableFile = makeStableFile();

		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent({ w }: { w: number }) {
			useWaveformData({
				audio: stableFile,
				width: w,
				barWidth: 2,
				gap: 1,
				onPeaksComputed,
			} as any);
			return <div />;
		}

		const { rerender } = render(<TestComponent w={100} />);

		// Wait for the initial canonical computation.
		await waitFor(() => expect(onPeaksComputed).toHaveBeenCalledTimes(1));

		vi.mocked(computePeaksFromChannelData).mockClear();
		onPeaksComputed.mockClear();

		// Responsive width change: canonical peaks are width-independent, so the
		// audio buffer must NOT be re-decoded and the saved version should not be
		// overwritten with a smaller resampled copy.
		rerender(<TestComponent w={130} />);

		// Give any pending effects a chance to run.
		await new Promise((r) => setTimeout(r, 20));

		expect(computePeaksFromChannelData).not.toHaveBeenCalled();
		expect(onPeaksComputed).not.toHaveBeenCalled();
	});

	it('recomputes peaks when barWidth changes (canonical bar count depends on it)', async () => {
		(window as any).AudioContext = class {
			async decodeAudioData(_: ArrayBuffer) {
				return {
					numberOfChannels: 1,
					getChannelData: () => new Float32Array([0.1, 0.5, 0.3]),
				};
			}
			close() {}
		};

		const onPeaksComputed = vi.fn();
		const stableFile = makeStableFile();

		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent({ bw }: { bw: number }) {
			useWaveformData({
				audio: stableFile,
				width: 100,
				barWidth: bw,
				gap: 1,
				onPeaksComputed,
			} as any);
			return <div />;
		}

		const { rerender } = render(<TestComponent bw={2} />);

		await waitFor(() => expect(onPeaksComputed).toHaveBeenCalledTimes(1));

		vi.mocked(computePeaksFromChannelData).mockClear();
		onPeaksComputed.mockClear();
		// Make the next compute return a different value so the equality check
		// allows onPeaksComputed to fire.
		vi.mocked(computePeaksFromChannelData).mockReturnValueOnce({
			peaks: new Float32Array([0.5, 0.7]),
		});

		rerender(<TestComponent bw={4} />);

		await waitFor(() =>
			expect(computePeaksFromChannelData).toHaveBeenCalled()
		);
		await waitFor(() => expect(onPeaksComputed).toHaveBeenCalled());
	});
});
