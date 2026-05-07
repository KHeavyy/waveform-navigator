import { useEffect, useRef, useState } from 'react';

// Threshold for controlled time sync to avoid feedback loops (in seconds)
const CONTROLLED_TIME_THRESHOLD = 0.01;

// Background-tab stall recovery constants
/** Wall-clock ms without a timeupdate event before we consider playback stalled */
const STALL_THRESHOLD_MS = 3000;
/** Maximum number of escalating recovery attempts per visibility-return cycle */
const MAX_RECOVERY_ATTEMPTS = 3;
/** Delay between escalated recovery attempts (ms) */
const RECOVERY_ESCALATION_MS = 1500;

interface UseAudioPlayerProps {
	audio: string | File | null | undefined;
	/**
	 * Blob URL created from the same ArrayBuffer fetched for peak computation,
	 * paired with the audio source it was created for. When provided and the source
	 * matches the current `audio` prop, the audio element's src is replaced with
	 * this URL so the browser does not issue a second network request.
	 */
	audioBlobUrl?: {
		url: string;
		forAudio: string | File | null | undefined;
	} | null;
	/**
	 * Seed the duration display before the audio element loads metadata.
	 * Use this alongside `preload="none"` and `precomputedPeaks` so the
	 * waveform is fully interactive (seekable) before the user presses play.
	 * The value is overridden by the real duration once `loadedmetadata` fires.
	 */
	initialDuration?: number;
	/**
	 * Controls the initial `preload` attribute of the underlying `<audio>` element.
	 * Defaults to `'none'` so no bytes are downloaded until the user presses play.
	 * Set to `'metadata'` to download just file headers (duration) on mount, or
	 * `'auto'` to restore the previous eager-loading behaviour.
	 */
	preload?: 'none' | 'metadata' | 'auto';
	controlledCurrentTime?: number;
	onCurrentTimeChange?: (time: number) => void;
	audioElementRef?: React.MutableRefObject<HTMLAudioElement | null>;
	onPlay?: () => void;
	onPause?: () => void;
	onEnded?: () => void;
	onLoaded?: (duration: number) => void;
	onTimeUpdate?: (currentTime: number) => void;
	/**
	 * Fired whenever the loading state changes. Called with `true` when the browser
	 * is fetching or buffering audio (between play() and the first `playing` event),
	 * and with `false` once playback starts, pauses, or errors.
	 */
	onLoadingChange?: (isLoading: boolean) => void;
	onError?: (error: Error) => void;
}

interface UseAudioPlayerReturn {
	audioRef: React.MutableRefObject<HTMLAudioElement | null>;
	isPlaying: boolean;
	/**
	 * True while the browser is fetching or buffering audio after play() is called.
	 * Becomes false once playback has actually started, paused, errored, or ended.
	 */
	isLoading: boolean;
	duration: number;
	currentTime: number;
	volume: number;
	setVolume: (volume: number) => void;
	togglePlay: () => void;
	seek: (delta: number) => void;
	seekTo: (time: number) => void;
	isControlled: boolean;
	displayTime: number;
}

