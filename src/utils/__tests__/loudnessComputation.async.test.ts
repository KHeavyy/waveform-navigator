import { describe, it, expect } from 'vitest';
import { computeIntegratedLoudnessAsync } from '../loudnessComputation';

describe('computeIntegratedLoudnessAsync', () => {
	it('matches the sync result and yields between slices', async () => {
		const sampleRate = 48000;
		const N = sampleRate * 2;
		const channel = new Float32Array(N);
		for (let i = 0; i < N; i++) {
			channel[i] = 0.25 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
		}

		const { computeIntegratedLoudness } = await import('../loudnessComputation');
		const sync = computeIntegratedLoudness([channel], sampleRate);

		let yields = 0;
		const originalSetTimeout = global.setTimeout;
		global.setTimeout = ((fn: TimerHandler, ms?: number) => {
			if (ms === 0) {
				yields++;
			}
			return originalSetTimeout(fn as any, ms);
		}) as unknown as typeof setTimeout;

		try {
			const asyncResult = await computeIntegratedLoudnessAsync(
				[channel],
				sampleRate,
				{ maxSliceMs: 1 }
			);

			expect(asyncResult.integratedLufs).toBeCloseTo(sync.integratedLufs, 5);
			expect(yields).toBeGreaterThan(0);
		} finally {
			global.setTimeout = originalSetTimeout;
		}
	});

	it('aborts when the signal is aborted', async () => {
		const sampleRate = 48000;
		const channel = new Float32Array(sampleRate * 5);
		channel.fill(0.2);

		const controller = new AbortController();
		const promise = computeIntegratedLoudnessAsync([channel], sampleRate, {
			signal: controller.signal,
			maxSliceMs: 1,
		});
		controller.abort();

		await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
	});
});
