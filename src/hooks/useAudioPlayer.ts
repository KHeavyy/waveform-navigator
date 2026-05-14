import { useEffect, useRef, useState } from 'react';

// Threshold for controlled time sync to avoid feedback loops (in seconds).
const CONTROLLED_TIME_THRESHOLD = 0.01;

// Tolerance for treating element.currentTime as "reset" relative to a saved
// position. Browsers don't always reset to exactly 0 after media eviction.
const POSITION_RESET_TOLERANCE = 0.5;

// Maximum time to wait for canplay after reloading the source during recovery.
const CANPLAY_TIMEOUT_MS = 8000;

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

	// Mirror isPlaying as a ref so non-React callbacks (visibility, focus, etc.)
	// can read the latest value without restarting their effect.
	const isPlayingRef = useRef(false);
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

	// Tracks playback intent across hide/show cycles. Set when the page hides
	// or window blurs while playing; cleared when the user pauses while the page
	// is visible AND the window is focused, on error, on ended, and when the
	// audio source changes. Pauses while hidden or blurred are treated as
	// browser-initiated and preserve the intent.
	const wasPlayingBeforeHiddenRef = useRef(false);
	const savedTimeBeforeHiddenRef = useRef(0);
	// Prevents overlapping resume attempts from rapid visibility/focus toggles.
	const resumeInFlightRef = useRef(false);
	// Tracks whether the window is currently blurred. The pause handler uses
	// this (in addition to document.hidden) to decide whether a pause was
	// user-initiated or browser-initiated.
	const isWindowBlurredRef = useRef(false);

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
		};
		const onWaitingEvent = () => {
			setIsLoading(true);
			onLoadingChangeRef.current?.(true);
		};
		const onPauseEvent = () => {
			setIsPlaying(false);
			setIsLoading(false);
			onLoadingChangeRef.current?.(false);
			// A pause is treated as user-initiated only when the page is visible
			// AND the window is focused. Pauses while hidden or blurred are
			// browser-initiated background-policy enforcement, and must preserve
			// the resume intent so the visibility/focus handler can recover.
			if (!document.hidden && !isWindowBlurredRef.current) {
				wasPlayingBeforeHiddenRef.current = false;
			}
			onPauseRef.current?.();
		};
		const onTimeEvent = () => {
			const time = el.currentTime;
			setCurrentTime(time);
			onTimeUpdateRef.current?.(time);
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
			wasPlayingBeforeHiddenRef.current = false;
			onEndedRef.current?.();
		};
		const onErrorEvent = () => {
			// An error can fire after `play` without a corresponding `pause` event,
			// leaving the UI stuck on a paused element. Reset state explicitly.
			setIsPlaying(false);
			setIsLoading(false);
			onLoadingChangeRef.current?.(false);
			wasPlayingBeforeHiddenRef.current = false;
			const error = el.error;
			if (error) {
				// Use numeric MediaError codes directly; the MediaError constructor
				// isn't exposed in every JS environment (e.g. jsdom).
				let errorMessage: string;
				switch (error.code) {
					case 1: // MEDIA_ERR_ABORTED
						errorMessage = 'Audio loading was aborted';
						break;
					case 2: // MEDIA_ERR_NETWORK
						errorMessage = 'Network error while loading audio';
						break;
					case 3: // MEDIA_ERR_DECODE
						errorMessage = 'Audio decoding failed';
						break;
					case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
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
		// Fired when the media resource is reset (browser may evict the
		// decoded buffer after long background eviction). Sync UI honestly.
		const onEmptiedEvent = () => {
			setIsPlaying(false);
			setIsLoading(false);
			onLoadingChangeRef.current?.(false);
		};

		el.addEventListener('play', onPlayEvent);
		el.addEventListener('playing', onPlayingEvent);
		el.addEventListener('waiting', onWaitingEvent);
		el.addEventListener('pause', onPauseEvent);
		el.addEventListener('timeupdate', onTimeEvent);
		el.addEventListener('loadedmetadata', onLoadedEvent);
		el.addEventListener('ended', onEndedEvent);
		el.addEventListener('error', onErrorEvent);
		el.addEventListener('emptied', onEmptiedEvent);

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
			el.removeEventListener('emptied', onEmptiedEvent);
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

	// Visibility / bfcache / window-focus reconciliation.
	//
	// Strategy: treat the audio element as the source of truth. On every
	// return-to-foreground signal, copy element state into React state, then
	// — if the user wanted playback to continue — make a single resume attempt
	// with a reload fallback. No timers, no escalating retries: the play()
	// promise tells us whether it worked.
	useEffect(() => {
		const syncFromElement = () => {
			const el = audioRef.current;
			if (!el) return;
			const elPlaying = !el.paused && !el.ended;
			if (isPlayingRef.current !== elPlaying) {
				setIsPlaying(elPlaying);
			}
			if (!isControlledRef.current) {
				setCurrentTime(el.currentTime);
			}
			setIsLoading(false);
		};

		const waitForCanPlay = (el: HTMLAudioElement, src: string) =>
			new Promise<void>((resolve, reject) => {
				let timeoutId: ReturnType<typeof setTimeout> | null = null;
				const cleanup = () => {
					if (timeoutId !== null) clearTimeout(timeoutId);
					el.removeEventListener('canplay', handleCanPlay);
					el.removeEventListener('error', handleError);
				};
				const handleCanPlay = () => {
					cleanup();
					resolve();
				};
				const handleError = () => {
					cleanup();
					reject(new Error('reload error'));
				};
				el.addEventListener('canplay', handleCanPlay);
				el.addEventListener('error', handleError);
				timeoutId = setTimeout(() => {
					cleanup();
					reject(new Error('reload timeout'));
				}, CANPLAY_TIMEOUT_MS);
				el.src = src;
				el.load();
			});

		const resumeIfNeeded = async () => {
			const el = audioRef.current;
			if (!el) return;
			if (!wasPlayingBeforeHiddenRef.current) return;
			if (!el.paused || el.ended) return;
			if (resumeInFlightRef.current) return;

			resumeInFlightRef.current = true;
			try {
				const saved = savedTimeBeforeHiddenRef.current;

				// Restore position if the browser dropped it — within a tolerance,
				// not just exact-zero, since some browsers reset to a small non-zero
				// value during eviction recovery.
				if (saved > 0 && el.currentTime < saved - POSITION_RESET_TOLERANCE) {
					try {
						el.currentTime = saved;
						if (!isControlledRef.current) {
							setCurrentTime(saved);
						}
					} catch {
						// currentTime can throw if the element has no media data yet;
						// the reload path below will restore it after canplay.
					}
				}

				try {
					await el.play();
					return;
				} catch {
					// play() rejected — the media may have been released. Fall through
					// to a full source reload.
				}

				// Bail if state changed during the await (user paused, audio swapped).
				if (!wasPlayingBeforeHiddenRef.current) return;
				if (audioRef.current !== el) return;

				const src = el.currentSrc || el.src;
				if (!src) {
					syncFromElement();
					return;
				}

				try {
					await waitForCanPlay(el, src);
				} catch {
					syncFromElement();
					return;
				}

				if (!wasPlayingBeforeHiddenRef.current) return;
				if (audioRef.current !== el) return;

				if (saved > 0) {
					try {
						el.currentTime = saved;
						if (!isControlledRef.current) {
							setCurrentTime(saved);
						}
					} catch {
						// fall through — best effort
					}
				}

				try {
					await el.play();
				} catch {
					// Give up — surface honest paused state so the user can click play.
					syncFromElement();
				}
			} finally {
				resumeInFlightRef.current = false;
			}
		};

		const captureHiddenState = () => {
			const el = audioRef.current;
			if (!el) return;
			wasPlayingBeforeHiddenRef.current = isPlayingRef.current;
			savedTimeBeforeHiddenRef.current = el.currentTime;
		};

		const handleVisibilityChange = () => {
			if (document.hidden) {
				captureHiddenState();
			} else {
				syncFromElement();
				resumeIfNeeded();
			}
		};

		// pageshow with persisted=true means a bfcache restore (Safari/mobile).
		// For non-bfcache pageshows we still sync the UI but don't auto-resume —
		// the visibilitychange handler covers normal navigation returns.
		const handlePageShow = (event: PageTransitionEvent) => {
			syncFromElement();
			if (event.persisted) {
				resumeIfNeeded();
			}
		};

		// Some platforms (Safari macOS when switching windows, not tabs) deliver
		// blur/focus without firing visibilitychange. Mirror the same logic so
		// background-paused audio still recovers on window return.
		const handleBlur = () => {
			isWindowBlurredRef.current = true;
			if (isPlayingRef.current) {
				captureHiddenState();
			}
		};
		const handleFocus = () => {
			isWindowBlurredRef.current = false;
			if (document.hidden) return;
			syncFromElement();
			resumeIfNeeded();
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('pageshow', handlePageShow);
		window.addEventListener('blur', handleBlur);
		window.addEventListener('focus', handleFocus);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('pageshow', handlePageShow);
			window.removeEventListener('blur', handleBlur);
			window.removeEventListener('focus', handleFocus);
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

		// New source — drop any pending resume intent so a stale saved position
		// doesn't get applied to the next track.
		wasPlayingBeforeHiddenRef.current = false;
		savedTimeBeforeHiddenRef.current = 0;

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
			// A rejected play() promise can otherwise leave UI thinking the
			// element is playing when it isn't.
			a.play().catch(() => {
				setIsPlaying(false);
			});
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
