import { useEffect, useRef, useState } from 'react';

// Threshold for controlled time sync to avoid feedback loops (in seconds)
const CONTROLLED_TIME_THRESHOLD = 0.01;

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
			onPauseRef.current?.();
		};
		const onTimeEvent = () => {
			const time = el.currentTime;
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
