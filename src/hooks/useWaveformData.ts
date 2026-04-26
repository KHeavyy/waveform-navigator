import { useEffect, useRef, useState } from 'react';
import {
	computePeaksFromChannelData,
	resamplePeaks,
} from '../utils/peaksComputation';
import { createPeaksWorker } from '../utils/workerCreation';

function peaksMatch(
	a: Float32Array,
	b: Float32Array,
	threshold = 0.001
): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (Math.abs(a[i] - b[i]) > threshold) return false;
	}
	return true;
}

interface UseWaveformDataProps {
	audio: string | File | null | undefined;
	width: number;
	barWidth: number;
	gap: number;
	/**
	 * Standard width used for the canonical peak computation (independent of
	 * the rendered component width). Peaks are computed once at this width and
	 * resampled down to the display width for rendering, so peaks captured on
	 * a small screen still look good when reloaded on a larger one.
	 */
	peakComputationWidth?: number;
	workerUrl?: string;
	forceMainThread?: boolean;
	/**
	 * Optional pre-computed peaks data for instant waveform rendering.
	 * Accepts a `Float32Array` or plain `number[]` (e.g. from JSON storage).
	 * Treated as the canonical (high-resolution) peaks regardless of length;
	 * the waveform resamples them to fit the responsive display width.
	 * The worker still runs in the background for verification; if the result
	 * differs, the canvas updates and `onPeaksComputed` fires with fresh data.
	 * Cleared when the `audio` prop changes so new audio always computes fresh.
	 */
	precomputedPeaks?: Float32Array | number[];
	/**
	 * Called with a Blob URL created from the same ArrayBuffer fetched for peak
	 * computation, so the audio element can reuse it without a second network request.
	 * The caller is responsible for revoking the URL when it is no longer needed.
	 */
	onBlobUrlReady?: (blobUrl: string) => void;
	/**
	 * Fires with the canonical (high-resolution) peak array — the same shape
	 * regardless of the current responsive display width — so consumers can
	 * persist a single version that renders well on any screen size.
	 */
	onPeaksComputed?: (peaks: Float32Array) => void;
	onError?: (error: Error) => void;
}

interface UseWaveformDataReturn {
	peaks: Float32Array | null;
}

function toFloat32(peaks: Float32Array | number[]): Float32Array {
	return peaks instanceof Float32Array ? peaks : new Float32Array(peaks);
}

