import { useEffect, useRef, useState } from 'react';

// Threshold for controlled time sync to avoid feedback loops (in seconds)
const CONTROLLED_TIME_THRESHOLD = 0.01;

interface UseAudioPlayerProps {
	audio: string | File | null | undefined;
	controlledCurrentTime?: number;
	onCurrentTimeChange?: (time: number) => void;
	audioElementRef?: React.MutableRefObject<HTMLAudioElement | null>;
	onPlay?: () => void;
	onPause?: () => void;
	onEnded?: () => void;
	onLoaded?: (duration: number) => void;
	onTimeUpdate?: (currentTime: number) => void;
}

interface UseAudioPlayerReturn {
	audioRef: React.MutableRefObject<HTMLAudioElement | null>;
	isPlaying: boolean;
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
	controlledCurrentTime,
	onCurrentTimeChange,
	audioElementRef,
	onPlay,
	onPause,
	onEnded,
	onLoaded,
	onTimeUpdate
}: UseAudioPlayerProps): UseAudioPlayerReturn {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const objectUrlRef = useRef<string | null>(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [duration, setDuration] = useState<number>(0);
	const [currentTime, setCurrentTime] = useState<number>(0);
	const [volume, setVolume] = useState<number>(1);

	// Refs for callbacks to avoid recreating audio element
	const onPlayRef = useRef(onPlay);
	const onPauseRef = useRef(onPause);
	const onEndedRef = useRef(onEnded);
	const onLoadedRef = useRef(onLoaded);
	const onTimeUpdateRef = useRef(onTimeUpdate);
	const onCurrentTimeChangeRef = useRef(onCurrentTimeChange);

	useEffect(() => {
		onPlayRef.current = onPlay;
		onPauseRef.current = onPause;
		onEndedRef.current = onEnded;
		onLoadedRef.current = onLoaded;
		onTimeUpdateRef.current = onTimeUpdate;
		onCurrentTimeChangeRef.current = onCurrentTimeChange;
	}, [onPlay, onPause, onEnded, onLoaded, onTimeUpdate, onCurrentTimeChange]);

	// Determine if component is in controlled mode
	const isControlled = controlledCurrentTime !== undefined;
	const isControlledRef = useRef(isControlled);

	useEffect(() => {
		isControlledRef.current = isControlled;
	}, [isControlled]);

	// Initialize audio element
	useEffect(() => {
		const el = new Audio();
		el.preload = 'auto';
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
		const onPauseEvent = () => {
			setIsPlaying(false);
			onPauseRef.current?.();
		};
		const onTimeEvent = () => {
			const time = el.currentTime;
			setCurrentTime(time);
			onTimeUpdateRef.current?.(time);
			// Always notify parent of currentTime changes so controlled mode
			// parents receive regular updates and can mirror the playhead.
			onCurrentTimeChangeRef.current?.(time);
		};
		const onLoadedEvent = () => {
			const dur = el.duration || 0;
			setDuration(dur);
			onLoadedRef.current?.(dur);
		};
		const onEndedEvent = () => {
			onEndedRef.current?.();
		};

		el.addEventListener('play', onPlayEvent);
		el.addEventListener('pause', onPauseEvent);
		el.addEventListener('timeupdate', onTimeEvent);
		el.addEventListener('loadedmetadata', onLoadedEvent);
		el.addEventListener('ended', onEndedEvent);

		return () => {
			el.pause();
			el.removeEventListener('play', onPlayEvent);
			el.removeEventListener('pause', onPauseEvent);
			el.removeEventListener('timeupdate', onTimeEvent);
			el.removeEventListener('loadedmetadata', onLoadedEvent);
			el.removeEventListener('ended', onEndedEvent);
			if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
			// Clean up ref
			if (audioElementRef) {
				audioElementRef.current = null;
			}
		};
	// audioElementRef is intentionally excluded from deps to avoid recreating audio element
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Set audio source when `audio` prop changes
	useEffect(() => {
		if (!audioRef.current) return;
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
		if (!audioRef.current) return;
		audioRef.current.volume = volume;
	}, [volume]);

	// Controlled mode: sync audio element when controlledCurrentTime changes
	useEffect(() => {
		if (isControlled && audioRef.current && controlledCurrentTime !== undefined) {
			const audio = audioRef.current;
			// Only update if there's a significant difference to avoid feedback loop
			if (Math.abs(audio.currentTime - controlledCurrentTime) > CONTROLLED_TIME_THRESHOLD) {
				audio.currentTime = controlledCurrentTime;
			}
		}
	}, [controlledCurrentTime, isControlled]);

	// Use controlled time when provided, otherwise use internal state
	const displayTime = isControlled && controlledCurrentTime !== undefined ? controlledCurrentTime : currentTime;

	function togglePlay() {
		const a = audioRef.current;
		if (!a) return;
		if (a.paused) a.play(); else a.pause();
	}

	function seek(delta: number) {
		const a = audioRef.current;
		if (!a) return;
		const newTime = Math.max(0, Math.min((a.duration || 0), a.currentTime + delta));
		seekTo(newTime);
	}

	function seekTo(time: number) {
		const a = audioRef.current;
		if (!a) return;
		if (isControlled) {
			// In controlled mode, notify parent
			onCurrentTimeChangeRef.current?.(time);
		} else {
			// In uncontrolled mode, update directly
			a.currentTime = time;
		}
	}

	return {
		audioRef,
		isPlaying,
		duration,
		currentTime,
		volume,
		setVolume,
		togglePlay,
		seek,
		seekTo,
		isControlled,
		displayTime
	};
}
