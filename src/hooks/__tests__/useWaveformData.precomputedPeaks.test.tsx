import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';

// width=10, barWidth=3, gap=2 → Math.floor(10/5) = 2 expected bars
const MATCHING_PRECOMPUTED = new Float32Array([0.1, 0.2]);
const DEFAULT_COMPUTED = new Float32Array([0.1, 0.2]); // matches precomputed by default

vi.mock('../../utils/peaksComputation', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../utils/peaksComputation')>();
	return {
		...actual,
		computePeaksFromChannelData: vi.fn(() => ({ peaks: DEFAULT_COMPUTED })),
	};
});

vi.mock('../../utils/workerCreation', () => ({
	// No worker for these tests — keeps async surface minimal.
	createPeaksWorker: vi.fn(() => null),
}));

// Import the mocked module to allow per-test overrides
import { computePeaksFromChannelData } from '../../utils/peaksComputation';
import { useWaveformData } from '../useWaveformData';

function TestComponent({
	audio,
	precomputedPeaks,
	onPeaksComputed,
	width = 10,
	barWidth = 3,
	gap = 2,
}: {
	audio?: string | File | null;
	precomputedPeaks?: Float32Array | number[];
	onPeaksComputed?: (peaks: Float32Array) => void;
	width?: number;
	barWidth?: number;
	gap?: number;
}) {
	const { peaks } = useWaveformData({
		audio: audio ?? null,
		width,
		barWidth,
		gap,
		precomputedPeaks,
		onPeaksComputed,
	});
	return (
		<div data-testid="peaks">{peaks ? Array.from(peaks).join(',') : 'null'}</div>
	);
}

describe('useWaveformData precomputedPeaks', () => {
	afterEach(() => {
		// Restore the default mock return value and clear call history after each test.
		vi.mocked(computePeaksFromChannelData).mockReturnValue({
			peaks: DEFAULT_COMPUTED,
		});
		vi.mocked(computePeaksFromChannelData).mockClear();
		// Always restore real timers so fake timers from one test don't leak into others.
		vi.useRealTimers();
	});

	it('seeds peaks state immediately when bar count matches', () => {
		// Provide precomputedPeaks with no audio — peaks should be available
		// from the very first synchronous render, no waiting required.
		render(<TestComponent precomputedPeaks={MATCHING_PRECOMPUTED} />);

		const text = screen.getByTestId('peaks').textContent ?? '';
		// Values are Float32-precision so check that neither slot is 'null'
		expect(text).not.toBe('null');
		// Both positions should match the precomputed values
		expect(text).toContain('0.1');
		expect(text).toContain('0.2');
	});

	it('resamples precomputedPeaks with a wrong bar count instead of discarding', () => {
		// 3-element array but expected slots = 2 → resample to 2 bars and display immediately
		render(
			<TestComponent precomputedPeaks={new Float32Array([0.2, 0.6, 0.4])} />
		);

		const text = screen.getByTestId('peaks').textContent ?? '';
		// Resampled result must not be null and must have 2 values (interpolated)
		expect(text).not.toBe('null');
		const values = text.split(',').map(Number);
		expect(values).toHaveLength(2);
		// First value = peaks[0] = 0.2, last value = peaks[2] = 0.4 (endpoints are exact)
		expect(values[0]).toBeCloseTo(0.2, 4);
		expect(values[1]).toBeCloseTo(0.4, 4);
	});

	it('skips the fetch entirely when precomputedPeaks match the bar count', async () => {
		// With fix #2, a matching precomputedPeaks set is trusted as-is — no network
		// request or decode step is executed, and onPeaksComputed is never fired.
		vi.useFakeTimers();
		const onPeaksComputed = vi.fn();

		render(
			<TestComponent
				audio="/test.mp3"
				precomputedPeaks={MATCHING_PRECOMPUTED}
				onPeaksComputed={onPeaksComputed}
			/>
		);

		// Flush all timers and microtasks so any async work has a chance to run.
		await vi.runAllTimersAsync();

		expect(computePeaksFromChannelData).not.toHaveBeenCalled();
		expect(onPeaksComputed).not.toHaveBeenCalled();
		// Precomputed peaks are still shown on the canvas.
		expect(screen.getByTestId('peaks').textContent).toContain('0.1');

		vi.useRealTimers();
	});

	it('fires onPeaksComputed with resampled peaks when bar count mismatches, skipping the fetch', async () => {
		// Bar count for width=10, barWidth=3, gap=2 is 2.
		// Passing a 3-element array triggers resampling on initial mount.
		// The audio fetch must NOT happen; onPeaksComputed fires with the resampled result.
		const onPeaksComputed = vi.fn();

		render(
			<TestComponent
				audio="/test.mp3"
				precomputedPeaks={new Float32Array([0.2, 0.6, 0.4])}
				onPeaksComputed={onPeaksComputed}
			/>
		);

		await waitFor(() => expect(onPeaksComputed).toHaveBeenCalledTimes(1));

		// No audio computation should have occurred — peaks came from resampling.
		expect(computePeaksFromChannelData).not.toHaveBeenCalled();

		const reported = onPeaksComputed.mock.calls[0][0] as Float32Array;
		expect(reported).toBeInstanceOf(Float32Array);
		expect(reported).toHaveLength(2);
		// Endpoints of a linear resample are exact.
		expect(reported[0]).toBeCloseTo(0.2, 4);
		expect(reported[1]).toBeCloseTo(0.4, 4);

		// Canvas must already show the resampled peaks.
		const text = screen.getByTestId('peaks').textContent ?? '';
		expect(text).not.toBe('null');
		const values = text.split(',').map(Number);
		expect(values[0]).toBeCloseTo(0.2, 4);
	});

	it('accepts a plain number[] and converts it to Float32Array', () => {
		// Pass a regular JavaScript array — should be treated the same as Float32Array.
		render(<TestComponent precomputedPeaks={[0.1, 0.2]} />);

		const text = screen.getByTestId('peaks').textContent ?? '';
		expect(text).not.toBe('null');
		expect(text).toContain('0.1');
	});

	it('fetches fresh peaks when audio changes and no precomputedPeaks are provided', async () => {
		const onPeaksComputed = vi.fn();

		// Initial render: matching precomputedPeaks → fetch is skipped.
		vi.useFakeTimers();
		const { rerender } = render(
			<TestComponent
				audio="/audio1.mp3"
				precomputedPeaks={MATCHING_PRECOMPUTED}
				onPeaksComputed={onPeaksComputed}
			/>
		);

		await vi.runAllTimersAsync();
		expect(computePeaksFromChannelData).not.toHaveBeenCalled();
		expect(onPeaksComputed).not.toHaveBeenCalled();
		vi.useRealTimers();

		onPeaksComputed.mockClear();
		vi.mocked(computePeaksFromChannelData).mockClear();

		// Switch to a different audio source without providing precomputedPeaks
		// → no pre-computed baseline, so a fresh fetch + decode is triggered.
		rerender(
			<TestComponent audio="/audio2.mp3" onPeaksComputed={onPeaksComputed} />
		);

		await waitFor(() => expect(onPeaksComputed).toHaveBeenCalledTimes(1));
	});
});