export function useWaveformData({
	audio,
	width,
	barWidth,
	gap,
	peakComputationWidth = 1400,
	workerUrl,
	forceMainThread,
	precomputedPeaks,
	onBlobUrlReady,
	onPeaksComputed,
	onError,
}: UseWaveformDataProps): UseWaveformDataReturn {
	const displayBarCount = Math.max(1, Math.floor(width / (barWidth + gap)));

	// Adopt precomputedPeaks as canonical on the initial mount and seed the
	// display state with a resampled copy. useState/useRef only consume these
	// initializers on first render.
	const initialCanonical: Float32Array | null = precomputedPeaks
		? toFloat32(precomputedPeaks)
		: null;
	const initialDisplay: Float32Array | null = initialCanonical
		? resamplePeaks(initialCanonical, displayBarCount)
		: null;

	const [peaks, setPeaks] = useState<Float32Array | null>(() => initialDisplay);
	// Canonical (high-resolution) peaks. The display peaks are always derived
	// from this via resampling. Stays stable across responsive width changes.
	const canonicalPeaksRef = useRef<Float32Array | null>(initialCanonical);
	// Always-current display bar count, read by the worker handler whose effect
	// closure was bound once at mount. Without this, a resize that arrives
	// before a worker progress message would leave peaks at a stale length.
	const displayBarCountRef = useRef<number>(displayBarCount);
	displayBarCountRef.current = displayBarCount;
	const audioCtxRef = useRef<AudioContext | null>(null);
	const workerRef = useRef<Worker | null>(null);
	const onPeaksComputedRef = useRef(onPeaksComputed);
	const onBlobUrlReadyRef = useRef(onBlobUrlReady);
	const onErrorRef = useRef(onError);
	const audioBufferRef = useRef<Float32Array | null>(null);
	const lastBarWidthRef = useRef<number>(barWidth);
	const lastGapRef = useRef<number>(gap);
	const lastPeakComputationWidthRef = useRef<number>(peakComputationWidth);
	// Tracks the previous audio value to detect genuine source changes vs. initial mount.
	const prevAudioRef = useRef<string | File | null | undefined>(audio);
	// Tracks the previous precomputedPeaks reference to detect whether it changed
	// alongside audio, preventing stale peaks from seeding a new audio source.
	const prevPrecomputedPeaksRef = useRef<
		Float32Array | number[] | null | undefined
	>(precomputedPeaks);

	useEffect(() => {
		onPeaksComputedRef.current = onPeaksComputed;
		onBlobUrlReadyRef.current = onBlobUrlReady;
		onErrorRef.current = onError;
	}, [onPeaksComputed, onBlobUrlReady, onError]);

	// Initialize worker and cleanup when props change
	useEffect(() => {
		const worker = createPeaksWorker({ workerUrl, forceMainThread });
		workerRef.current = worker;

		if (worker) {
			worker.onmessage = (ev: MessageEvent) => {
				const msg = ev.data;
				if (msg.type === 'progress') {
					const fresh = new Float32Array(msg.peaksBuffer);
					const existing = canonicalPeaksRef.current;
					if (existing && peaksMatch(fresh, existing)) {
						return;
					}
					canonicalPeaksRef.current = fresh;
					setPeaks(resamplePeaks(fresh, displayBarCountRef.current));
					onPeaksComputedRef.current?.(fresh);
				}
			};
		}

		// Cleanup worker when props change or on unmount
		return () => {
			if (worker) {
				worker.postMessage({ type: 'terminate' });
				worker.terminate();
				// Only null the ref if it still points to this worker instance
				if (workerRef.current === worker) {
					workerRef.current = null;
				}
			}
		};
	}, [workerUrl, forceMainThread]);

	// Re-compute peaks when forceMainThread changes so the new computation path is
	// exercised and onPeaksComputed fires, allowing listeners (e.g. e2e tests) to
	// detect that the waveform is ready after switching between worker / main-thread
	// modes. This effect intentionally runs after the worker init effect above so
	// workerRef.current already reflects the new mode.
	useEffect(() => {
		if (audioBufferRef.current) {
			computePeaks(audioBufferRef.current, { forceNotify: true });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [forceMainThread]);

	// Cleanup audio context on unmount
	useEffect(() => {
		return () => {
			if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
				audioCtxRef.current.close();
			}
		};
	}, []);

	// Load and decode audio data when audio prop changes
	useEffect(() => {
		if (!audio) {
			// Preserve the waveform shape when precomputed peaks are seeding the display;
			// only reset to null when no canonical baseline is active.
			if (!canonicalPeaksRef.current) {
				setPeaks(null);
			}
			audioBufferRef.current = null;
			// Clear the canonical baseline so the next audio load always computes fresh.
			canonicalPeaksRef.current = null;
			prevAudioRef.current = audio;
			return;
		}

		// When the audio source genuinely changes (not the initial mount), clear the
		// canonical baseline so fresh peaks are always applied and onPeaksComputed
		// fires without comparing against stale data.
		const audioChanged = prevAudioRef.current !== audio;
		if (audioChanged) {
			canonicalPeaksRef.current = null;
		}
		prevAudioRef.current = audio;

		// Only re-seed canonicalPeaksRef when precomputedPeaks itself has also changed.
		// This prevents stale peaks from seeding a newly switched audio source when the
		// parent forgets to update precomputedPeaks alongside audio.
		const precomputedChanged =
			precomputedPeaks !== prevPrecomputedPeaksRef.current;
		prevPrecomputedPeaksRef.current = precomputedPeaks;

		// Adopt precomputed peaks as canonical for the current audio source when the
		// ref was just cleared (audio changed) or was never populated, but only when
		// precomputedPeaks also changed (or audio didn't change) to avoid stale data.
		if (
			precomputedPeaks &&
			!canonicalPeaksRef.current &&
			(!audioChanged || precomputedChanged)
		) {
			const canonical = toFloat32(precomputedPeaks);
			canonicalPeaksRef.current = canonical;
			setPeaks(resamplePeaks(canonical, displayBarCount));
		}

		// Skip the fetch entirely when canonical peaks are already available.
		// There is nothing to compute — the canvas already shows the correct waveform.
		if (canonicalPeaksRef.current) {
			return;
		}

		const loadArrayBuffer = async () => {
			try {
				// Close previous AudioContext if it exists
				if (
					audioCtxRef.current &&
					typeof audioCtxRef.current.close === 'function'
				) {
					await audioCtxRef.current.close();
					audioCtxRef.current = null;
				}

				let arrayBuffer: ArrayBuffer | null = null;
				if (typeof audio === 'string') {
					const resp = await fetch(audio, { mode: 'cors' });
					if (!resp.ok) {
						throw new Error(
							`Failed to fetch audio: ${resp.status} ${resp.statusText}`
						);
					}
					arrayBuffer = await resp.arrayBuffer();
					// Share the fetched buffer with the audio element via a Blob URL so the
					// browser does not issue a second network request for the same file.
					// Only create the Blob URL when there is a consumer — otherwise it would
					// leak because the URL is never used or revoked.
					const onBlobUrlReady = onBlobUrlReadyRef.current;
					if (onBlobUrlReady) {
						const contentType = resp.headers.get('Content-Type') ?? 'audio/*';
						const blobUrl = URL.createObjectURL(
							new Blob([arrayBuffer], { type: contentType })
						);
						onBlobUrlReady(blobUrl);
					}
				} else if (audio instanceof File) {
					arrayBuffer = await audio.arrayBuffer();
				} else {
					console.warn('Unsupported audio prop', audio);
					return;
				}

				const AudioContextClass: any =
					(window as any).AudioContext || (window as any).webkitAudioContext;
				if (!AudioContextClass) {
					throw new Error('AudioContext not supported in this browser');
				}
				const ac: AudioContext = new AudioContextClass();
				audioCtxRef.current = ac;

				try {
					const decoded = await ac.decodeAudioData(arrayBuffer.slice(0));
					const channelData =
						decoded.numberOfChannels > 0 ? decoded.getChannelData(0) : null;

					// Store the audio buffer for resampling
					if (channelData) {
						audioBufferRef.current = channelData;
						lastBarWidthRef.current = barWidth;
						lastGapRef.current = gap;
						lastPeakComputationWidthRef.current = peakComputationWidth;
						computePeaks(channelData);
					}
				} catch (decodeError: any) {
					throw new Error(
						`Failed to decode audio data: ${decodeError.message || 'Unknown error'}`
					);
				}
			} catch (err: unknown) {
				console.warn('Failed to load audio for waveform:', err);
				// Create a more user-friendly error message
				let errorMessage = 'Failed to load waveform';
				if (err instanceof Error) {
					const msg = err.message;
					// Our custom fetch error message
					if (msg.startsWith('Failed to fetch audio:')) {
						errorMessage = 'Network error: Unable to fetch audio file';
						// Browser's native fetch error (typically CORS or network issues)
					} else if (err.name === 'TypeError' && msg.includes('fetch')) {
						errorMessage =
							'Network error: Unable to fetch audio file. This may be due to CORS restrictions or network issues.';
						// Decode-related errors: match our custom decode prefix
					} else if (msg.startsWith('Failed to decode audio data')) {
						errorMessage =
							'Audio decode error: File format may be unsupported or corrupted';
					} else {
						errorMessage = msg;
					}
				}
				onErrorRef.current?.(new Error(errorMessage));
			}
		};

		loadArrayBuffer();
	}, [audio]);

	// Re-derive display peaks when the responsive width changes, without
	// recomputing from the audio buffer. Canonical peaks are independent of
	// display width, so onPeaksComputed must not fire here — only the resampled
	// view changes. Skipped on the first render: the initial peaks state is
	// already seeded from useState's lazy initializer.
	const lastDisplayBarCountRef = useRef<number>(displayBarCount);
	useEffect(() => {
		if (lastDisplayBarCountRef.current === displayBarCount) return;
		lastDisplayBarCountRef.current = displayBarCount;
		const canonical = canonicalPeaksRef.current;
		if (!canonical) return;
		setPeaks(resamplePeaks(canonical, displayBarCount));
	}, [displayBarCount]);

	// Recompute canonical peaks when barWidth, gap, or peakComputationWidth
	// changes — these affect how many canonical samples we produce. Responsive
	// width changes are handled separately above.
	useEffect(() => {
		const barWidthChanged = barWidth !== lastBarWidthRef.current;
		const gapChanged = gap !== lastGapRef.current;
		const peakWidthChanged =
			peakComputationWidth !== lastPeakComputationWidthRef.current;

		if (!barWidthChanged && !gapChanged && !peakWidthChanged) return;

		lastBarWidthRef.current = barWidth;
		lastGapRef.current = gap;
		lastPeakComputationWidthRef.current = peakComputationWidth;

		if (audioBufferRef.current) {
			computePeaks(audioBufferRef.current);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [barWidth, gap, peakComputationWidth]);

	function computePeaks(
		channelData: Float32Array,
		options?: { forceNotify?: boolean }
	) {
		const forceNotify = !!options?.forceNotify;
		// Always compute canonical peaks at the standard width so the saved
		// version is independent of the current responsive display width.
		const { peaks: canonicalPeaks } = computePeaksFromChannelData({
			channelData,
			width: peakComputationWidth,
			barWidth,
			gap,
		});

		const existing = canonicalPeaksRef.current;
		if (existing && peaksMatch(canonicalPeaks, existing)) {
			if (forceNotify) {
				onPeaksComputedRef.current?.(existing);
			}
		} else {
			canonicalPeaksRef.current = canonicalPeaks;
			setPeaks(resamplePeaks(canonicalPeaks, displayBarCount));
			onPeaksComputedRef.current?.(canonicalPeaks);
		}

		// Use worker for more accurate progressive computation if available
		if (workerRef.current) {
			try {
				// Transfer a copy of the buffer to avoid losing the original data
				const channelCopy = new Float32Array(channelData);
				workerRef.current.postMessage(
					{
						type: 'compute',
						channelBuffer: channelCopy.buffer,
						channelLength: channelCopy.length,
						width: peakComputationWidth,
						barWidth,
						gap,
						chunkSize: 262144,
					},
					[channelCopy.buffer]
				);
			} catch (err) {
				// Fallback peaks are already set above, so this is fine
				console.warn(
					'[WaveformNavigator] Worker postMessage failed, using main-thread peaks:',
					err
				);
			}
		}
	}

	return {
		peaks,
	};
}
