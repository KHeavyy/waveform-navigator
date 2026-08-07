import { useEffect, useRef, useState } from 'react';
import {
	computePeaksFromChannelData,
	resamplePeaks,
} from '../utils/peaksComputation';
import { createPeaksWorker } from '../utils/workerCreation';
import {
	computeIntegratedLoudnessAsync,
	type LoudnessResult,
} from '../utils/loudnessComputation';

function peaksMatch(
	a: Float32Array,
	b: Float32Array,
	threshold = 0.001
): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (Math.abs(a[i] - b[i]) > threshold) {
			return false;
		}
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
	/**
	 * Fired once per decoded source with BS.1770 integrated loudness, after
	 * `onPeaksComputed`. Only runs when this callback is set and
	 * `precomputedLoudness` is not provided. Skipped entirely when
	 * `precomputedPeaks` causes decode to be skipped (no buffer to measure).
	 */
	onLoudnessComputed?: (result: LoudnessResult) => void;
	/**
	 * When provided, skips loudness computation (mirrors `precomputedPeaks`).
	 * Pass the previously persisted `integratedLufs` value.
	 */
	precomputedLoudness?: number;
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
	onLoudnessComputed,
	precomputedLoudness,
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
	const onLoudnessComputedRef = useRef(onLoudnessComputed);
	const precomputedLoudnessRef = useRef(precomputedLoudness);
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
	const loudnessAbortRef = useRef<AbortController | null>(null);
	/** In-flight loudness promise — awaited before closing AudioContext. */
	const loudnessJobRef = useRef<Promise<unknown> | null>(null);
	/**
	 * Monotonic generation for the current audio load. Stale fetch/decode
	 * completions compare against this and exit without touching loudness state.
	 */
	const loadGenerationRef = useRef(0);
	/** Audio source for which loudness has already been reported (or skipped). */
	const loudnessReportedForRef = useRef<string | File | null | undefined>(null);
	/**
	 * Decoded channel views for the current generation, retained so a late-attached
	 * `onLoudnessComputed` can still measure without re-decoding.
	 */
	const decodedForLoudnessRef = useRef<{
		source: string | File;
		generation: number;
		channels: Float32Array[];
		sampleRate: number;
	} | null>(null);

	useEffect(() => {
		onPeaksComputedRef.current = onPeaksComputed;
		onLoudnessComputedRef.current = onLoudnessComputed;
		precomputedLoudnessRef.current = precomputedLoudness;
		onBlobUrlReadyRef.current = onBlobUrlReady;
		onErrorRef.current = onError;
	}, [
		onPeaksComputed,
		onLoudnessComputed,
		precomputedLoudness,
		onBlobUrlReady,
		onError,
	]);

	// If the host attaches onLoudnessComputed after decode, measure from the
	// retained channel views (same generation / source only).
	useEffect(() => {
		if (!onLoudnessComputed) {
			return;
		}

		const pending = decodedForLoudnessRef.current;
		if (!pending) {
			return;
		}

		if (pending.generation !== loadGenerationRef.current) {
			return;
		}

		if (prevAudioRef.current !== pending.source) {
			return;
		}

		scheduleLoudnessFromChannels(
			pending.channels,
			pending.sampleRate,
			pending.source,
			pending.generation
		);
		// scheduleLoudnessFromChannels is stable enough via refs; audio/load gen
		// changes clear decodedForLoudnessRef before this can misfire.
	}, [onLoudnessComputed]);

	// Abort any in-flight loudness job on unmount.
	useEffect(() => {
		return () => {
			loadGenerationRef.current += 1;
			loudnessAbortRef.current?.abort();
		};
	}, []);

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
					const targetBars = displayBarCountRef.current;
					if (existing && peaksMatch(fresh, existing)) {
						// Canonical is unchanged, but display peaks may still be stuck at a
						// stale bar count from a main-thread compute that closed over an
						// outdated width. Re-resample when the lengths diverge.
						setPeaks((prev) =>
							prev && prev.length === targetBars
								? prev
								: resamplePeaks(existing, targetBars)
						);
						return;
					}
					canonicalPeaksRef.current = fresh;
					setPeaks(resamplePeaks(fresh, targetBars));
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
	}, [forceMainThread]);

	// Cleanup audio context on unmount (loudness abort runs in a separate effect).
	useEffect(() => {
		return () => {
			if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
				void audioCtxRef.current.close();
			}
		};
	}, []);

	async function cancelLoudnessJob(): Promise<void> {
		loudnessAbortRef.current?.abort();
		const job = loudnessJobRef.current;
		loudnessJobRef.current = null;
		if (job) {
			try {
				await job;
			} catch {
				// Aborted or failed — safe to proceed with context teardown.
			}
		}
	}

	async function closeAudioContextAfterLoudness(): Promise<void> {
		// Abort + await so in-flight work is not reading channel views from a
		// closed AudioContext (we measure from views, not copies).
		await cancelLoudnessJob();
		if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
			await audioCtxRef.current.close();
			audioCtxRef.current = null;
		}
	}

	// Load and decode audio data when audio prop changes
	useEffect(() => {
		const generation = ++loadGenerationRef.current;

		if (!audio) {
			// Preserve the waveform shape when precomputed peaks are seeding the display;
			// only reset to null when no canonical baseline is active.
			if (!canonicalPeaksRef.current) {
				setPeaks(null);
			}
			audioBufferRef.current = null;
			// Clear the canonical baseline so the next audio load always computes fresh.
			canonicalPeaksRef.current = null;
			decodedForLoudnessRef.current = null;
			void cancelLoudnessJob().then(() => {
				loudnessAbortRef.current = null;
			});
			loudnessReportedForRef.current = null;
			prevAudioRef.current = audio;
			return;
		}

		// When the audio source genuinely changes (not the initial mount), clear the
		// canonical baseline so fresh peaks are always applied and onPeaksComputed
		// fires without comparing against stale data.
		const audioChanged = prevAudioRef.current !== audio;
		if (audioChanged) {
			canonicalPeaksRef.current = null;
			decodedForLoudnessRef.current = null;
			loudnessAbortRef.current?.abort();
			loudnessAbortRef.current = null;
			loudnessReportedForRef.current = null;
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
		// Loudness also cannot be measured without a decoded buffer; mark this source
		// so we do not attempt a late measurement if the callback is added later.
		if (canonicalPeaksRef.current) {
			loudnessReportedForRef.current = audio;
			decodedForLoudnessRef.current = null;
			return;
		}

		const loadArrayBuffer = async () => {
			try {
				await closeAudioContextAfterLoudness();
				if (loadGenerationRef.current !== generation) {
					return;
				}

				let arrayBuffer: ArrayBuffer | null = null;
				if (typeof audio === 'string') {
					const resp = await fetch(audio, { mode: 'cors' });
					if (loadGenerationRef.current !== generation) {
						return;
					}
					if (!resp.ok) {
						throw new Error(
							`Failed to fetch audio: ${resp.status} ${resp.statusText}`
						);
					}
					arrayBuffer = await resp.arrayBuffer();
					if (loadGenerationRef.current !== generation) {
						return;
					}
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
					if (loadGenerationRef.current !== generation) {
						return;
					}
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
					if (loadGenerationRef.current !== generation) {
						return;
					}
					const channelData =
						decoded.numberOfChannels > 0 ? decoded.getChannelData(0) : null;

					// Store the audio buffer for resampling
					if (channelData) {
						audioBufferRef.current = channelData;
						lastBarWidthRef.current = barWidth;
						lastGapRef.current = gap;
						lastPeakComputationWidthRef.current = peakComputationWidth;
						computePeaks(channelData);

						// Loudness reuses the already-decoded buffer — no extra fetch
						// or decodeAudioData. Channel *views* are used (no full PCM copy);
						// the AudioContext stays open until the next load awaits the job.
						scheduleLoudnessFromBuffer(decoded, audio, generation);
					}
				} catch (decodeError: any) {
					throw new Error(
						`Failed to decode audio data: ${decodeError.message || 'Unknown error'}`
					);
				}
			} catch (err: unknown) {
				if (loadGenerationRef.current !== generation) {
					return;
				}
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

		void loadArrayBuffer();
	}, [audio]);

	// Re-derive display peaks when the responsive width changes, without
	// recomputing from the audio buffer. Canonical peaks are independent of
	// display width, so onPeaksComputed must not fire here — only the resampled
	// view changes. Skipped on the first render: the initial peaks state is
	// already seeded from useState's lazy initializer.
	const lastDisplayBarCountRef = useRef<number>(displayBarCount);
	useEffect(() => {
		if (lastDisplayBarCountRef.current === displayBarCount) {
			return;
		}
		lastDisplayBarCountRef.current = displayBarCount;
		const canonical = canonicalPeaksRef.current;
		if (!canonical) {
			return;
		}
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

		if (!barWidthChanged && !gapChanged && !peakWidthChanged) {
			return;
		}

		lastBarWidthRef.current = barWidth;
		lastGapRef.current = gap;
		lastPeakComputationWidthRef.current = peakComputationWidth;

		if (audioBufferRef.current) {
			computePeaks(audioBufferRef.current);
		}
	}, [barWidth, gap, peakComputationWidth]);

	function scheduleLoudnessFromBuffer(
		decoded: AudioBuffer,
		source: string | File,
		generation: number
	) {
		// Refuse stale completions before touching abort state — otherwise a late
		// decode for track A can abort track B's in-flight measurement.
		if (loadGenerationRef.current !== generation) {
			return;
		}

		if (prevAudioRef.current !== source) {
			return;
		}

		const channelCount = decoded.numberOfChannels;
		const channels: Float32Array[] = [];
		for (let c = 0; c < channelCount; c++) {
			// Views into the AudioBuffer — no full PCM copy. Context stays open
			// until cancelLoudnessJob() completes on the next load/unmount.
			channels.push(decoded.getChannelData(c));
		}

		decodedForLoudnessRef.current = {
			source,
			generation,
			channels,
			sampleRate: decoded.sampleRate,
		};

		scheduleLoudnessFromChannels(
			channels,
			decoded.sampleRate,
			source,
			generation
		);
	}

	function scheduleLoudnessFromChannels(
		channels: Float32Array[],
		sampleRate: number,
		source: string | File,
		generation: number
	) {
		if (loadGenerationRef.current !== generation) {
			return;
		}

		if (prevAudioRef.current !== source) {
			return;
		}

		const callback = onLoudnessComputedRef.current;
		if (!callback) {
			return;
		}

		// Skip when the host already has a persisted loudness figure.
		const precomputed = precomputedLoudnessRef.current;
		if (precomputed !== undefined && precomputed !== null) {
			loudnessReportedForRef.current = source;
			return;
		}

		// Fire at most once per decoded source.
		if (loudnessReportedForRef.current === source) {
			return;
		}

		const controller = new AbortController();
		loudnessAbortRef.current = controller;

		// Mark before the async work so a second path for the same source
		// (e.g. late-attached callback effect) does not schedule a duplicate.
		loudnessReportedForRef.current = source;

		const job = computeIntegratedLoudnessAsync(channels, sampleRate, {
			signal: controller.signal,
		})
			.then((result) => {
				if (controller.signal.aborted) {
					return;
				}

				if (loadGenerationRef.current !== generation) {
					return;
				}

				// Only deliver if this source is still current.
				if (prevAudioRef.current !== source) {
					return;
				}

				onLoudnessComputedRef.current?.(result);
			})
			.catch((err: unknown) => {
				if (err instanceof Error && err.name === 'AbortError') {
					return;
				}

				console.warn('[WaveformNavigator] Loudness computation failed:', err);
			})
			.finally(() => {
				if (loudnessJobRef.current === job) {
					loudnessJobRef.current = null;
				}
			});

		loudnessJobRef.current = job;
	}

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

		// Always read the live bar count via the ref. This function is often invoked
		// from an async decode that started when the responsive fallback width was
		// still in effect; closing over `displayBarCount` would bake that oversized
		// count into the display peaks and leave the waveform denser than a later
		// visit that loads the same canonical data through precomputedPeaks.
		const targetBars = displayBarCountRef.current;
		const existing = canonicalPeaksRef.current;
		if (existing && peaksMatch(canonicalPeaks, existing)) {
			setPeaks((prev) =>
				prev && prev.length === targetBars
					? prev
					: resamplePeaks(existing, targetBars)
			);
			if (forceNotify) {
				onPeaksComputedRef.current?.(existing);
			}
		} else {
			canonicalPeaksRef.current = canonicalPeaks;
			setPeaks(resamplePeaks(canonicalPeaks, targetBars));
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
