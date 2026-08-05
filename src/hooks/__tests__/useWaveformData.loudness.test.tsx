import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/peaksComputation', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../utils/peaksComputation')>();
	return {
		...actual,
		computePeaksFromChannelData: vi.fn(() => ({
			peaks: new Float32Array([0.4, 0.6]),
		})),
	};
});

vi.mock('../../utils/workerCreation', () => ({
	createPeaksWorker: vi.fn(() => null),
}));

const originalFetch = global.fetch;
const originalAudioContext = (window as any).AudioContext;

function installDecodeMock(channel: Float32Array, sampleRate = 48000) {
	(window as any).AudioContext = class {
		async decodeAudioData(_: ArrayBuffer) {
			return {
				numberOfChannels: 1,
				sampleRate,
				length: channel.length,
				getChannelData: () => channel,
			};
		}
		close() {}
	};
}

describe('useWaveformData loudness', () => {
	beforeEach(() => {
		global.fetch = vi.fn(
			async () =>
				({
					ok: true,
					status: 200,
					statusText: 'OK',
					headers: { get: () => 'audio/mpeg' },
					arrayBuffer: async () => new ArrayBuffer(64),
				}) as any
		) as any;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		(window as any).AudioContext = originalAudioContext;
		vi.clearAllMocks();
	});

	it('fires onLoudnessComputed once after onPeaksComputed', async () => {
		// > 400 ms of signal so gating produces a finite result
		const channel = new Float32Array(48000);
		for (let i = 0; i < channel.length; i++) {
			channel[i] = 0.3 * Math.sin((2 * Math.PI * 1000 * i) / 48000);
		}
		installDecodeMock(channel);

		const callOrder: string[] = [];
		const onPeaksComputed = vi.fn(() => {
			callOrder.push('peaks');
		});
		const onLoudnessComputed = vi.fn(
			(_result: {
				integratedLufs: number;
				sampleRate: number;
				channels: number;
			}) => {
				callOrder.push('loudness');
			}
		);

		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent() {
			useWaveformData({
				audio: '/loudness.mp3',
				width: 100,
				barWidth: 2,
				gap: 1,
				onPeaksComputed,
				onLoudnessComputed,
			} as any);
			return null;
		}

		render(<TestComponent />);

		await waitFor(() => expect(onPeaksComputed).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(onLoudnessComputed).toHaveBeenCalledTimes(1));

		expect(callOrder.indexOf('peaks')).toBeLessThan(
			callOrder.indexOf('loudness')
		);

		const result = onLoudnessComputed.mock.calls[0]![0];
		expect(result.sampleRate).toBe(48000);
		expect(result.channels).toBe(1);
		expect(Number.isFinite(result.integratedLufs)).toBe(true);
		expect(Number.isNaN(result.integratedLufs)).toBe(false);
	});

	it('skips loudness when precomputedLoudness is provided', async () => {
		const channel = new Float32Array(48000).fill(0.2);
		installDecodeMock(channel);

		const onLoudnessComputed = vi.fn();
		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent() {
			useWaveformData({
				audio: '/precomputed-loudness.mp3',
				width: 100,
				barWidth: 2,
				gap: 1,
				onLoudnessComputed,
				precomputedLoudness: -14.5,
			} as any);
			return null;
		}

		render(<TestComponent />);

		await waitFor(() => expect(global.fetch).toHaveBeenCalled());
		// Allow the async decode + schedule path to settle
		await new Promise((r) => setTimeout(r, 50));
		expect(onLoudnessComputed).not.toHaveBeenCalled();
	});

	it('does not compute loudness when onLoudnessComputed is omitted', async () => {
		const channel = new Float32Array(48000).fill(0.2);
		installDecodeMock(channel);

		const computeSpy = vi.spyOn(
			await import('../../utils/loudnessComputation'),
			'computeIntegratedLoudnessAsync'
		);

		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent() {
			useWaveformData({
				audio: '/no-loudness-cb.mp3',
				width: 100,
				barWidth: 2,
				gap: 1,
			} as any);
			return null;
		}

		render(<TestComponent />);

		await waitFor(() => expect(global.fetch).toHaveBeenCalled());
		await new Promise((r) => setTimeout(r, 50));
		expect(computeSpy).not.toHaveBeenCalled();
		computeSpy.mockRestore();
	});

	it('does not add fetch or decodeAudioData calls when onLoudnessComputed is set', async () => {
		const channel = new Float32Array(24000).fill(0.1);
		const decodeAudioData = vi.fn(async () => ({
			numberOfChannels: 1,
			sampleRate: 48000,
			length: channel.length,
			getChannelData: () => channel,
		}));

		(window as any).AudioContext = class {
			decodeAudioData = decodeAudioData;
			close() {}
		};

		const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
		const { useWaveformData } = await import('../useWaveformData');

		function WithoutLoudness() {
			useWaveformData({
				audio: '/io-baseline.mp3',
				width: 100,
				barWidth: 2,
				gap: 1,
			} as any);
			return null;
		}

		const { unmount } = render(<WithoutLoudness />);
		await waitFor(() => expect(decodeAudioData).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledTimes(1);
		unmount();

		fetchMock.mockClear();
		decodeAudioData.mockClear();

		function WithLoudness() {
			useWaveformData({
				audio: '/io-with-loudness.mp3',
				width: 100,
				barWidth: 2,
				gap: 1,
				onLoudnessComputed: vi.fn(),
			} as any);
			return null;
		}

		render(<WithLoudness />);
		await waitFor(() => expect(decodeAudioData).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('skips loudness when precomputedPeaks skips decode', async () => {
		installDecodeMock(new Float32Array(48000).fill(0.2));
		const onLoudnessComputed = vi.fn();
		const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent() {
			useWaveformData({
				audio: '/precomputed-peaks.mp3',
				width: 100,
				barWidth: 2,
				gap: 1,
				precomputedPeaks: new Float32Array(20).fill(0.5),
				onLoudnessComputed,
			} as any);
			return null;
		}

		render(<TestComponent />);
		await new Promise((r) => setTimeout(r, 50));
		expect(fetchMock).not.toHaveBeenCalled();
		expect(onLoudnessComputed).not.toHaveBeenCalled();
	});

	it('does not let a stale slower decode abort the current source loudness', async () => {
		const channel = new Float32Array(48000);
		for (let i = 0; i < channel.length; i++) {
			channel[i] = 0.3 * Math.sin((2 * Math.PI * 1000 * i) / 48000);
		}

		let releaseA: (() => void) | null = null;
		const aGate = new Promise<void>((resolve) => {
			releaseA = resolve;
		});

		(window as any).AudioContext = class {
			async decodeAudioData(_: ArrayBuffer) {
				return {
					numberOfChannels: 1,
					sampleRate: 48000,
					length: channel.length,
					getChannelData: () => channel,
				};
			}
			close() {}
		};

		global.fetch = vi.fn(async (input: RequestInfo) => {
			const url = String(input);
			if (url.includes('slow-a')) {
				await aGate;
			}
			return {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: { get: () => 'audio/mpeg' },
				arrayBuffer: async () => new ArrayBuffer(64),
			} as any;
		}) as any;

		const onLoudnessA = vi.fn();
		const onLoudnessB = vi.fn();
		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent({
			audio,
			onLoudnessComputed,
		}: {
			audio: string;
			onLoudnessComputed: (r: unknown) => void;
		}) {
			useWaveformData({
				audio,
				width: 100,
				barWidth: 2,
				gap: 1,
				onLoudnessComputed,
			} as any);
			return null;
		}

		const { rerender } = render(
			<TestComponent audio="/slow-a.mp3" onLoudnessComputed={onLoudnessA} />
		);

		// Switch to B before A finishes fetching
		rerender(
			<TestComponent audio="/fast-b.mp3" onLoudnessComputed={onLoudnessB} />
		);

		await waitFor(() => expect(onLoudnessB).toHaveBeenCalledTimes(1));

		// Now let A complete — must not abort/overwrite B's result
		releaseA!();
		await new Promise((r) => setTimeout(r, 80));

		expect(onLoudnessB).toHaveBeenCalledTimes(1);
		expect(onLoudnessA).not.toHaveBeenCalled();
	});

	it('measures when onLoudnessComputed is attached after decode', async () => {
		const channel = new Float32Array(48000);
		for (let i = 0; i < channel.length; i++) {
			channel[i] = 0.3 * Math.sin((2 * Math.PI * 1000 * i) / 48000);
		}
		installDecodeMock(channel);

		const onPeaksComputed = vi.fn();
		const onLoudnessComputed = vi.fn();
		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent({
			loudnessCb,
		}: {
			loudnessCb?: (r: unknown) => void;
		}) {
			useWaveformData({
				audio: '/late-callback.mp3',
				width: 100,
				barWidth: 2,
				gap: 1,
				onPeaksComputed,
				onLoudnessComputed: loudnessCb,
			} as any);
			return null;
		}

		const { rerender } = render(<TestComponent />);
		await waitFor(() => expect(onPeaksComputed).toHaveBeenCalled());
		expect(onLoudnessComputed).not.toHaveBeenCalled();

		rerender(<TestComponent loudnessCb={onLoudnessComputed} />);
		await waitFor(() => expect(onLoudnessComputed).toHaveBeenCalledTimes(1));
	});

	it('skips computation when precomputedLoudness is -Infinity', async () => {
		const channel = new Float32Array(48000).fill(0.2);
		installDecodeMock(channel);
		const onLoudnessComputed = vi.fn();
		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent() {
			useWaveformData({
				audio: '/silence-precomputed.mp3',
				width: 100,
				barWidth: 2,
				gap: 1,
				onLoudnessComputed,
				precomputedLoudness: Number.NEGATIVE_INFINITY,
			} as any);
			return null;
		}

		render(<TestComponent />);
		await waitFor(() => expect(global.fetch).toHaveBeenCalled());
		await new Promise((r) => setTimeout(r, 50));
		expect(onLoudnessComputed).not.toHaveBeenCalled();
	});
});
