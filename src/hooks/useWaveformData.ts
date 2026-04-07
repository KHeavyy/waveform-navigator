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
	workerUrl?: string;
	forceMainThread?: boolean;
	/**
	 * Optional pre-computed peaks data for instant waveform rendering.
	 * Accepts a `Float32Array` or plain `number[]` (e.g. from JSON storage).
	 * If the bar count matches current dimensions, the waveform renders immediately
	 * without waiting for the audio to load and decode.
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
	onPeaksComputed?: (peaks: Float32Array) => void;
	onError?: (error: Error) => void;
}

interface UseWaveformDataReturn {
	peaks: Float32Array | null;
}

export function useWaveformData({
	audio,
	width,
	barWidth,
	gap,
	workerUrl,
	forceMainThread,
	precomputedPeaks,
	onBlobUrlReady,
	onPeaksComputed,
	onError,
}: UseWaveformDataProps): UseWaveformDataReturn {
	// Resample or adopt precomputedPeaks to match the current expected bar count.
	// useState and useRef only consume these values on the initial mount.
	const expectedBarCount = Math.max(1, Math.floor(width / (barWidth + gap)));
	let initialResampledPeaks: Float32Array | null = null;
	const validPrecomputed: Float32Array | null = (() => {
		if (!precomputedPeaks) return null;
		const converted =
			precomputedPeaks instanceof Float32Array
				? precomputedPeaks
				: new Float32Array(precomputedPeaks);
		const resampled = resamplePeaks(converted, expectedBarCount);
		// Track when the bar count changed so the mount effect can fire onPeaksComputed.
		if (converted.length !== expectedBarCount) {
			initialResampledPeaks = resampled;
		}
		return resampled;
	})();

	const [peaks, setPeaks] = useState<Float32Array | null>(
		() => validPrecomputed
	);
	// Comparison baseline: holds the validated precomputed peaks until audio changes.
	const precomputedPeaksRef = useRef<Float32Array | null>(validPrecomputed);
	// Holds resampled peaks from the initial mount that need to be reported via onPeaksComputed.
	const initialResampledRef = useRef<Float32Array | null>(initialResampledPeaks);
	const audioCtxRef = useRef<AudioContext | null>(null);
	const workerRef = useRef<Worker | null>(null);
	const onPeaksComputedRef = useRef(onPeaksComputed);
	const onBlobUrlReadyRef = useRef(onBlobUrlReady);
	const onErrorRef = useRef(onError);
	const audioBufferRef = useRef<Float32Array | null>(null);
	const lastWidthRef = useRef<number>(width);
	const lastBarWidthRef = useRef<number>(barWidth);
	const lastGapRef = useRef<number>(gap);
	// Tracks the previous audio value to detect genuine source changes vs. initial mount.
	const prevAudioRef = useRef<string | File | null | undefined>(audio);
	// Tracks the previous precomputedPeaks reference to detect whether it changed
	// alongside audio, preventing stale peaks from seeding a new audio source.
	const prevPrecomputedPeaksRef = useRef<
		Float32Array | number[] | null | undefined
	>(precomputedPeaks);
	// Always-current reference to the raw precomputedPeaks prop, for use in effects.
	const precomputedPeaksPropRef = useRef(precomputedPeaks);
	precomputedPeaksPropRef.current = precomputedPeaks;

	useEffect(() => {
		onPeaksComputedRef.current = onPeaksComputed;
		onBlobUrlReadyRef.current = onBlobUrlReady;
		onErrorRef.current = onError;
	}, [onPeaksComputed, onBlobUrlReady, onError]);

	// Fire onPeaksComputed once on mount when precomputedPeaks were resampled to a
	// different bar count, so callers can persist the adjusted version for future loads.
	useEffect(() => {
		if (initialResampledRef.current) {
			onPeaksComputedRef.current?.(initialResampledRef.current);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Initialize worker and cleanup when props change
	useEffect(() => {
		const worker = createPeaksWorker({ workerUrl, forceMainThread });
		workerRef.current = worker;

		if (worker) {
			worker.onmessage = (ev: MessageEvent) => {
				const msg = ev.data;
				if (msg.type === 'progress') {
					const peaksArrReceived = new Float32Array(msg.peaksBuffer);
					if (precomputedPeaksRef.current) {
						// Only update if the worker result differs from precomputed peaks.
						if (!peaksMatch(peaksArrReceived, precomputedPeaksRef.current)) {
							setPeaks(peaksArrReceived);
							onPeaksComputedRef.current?.(peaksArrReceived);
						}
					} else {
						setPeaks(peaksArrReceived);
						onPeaksComputedRef.current?.(peaksArrReceived);
					}
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
			// only reset to null when no precomputed baseline is active.
			if (!precomputedPeaksRef.current) {
				setPeaks(null);
			}
			audioBufferRef.current = null;
			// Clear the comparison baseline so the next audio load always computes fresh.
			precomputedPeaksRef.current = null;
			prevAudioRef.current = audio;
			return;
		}

		// When the audio source genuinely changes (not the initial mount), clear the
		// precomputed comparison baseline so fresh peaks are always applied and
		// onPeaksComputed fires without comparing against stale data.
		const audioChanged = prevAudioRef.current !== audio;
		if (audioChanged) {
			precomputedPeaksRef.current = null;
		}
		prevAudioRef.current = audio;

		// Only re-seed precomputedPeaksRef when precomputedPeaks itself has also changed.
		// This prevents stale peaks from seeding a newly switched audio source when the
		// parent forgets to update precomputedPeaks alongside audio.
		const precomputedChanged =
			precomputedPeaks !== prevPrecomputedPeaksRef.current;
		prevPrecomputedPeaksRef.current = precomputedPeaks;

		// Re-resample precomputed peaks for the new audio source/dimensions when the
		// ref was just cleared (audio changed) or was never populated, but only when
		// precomputedPeaks also changed (or audio didn't change) to avoid stale data.
		if (
			precomputedPeaks &&
			!precomputedPeaksRef.current &&
			(!audioChanged || precomputedChanged)
		) {
			const converted =
				precomputedPeaks instanceof Float32Array
					? precomputedPeaks
					: new Float32Array(precomputedPeaks);
			const target = Math.max(1, Math.floor(width / (barWidth + gap)));
			const resampled = resamplePeaks(converted, target);
			precomputedPeaksRef.current = resampled;
			setPeaks(resampled);
			if (converted.length !== target) {
				onPeaksComputedRef.current?.(resampled);
			}
		}

		// Skip the fetch entirely when valid pre-computed peaks are already available.
		// There is nothing to compute — the canvas already shows the correct waveform.
		if (precomputedPeaksRef.current) {
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
						lastWidthRef.current = width;
						lastBarWidthRef.current = barWidth;
						lastGapRef.current = gap;
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

	// Recompute peaks when width, barWidth, or gap changes (without re-fetching audio)
	useEffect(() => {
		const widthChanged = Math.abs(width - lastWidthRef.current) > 1;
		const barWidthChanged = barWidth !== lastBarWidthRef.current;
		const gapChanged = gap !== lastGapRef.current;

		if (!widthChanged && !barWidthChanged && !gapChanged) return;

		lastWidthRef.current = width;
		lastBarWidthRef.current = barWidth;
		lastGapRef.current = gap;

		if (audioBufferRef.current) {
			// Normal path: decoded audio is available, recompute from channel data.
			computePeaks(audioBufferRef.current);
		} else if (precomputedPeaksRef.current && precomputedPeaksPropRef.current) {
			// Responsive path with precomputedPeaks: no decoded audio buffer is available
			// because the fetch was skipped, so resample the original peaks instead.
			const converted =
				precomputedPeaksPropRef.current instanceof Float32Array
					? precomputedPeaksPropRef.current
					: new Float32Array(precomputedPeaksPropRef.current);
			const target = Math.max(1, Math.floor(width / (barWidth + gap)));
			const resampled = resamplePeaks(converted, target);
			precomputedPeaksRef.current = resampled;
			setPeaks(resampled);
			onPeaksComputedRef.current?.(resampled);
		}
	}, [width, barWidth, gap]);

	function computePeaks(channelData: Float32Array) {
		// Always compute peaks immediately on main thread for instant display
		const { peaks: peaksArr } = computePeaksFromChannelData({
			channelData,
			width,
			barWidth,
			gap,
		});

		if (precomputedPeaksRef.current) {
			// Precomputed peaks were provided: only update state and fire the callback
			// if the computed result actually differs. On a match the canvas already
			// shows the correct waveform and the parent already has the peaks, so
			// neither a re-render nor a duplicate callback is needed.
			if (!peaksMatch(peaksArr, precomputedPeaksRef.current)) {
				setPeaks(peaksArr);
				onPeaksComputedRef.current?.(peaksArr);
			}
		} else {
			// No precomputed peaks — existing behaviour: always update and notify.
			setPeaks(peaksArr);
			onPeaksComputedRef.current?.(peaksArr);
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
						width,
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