export function useAudioPlayer({
	audio,
	audioBlobUrl,
	initialDuration,
	preload = 'none',
	controlledCurrentTime,
	onCurrentTimeChange,
	audioElementRef,
	onPlay,
	onPause,
	onEnded,
	onLoaded,
	onTimeUpdate,
	onLoadingChange,
	onError,
}: UseAudioPlayerProps): UseAudioPlayerReturn {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const objectUrlRef = useRef<string | null>(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [duration, setDuration] = useState<number>(initialDuration ?? 0);
	const [currentTime, setCurrentTime] = useState<number>(0);
	const [volume, setVolume] = useState<number>(1);

	// Refs for callbacks to avoid recreating audio element
	const onPlayRef = useRef(onPlay);
	const onPauseRef = useRef(onPause);
	const onEndedRef = useRef(onEnded);
	const onLoadedRef = useRef(onLoaded);
	const onTimeUpdateRef = useRef(onTimeUpdate);
	const onCurrentTimeChangeRef = useRef(onCurrentTimeChange);
	const onLoadingChangeRef = useRef(onLoadingChange);
	const onErrorRef = useRef(onError);

	useEffect(() => {
		isPlayingRef.current = isPlaying;
	}, [isPlaying]);

	useEffect(() => {
		onPlayRef.current = onPlay;
		onPauseRef.current = onPause;
		onEndedRef.current = onEnded;
		onLoadedRef.current = onLoaded;
		onTimeUpdateRef.current = onTimeUpdate;
		onCurrentTimeChangeRef.current = onCurrentTimeChange;
		onLoadingChangeRef.current = onLoadingChange;
		onErrorRef.current = onError;
	}, [
		onPlay,
		onPause,
		onEnded,
		onLoaded,
		onTimeUpdate,
		onCurrentTimeChange,
		onLoadingChange,
		onError,
	]);

	// Track playback state across visibility changes / bfcache restores
	const isPlayingRef = useRef(false);
	const wasPlayingBeforeHiddenRef = useRef(false);
	const savedTimeBeforeHiddenRef = useRef(0);
	// Wall-clock timestamp of the last timeupdate event — used to detect stalls
	const lastTimeupdateWallClockRef = useRef<number>(0);
	// Number of recovery attempts in the current visibility-return cycle
	const recoveryAttemptsRef = useRef<number>(0);
	// Pending escalation timeout handle
	const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Determine if component is in controlled mode
	const isControlled = controlledCurrentTime !== undefined;
	const isControlledRef = useRef(isControlled);

	useEffect(() => {
		isControlledRef.current = isControlled;
	}, [isControlled]);

	// Initialize audio element
	useEffect(() => {
		const el = new Audio();
		el.preload = preload;
		el.crossOrigin = 'anonymous';
		audioRef.current = el;

		// Expose audio element via ref if provided
		if (audioElementRef) {
			audioElementRef.current = el;
		}

		const onPlayEvent = () => {
			setIsPlaying(true);
			onPlayRef.current?.();
		};
		const onPlayingEvent = () => {
			setIsLoading(false);
			onLoadingChangeRef.current?.(false);
			// Successful playback resume — reset recovery state
			recoveryAttemptsRef.current = 0;
		};
		const onWaitingEvent = () => {
			setIsLoading(true);
			onLoadingChangeRef.current?.(true);
		};
		const onPauseEvent = () => {
			setIsPlaying(false);
			setIsLoading(false);
			onLoadingChangeRef.current?.(false);
			// User paused playback while visible — abort any in-flight recovery.
			// If hidden, this pause may come from browser background policy and
			// should not clear the saved pre-hide playing state.
			if (!document.hidden) {
				wasPlayingBeforeHiddenRef.current = false;
				recoveryAttemptsRef.current = 0;
				if (recoveryTimerRef.current) {
					clearTimeout(recoveryTimerRef.current);
					recoveryTimerRef.current = null;
				}
			}
			onPauseRef.current?.();
		};
		const onTimeEvent = () => {
			const time = el.currentTime;
			lastTimeupdateWallClockRef.current = Date.now();
			setCurrentTime(time);
			onTimeUpdateRef.current?.(time);

			// Call onCurrentTimeChange for uncontrolled mode
			if (!isControlledRef.current) {
				onCurrentTimeChangeRef.current?.(time);
			}
		};
		const onLoadedEvent = () => {
			const dur = el.duration || 0;
			setDuration(dur);
			onLoadedRef.current?.(dur);
		};
		const onEndedEvent = () => {
			setIsPlaying(false);
			setIsLoading(false);
			onLoadingChangeRef.current?.(false);
			// Track ended as a terminal state regardless of visibility so
			// background recovery does not restart playback after completion.
			wasPlayingBeforeHiddenRef.current = false;
			recoveryAttemptsRef.current = 0;
			if (recoveryTimerRef.current) {
				clearTimeout(recoveryTimerRef.current);
				recoveryTimerRef.current = null;
			}
			onEndedRef.current?.();
		};
		const onErrorEvent = () => {
			setIsLoading(false);
			onLoadingChangeRef.current?.(false);
			const error = el.error;
			if (error) {
				let errorMessage: string;
				switch (error.code) {
					case MediaError.MEDIA_ERR_ABORTED:
						errorMessage = 'Audio loading was aborted';
						break;
					case MediaError.MEDIA_ERR_NETWORK:
						errorMessage = 'Network error while loading audio';
						break;
					case MediaError.MEDIA_ERR_DECODE:
						errorMessage = 'Audio decoding failed';
						break;
					case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
						errorMessage =
							'Audio source is not supported. Check that the file format is supported by this browser and that the server allows cross-origin (CORS) access for this URL.';
						break;
					default:
						errorMessage = 'Unknown audio error occurred';
						break;
				}
				onErrorRef.current?.(new Error(errorMessage));
			}
		};

		el.addEventListener('play', onPlayEvent);
		el.addEventListener('playing', onPlayingEvent);
		el.addEventListener('waiting', onWaitingEvent);
		el.addEventListener('pause', onPauseEvent);
		el.addEventListener('timeupdate', onTimeEvent);
		el.addEventListener('loadedmetadata', onLoadedEvent);
		el.addEventListener('ended', onEndedEvent);
		el.addEventListener('error', onErrorEvent);

		return () => {
			el.pause();
			el.removeEventListener('play', onPlayEvent);
			el.removeEventListener('playing', onPlayingEvent);
			el.removeEventListener('waiting', onWaitingEvent);
			el.removeEventListener('pause', onPauseEvent);
			el.removeEventListener('timeupdate', onTimeEvent);
			el.removeEventListener('loadedmetadata', onLoadedEvent);
			el.removeEventListener('ended', onEndedEvent);
			el.removeEventListener('error', onErrorEvent);
			if (objectUrlRef.current) {
				URL.revokeObjectURL(objectUrlRef.current);
			}
			// Clean up ref
			if (audioElementRef) {
				audioElementRef.current = null;
			}
		};
		// audioElementRef is intentionally excluded from deps to avoid recreating audio element
	}, []);

	// Resume audio after the browser interrupts it (Safari background-tab pause,
	// mobile screen lock, bfcache restore). Saves playing state on hide and
	// re-calls play() when the page/tab becomes visible again.
	// Extends to stalled-not-paused recovery with bounded escalating retries.
	useEffect(() => {
		/**
		 * Returns true if the audio element appears stalled or paused and needs
		 * recovery. Three signals are checked:
		 *   1. el.paused — browser explicitly paused (e.g. Safari background policy)
		 *   2. readyState < HAVE_FUTURE_DATA — not enough buffered data to play
		 *   3. No timeupdate event in the last STALL_THRESHOLD_MS while not ended
		 *      — covers silent network stalls that don't fire an error or pause event
		 */
		const isStalled = (el: HTMLAudioElement): boolean => {
			if (el.paused) return true;
			if (el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return true;
			if (
				lastTimeupdateWallClockRef.current > 0 &&
				!el.ended &&
				Date.now() - lastTimeupdateWallClockRef.current > STALL_THRESHOLD_MS
			) {
				return true;
			}
			return false;
		};

		/**
		 * Attempts to recover stalled playback with up to MAX_RECOVERY_ATTEMPTS
		 * escalating steps:
		 *   1. Restore time (if reset) → play()
		 *   2. pause() → seek back ε → play()  (unstick demuxer)
		 *   3. Reload src → wait for canplay → restore time → play()
		 *
		 * Each step schedules the next via setTimeout so we give the browser a
		 * chance to recover on its own. Recovery is aborted if:
		 *   - isPlayingRef goes true (recovery worked)
		 *   - wasPlayingBeforeHiddenRef is cleared (user paused or new tab-hide)
		 *   - MAX_RECOVERY_ATTEMPTS is reached
		 */
		const recoverPlayback = (el: HTMLAudioElement, savedTime: number) => {
			if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) return;

			recoveryAttemptsRef.current += 1;
			const attempt = recoveryAttemptsRef.current;

			const scheduleNext = () => {
				recoveryTimerRef.current = setTimeout(() => {
					recoveryTimerRef.current = null;
					// Abort if playback resumed naturally or user hid the tab again
					if (isPlayingRef.current || !wasPlayingBeforeHiddenRef.current) return;
					const currentEl = audioRef.current;
					if (!currentEl || !isStalled(currentEl)) return;
					recoverPlayback(currentEl, savedTime);
				}, RECOVERY_ESCALATION_MS);
			};

			if (attempt === 1) {
				// Step 1: restore time if browser reset it, then try play()
				if (el.currentTime === 0 && savedTime > 0) {
					el.currentTime = savedTime;
					if (!isControlledRef.current) {
						setCurrentTime(savedTime);
					}
				}
				el.play().catch(() => {});
				scheduleNext();
			} else if (attempt === 2) {
				// Step 2: force a seek to unstick the demuxer, then play()
				const target = Math.max(0, savedTime - 0.1);
				el.pause();
				el.currentTime = target;
				el.play().catch(() => {});
				scheduleNext();
			} else {
				// Step 3: reload the source, restore position after canplay, then play()
				const src = el.currentSrc || el.src;
				if (!src) return;

				const onCanPlay = () => {
					el.removeEventListener('canplay', onCanPlay);
					if (!wasPlayingBeforeHiddenRef.current) return;
					el.currentTime = savedTime;
					if (!isControlledRef.current) {
						setCurrentTime(savedTime);
					}
					el.play().catch(() => {});
				};
				el.addEventListener('canplay', onCanPlay);
				el.src = src;
				el.load();
			}
		};

		const handleVisibilityChange = () => {
			const el = audioRef.current;
			if (!el) return;

			if (document.hidden) {
				// Save state before hide; clear any in-progress recovery
				wasPlayingBeforeHiddenRef.current = isPlayingRef.current;
				savedTimeBeforeHiddenRef.current = el.currentTime;
				// Browsers may throttle/suppress `timeupdate` while hidden.
				// Reset the wall clock baseline so hidden time isn't treated as a stall.
				lastTimeupdateWallClockRef.current = Date.now();
				if (recoveryTimerRef.current) {
					clearTimeout(recoveryTimerRef.current);
					recoveryTimerRef.current = null;
				}
				recoveryAttemptsRef.current = 0;
			} else if (wasPlayingBeforeHiddenRef.current) {
				const progressedWhileHidden =
					el.currentTime >
					savedTimeBeforeHiddenRef.current + CONTROLLED_TIME_THRESHOLD;
				if (progressedWhileHidden) {
					lastTimeupdateWallClockRef.current = Date.now();
					recoveryAttemptsRef.current = 0;
					return;
				}
				if (isStalled(el)) {
					recoverPlayback(el, savedTimeBeforeHiddenRef.current);
				}
			}
		};

		// pageshow fires with persisted=true when the page is restored from bfcache
		// (common on mobile Safari). visibilitychange may not fire in that path.
		const handlePageShow = (event: PageTransitionEvent) => {
			if (!event.persisted) return;
			const el = audioRef.current;
			if (!el) return;

			if (wasPlayingBeforeHiddenRef.current && isStalled(el)) {
				recoverPlayback(el, savedTimeBeforeHiddenRef.current);
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('pageshow', handlePageShow);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('pageshow', handlePageShow);
			if (recoveryTimerRef.current) {
				clearTimeout(recoveryTimerRef.current);
				recoveryTimerRef.current = null;
			}
		};
	}, []);

	// When a Blob URL derived from the waveform fetch is available, point the
	// audio element at it so the browser reuses the already-downloaded data.
	// Only switch if playback has not yet started to avoid interrupting a stream
	// that the user initiated before the fetch completed.
	// Guard: reject blob URLs that were created for a different audio source to
	// prevent a late-arriving fetch from overriding a subsequently loaded track.
	useEffect(() => {
		if (!audioBlobUrl || !audioRef.current || typeof audio !== 'string') {
			return;
		}
		if (audioBlobUrl.forAudio !== audio) {
			return;
		}
		const el = audioRef.current;
		if (el.paused && el.currentTime === 0) {
			el.src = audioBlobUrl.url;
		}
	}, [audioBlobUrl, audio]);

	// Sync the preload attribute whenever the prop changes after mount.
	useEffect(() => {
		if (audioRef.current) {
			audioRef.current.preload = preload;
		}
	}, [preload]);

	// Set audio source when `audio` prop changes
	useEffect(() => {
		if (!audioRef.current) {
			return;
		}
		const el = audioRef.current;

		// New source — reset recovery state so a fresh recovery cycle can start
		recoveryAttemptsRef.current = 0;
		wasPlayingBeforeHiddenRef.current = false;
		if (recoveryTimerRef.current) {
			clearTimeout(recoveryTimerRef.current);
			recoveryTimerRef.current = null;
		}

		// Cleanup previous
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = null;
		}

		if (!audio) {
			el.src = '';
			return;
		}

		if (typeof audio === 'string') {
			el.src = audio;
		} else if (audio instanceof File) {
			const url = URL.createObjectURL(audio);
			objectUrlRef.current = url;
			el.src = url;
		}
	}, [audio]);

	// Sync volume
	useEffect(() => {
		if (!audioRef.current) {
			return;
		}
		audioRef.current.volume = volume;
	}, [volume]);

	// Controlled mode: sync audio element when controlledCurrentTime changes
	useEffect(() => {
		if (isControlled && audioRef.current && controlledCurrentTime !== undefined) {
			const audio = audioRef.current;
			// Only update if there's a significant difference to avoid feedback loop
			if (
				Math.abs(audio.currentTime - controlledCurrentTime) >
				CONTROLLED_TIME_THRESHOLD
			) {
				audio.currentTime = controlledCurrentTime;
			}
		}
	}, [controlledCurrentTime, isControlled]);

	// Use controlled time when provided, otherwise use internal state
	const displayTime =
		isControlled && controlledCurrentTime !== undefined
			? controlledCurrentTime
			: currentTime;

	function togglePlay() {
		const a = audioRef.current;
		if (!a) {
			return;
		}
		if (a.paused) {
			a.preload = 'auto';
			a.play();
		} else {
			a.pause();
		}
	}

	function seek(delta: number) {
		const a = audioRef.current;
		if (!a) {
			return;
		}
		const newTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + delta));
		seekTo(newTime);
	}

	function seekTo(time: number) {
		const a = audioRef.current;
		if (!a) {
			return;
		}
		if (isControlled) {
			// In controlled mode, notify parent
			onCurrentTimeChangeRef.current?.(time);
		} else {
			// In uncontrolled mode, update directly.
			// Also update state immediately — with preload="none" the browser doesn't
			// fire timeupdate when currentTime is set before media data is loaded,
			// so we can't rely on the event to move the playhead.
			a.currentTime = time;
			setCurrentTime(time);
			onCurrentTimeChangeRef.current?.(time);
		}
	}

	return {
		audioRef,
		isPlaying,
		isLoading,
		duration,
		currentTime,
		volume,
		setVolume,
		togglePlay,
		seek,
		seekTo,
		isControlled,
		displayTime,
	};
}
