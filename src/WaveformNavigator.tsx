import React, { useState, useEffect, useImperativeHandle, useRef } from 'react';
import './styles.css';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useWaveformData } from './hooks/useWaveformData';
import { useWaveformCanvas } from './hooks/useWaveformCanvas';
import { useResponsiveWidth } from './hooks/useResponsiveWidth';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { WaveformControls } from './components/WaveformControls';
import { formatTime } from './utils';

type AudioProp = string | File | null | undefined;

export interface WaveformNavigatorHandle {
	play: () => Promise<void>;
	pause: () => void;
	seek: (time: number) => void;
	resumeAudioContext: () => Promise<void>;
}

/**
 * Props passed to the `renderButtons` render function.
 * Provides playback state and control handlers so custom button implementations
 * can fully integrate with the player without additional wiring.
 */
export interface RenderButtonsProps {
	/** Whether audio is currently playing */
	isPlaying: boolean;
	/** Whether audio is buffering/loading (mirrors the spinner on the built-in play button) */
	isLoading: boolean;
	/** Toggle play/pause */
	onTogglePlay: () => void;
	/** Seek by a relative delta in seconds (negative = rewind) */
	seek: (delta: number) => void;
	/** Seek to an absolute time in seconds */
	seekTo: (time: number) => void;
}

/**
 * Props for custom marker rendering.
 */
export interface MarkerRenderProps {
	/** Canvas 2D rendering context for drawing */
	ctx: CanvasRenderingContext2D;
	/** X position of the marker in pixels */
	x: number;
	/** Height of the waveform canvas in pixels */
	height: number;
	/** Index of the marker in the markers array */
	index: number;
	/** The marker object */
	marker: Marker;
}

/**
 * Marker definition for displaying markers on the waveform.
 */
export interface Marker {
	/** Time position in seconds where the marker should be displayed */
	time: number;
	/** Optional custom rendering function. If not provided, uses default marker appearance. */
	markup?: (props: MarkerRenderProps) => void;
}

/**
 * Style configuration for WaveformNavigator appearance.
 * All color and visual properties can be customized via this object.
 */
export interface WaveformNavigatorStyles {
	// Waveform visual styles
	barColor?: string;
	progressColor?: string;
	backgroundColor?: string;
	playheadColor?: string;
	// Marker visual styles
	markerColor?: string;
	markerLabelColor?: string;
	// Control button styles
	playButtonColor?: string;
	playIconColor?: string;
	rewindButtonColor?: string;
	rewindIconColor?: string;
	forwardButtonColor?: string;
	forwardIconColor?: string;
	// Volume control styles
	volumeSliderFillColor?: string;
	volumeIconColor?: string;
	// Time display styles
	timeColor?: string;
}

export interface WaveformNavigatorProps {
	audio: AudioProp;
	/**
	 * Fallback width in pixels used when `responsive` is false or when ResizeObserver is unavailable.
	 * When `responsive` is true (the default), the width is automatically calculated from the
	 * component’s own rendered container (e.g., the `.waveform-navigator` root element), including
	 * any horizontal padding applied to that element via CSS.
	 * @default 800
	 */
	width?: number;
	height?: number;
	className?: string;
	// visual customizations
	barWidth?: number;
	gap?: number;
	/**
	 * Style configuration object for colors and visual customization.
	 * Provides a centralized way to configure all visual aspects.
	 * Example: styles={{ barColor: '#2b6ef6', playButtonColor: '#000' }}
	 */
	styles?: WaveformNavigatorStyles;
	/**
	 * Array of markers to display on the waveform.
	 * Each marker has a time position and optional custom markup.
	 * Example: markers={[{ time: 10 }, { time: 20, markup: customRenderFn }]}
	 */
	markers?: Marker[];
	/**
	 * Pre-computed peaks for instant waveform rendering without waiting for audio to load.
	 * Accepts a `Float32Array` or plain `number[]` (e.g. from JSON-deserialized storage).
	 *
	 * Typical workflow: on the first load, capture peaks via `onPeaksComputed` and persist
	 * them. On subsequent loads, pass the saved peaks here — the waveform renders immediately
	 * using the pre-computed data while the worker verifies in the background.
	 * If the computed result differs from the provided peaks, the canvas updates and
	 * `onPeaksComputed` fires with fresh data. When the `audio` prop changes, this value
	 * is ignored so the new audio always produces a freshly computed waveform.
	 *
	 * Example: `precomputedPeaks={savedPeaksArray}`
	 */
	precomputedPeaks?: Float32Array | number[];
	/**
	 * Width in pixels used to determine how many peak samples are computed from
	 * the audio, independent of the rendered component width. Peaks are
	 * resampled at render time so the waveform fits the responsive display
	 * width. Setting this to a typical desktop width (e.g. 1400) ensures peaks
	 * captured on a small screen still look good when reloaded on a large one.
	 * @default 1400
	 */
	peakComputationWidth?: number;
	// responsive props
	responsive?: boolean;
	responsiveDebounceMs?: number;
	// worker configuration
	workerUrl?: string;
	forceMainThread?: boolean;
	// controlled props
	controlledCurrentTime?: number;
	onCurrentTimeChange?: (time: number) => void;
	audioElementRef?: React.MutableRefObject<HTMLAudioElement | null>;
	// callback events
	onPlay?: () => void;
	onPause?: () => void;
	onEnded?: () => void;
	onLoaded?: (duration: number) => void;
	onTimeUpdate?: (currentTime: number) => void;
	onPeaksComputed?: (peaks: Float32Array) => void;
	/**
	 * Called whenever the audio loading state changes.
	 * Receives `true` while the browser is fetching/buffering after play() is called,
	 * and `false` once playback starts, pauses, or errors.
	 * Mirrors the spinner that appears on the play button during loading.
	 */
	onLoadingChange?: (isLoading: boolean) => void;
	onError?: (error: Error, type: 'audio' | 'waveform') => void;
	// accessibility props
	keyboardSmallStep?: number;
	keyboardLargeStep?: number;
	disableKeyboardControls?: boolean;
	ariaLabel?: string;
	// UI control props
	showControls?: boolean;
	/**
	 * Whether to show the playback time display inside the controls bar.
	 * Has no effect when `showControls` is `false`.
	 * @default true
	 */
	showTime?: boolean;
	/**
	 * Whether to show the volume control inside the controls bar.
	 * Has no effect when `showControls` is `false`.
	 * @default true
	 */
	showVolume?: boolean;
	/**
	 * Render function that replaces the built-in rewind/play/forward button group.
	 * Receives playback state and control handlers so you can render any combination
	 * of custom buttons — including extra actions like "next track" — without losing
	 * the built-in time display and volume slider.
	 * Has no effect when `showControls` is `false`.
	 *
	 * Example:
	 * ```tsx
	 * renderButtons={({ isPlaying, onTogglePlay, seek }) => (
	 *   <>
	 *     <button onClick={() => seek(-10)}>⏮</button>
	 *     <button onClick={onTogglePlay}>{isPlaying ? '⏸' : '▶'}</button>
	 *     <button onClick={() => seek(10)}>⏭</button>
	 *     <button onClick={handleNextTrack}>Next ›</button>
	 *   </>
	 * )}
	 * ```
	 */
	renderButtons?: (props: RenderButtonsProps) => React.ReactNode;
	/**
	 * Controls the initial `preload` attribute of the underlying `<audio>` element.
	 * Defaults to `'none'` — no bytes are downloaded until the user presses play.
	 * Set to `'metadata'` to download just file headers (enabling duration display
	 * before playback), or `'auto'` to restore eager loading.
	 */
	preload?: 'none' | 'metadata' | 'auto';
	/**
	 * Seed the displayed duration (in seconds) before the audio element loads metadata.
	 * Required when combining `preload="none"` with `precomputedPeaks` — without it
	 * the waveform renders but `duration` stays 0, blocking click-to-seek.
	 * Persist this value alongside your peaks (e.g. from `onLoaded`) and pass it back
	 * on subsequent renders. The real duration from the audio element overrides it
	 * once `loadedmetadata` fires.
	 */
	initialDuration?: number;
}

const WaveformNavigator = React.forwardRef<
	WaveformNavigatorHandle,
	WaveformNavigatorProps
>((props: WaveformNavigatorProps, ref: React.Ref<WaveformNavigatorHandle>) => {
	const {
		audio,
		width = 800,
		height = 120,
		className = '',
		barWidth = 3,
		gap = 2,
		styles = {},
		markers = [],
		precomputedPeaks,
		peakComputationWidth = 1400,
		responsive = true,
		responsiveDebounceMs = 150,
		workerUrl,
		forceMainThread = false,
		controlledCurrentTime,
		onCurrentTimeChange,
		audioElementRef,
		onPlay,
		onPause,
		onEnded,
		onLoaded,
		onTimeUpdate,
		onPeaksComputed,
		onLoadingChange,
		onError,
		keyboardSmallStep = 5,
		keyboardLargeStep,
		disableKeyboardControls = false,
		ariaLabel = 'Audio waveform seek bar',
		showControls = true,
		showTime = true,
		showVolume = true,
		renderButtons,
		preload = 'none',
		initialDuration,
	} = props;
	const [hoverX, setHoverX] = useState<number | null>(null);
	const [hoverTime, setHoverTime] = useState<number | null>(null);
	const [errorState, setErrorState] = useState<{
		message: string;
		type: 'audio' | 'waveform';
	} | null>(null);

	// Blob URL lifecycle: created by useWaveformData from the shared fetch buffer;
	// owned here so it can be revoked when the audio source changes or on unmount.
	// The entry also carries the audio source it was created for so late-arriving
	// fetches can be identified and rejected.
	type BlobEntry = { url: string; forAudio: string | File | null | undefined };
	const [audioBlobUrl, setAudioBlobUrl] = useState<BlobEntry | null>(null);
	const audioBlobUrlRef = useRef<BlobEntry | null>(null);

	function handleBlobUrlReady(url: string) {
		if (audioBlobUrlRef.current) {
			URL.revokeObjectURL(audioBlobUrlRef.current.url);
		}
		const entry: BlobEntry = { url, forAudio: audio };
		audioBlobUrlRef.current = entry;
		setAudioBlobUrl(entry);
	}

	// Extract style values with defaults
	const {
		barColor = '#2b6ef6',
		progressColor = '#0747a6',
		backgroundColor = 'transparent',
		playheadColor = '#ff4d4f',
		markerColor = '#10b981',
		markerLabelColor = '#ffffff',
		playButtonColor = '#111827',
		playIconColor = '#fff',
		rewindButtonColor = '#fff',
		rewindIconColor = '#111827',
		forwardButtonColor = '#fff',
		forwardIconColor = '#111827',
		volumeSliderFillColor = '#111827',
		volumeIconColor = '#374151',
		timeColor = '#374151',
	} = styles;

	// Clear error state when audio prop changes
	useEffect(() => {
		setErrorState(null);
	}, [audio]);

	// Clear and revoke any shared Blob URL as soon as the audio source changes,
	// and also clean up on unmount. Clearing eagerly in the effect body ensures the
	// new audio value is never paired with a blob URL from a previous source.
	useEffect(() => {
		if (audioBlobUrlRef.current) {
			URL.revokeObjectURL(audioBlobUrlRef.current.url);
			audioBlobUrlRef.current = null;
		}
		setAudioBlobUrl(null);

		return () => {
			if (audioBlobUrlRef.current) {
				URL.revokeObjectURL(audioBlobUrlRef.current.url);
				audioBlobUrlRef.current = null;
			}
		};
	}, [audio]);

	// Use responsive width hook when responsive mode is enabled
	const { width: responsiveWidth, containerRef } = useResponsiveWidth({
		responsive,
		debounceMs: responsiveDebounceMs,
		fallbackWidth: width,
	});

	// Use responsive width if enabled, otherwise use the provided width prop
	const effectiveWidth = responsive ? responsiveWidth : width;

	// Use audio player hook
	const {
		audioRef,
		isPlaying,
		isLoading,
		duration,
		volume,
		setVolume,
		togglePlay,
		seek,
		seekTo,
		displayTime,
	} = useAudioPlayer({
		audio,
		audioBlobUrl: audioBlobUrl ?? undefined,
		initialDuration,
		preload,
		controlledCurrentTime,
		onCurrentTimeChange,
		audioElementRef,
		onPlay,
		onPause,
		onEnded,
		onLoaded: (dur) => {
			setErrorState(null); // Clear error on successful load
			onLoaded?.(dur);
		},
		onTimeUpdate,
		onLoadingChange,
		onError: (error) => {
			setErrorState({ message: error.message, type: 'audio' });
			onError?.(error, 'audio');
		},
	});

	// Use waveform data hook
	const { peaks } = useWaveformData({
		audio,
		width: effectiveWidth,
		barWidth,
		gap,
		precomputedPeaks,
		peakComputationWidth,
		workerUrl,
		forceMainThread,
		onBlobUrlReady: handleBlobUrlReady,
		onPeaksComputed: (peaks) => {
			setErrorState(null); // Clear error on successful peaks computation
			onPeaksComputed?.(peaks);
		},
		onError: (error) => {
			setErrorState({ message: error.message, type: 'waveform' });
			onError?.(error, 'waveform');
		},
	});

	// Use waveform canvas hook
	const { canvasRef } = useWaveformCanvas({
		width: effectiveWidth,
		height,
		barWidth,
		gap,
		barColor,
		progressColor,
		backgroundColor,
		playheadColor,
		markerColor,
		markerLabelColor,
		markers,
		peaks,
		currentTime: displayTime,
		duration,
		isPlaying,
	});

	function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect || rect.width <= 0) {
			return;
		}

		const x = e.clientX - rect.left;
		const t = (x / rect.width) * duration;
		if (!Number.isNaN(t)) {
			const newTime = Math.max(0, Math.min(duration, t));
			seekTo(newTime);
		}
	}

	function onCanvasMove(e: React.MouseEvent<HTMLCanvasElement>) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) {
			return;
		}
		const x = e.clientX - rect.left;
		setHoverX(x);
		const t = duration > 0 ? (x / rect.width) * duration : 0;
		setHoverTime(isFinite(t) ? t : null);
	}

	function onCanvasLeave() {
		setHoverX(null);
		setHoverTime(null);
	}

	function onCanvasTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
		const touch = e.touches[0];
		if (!touch) {
			return;
		}

		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect || rect.width <= 0) {
			return;
		}

		const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
		const t = (x / rect.width) * duration;
		if (!Number.isNaN(t)) {
			const newTime = Math.max(0, Math.min(duration, t));
			seekTo(newTime);
			setHoverX(x);
			setHoverTime(isFinite(newTime) ? newTime : null);
		}
	}

	function onCanvasTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
		const touch = e.touches[0];
		if (!touch) {
			return;
		}

		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect || rect.width <= 0) {
			return;
		}

		const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
		const t = (x / rect.width) * duration;
		if (!Number.isNaN(t)) {
			const newTime = Math.max(0, Math.min(duration, t));
			seekTo(newTime);
			setHoverX(x);
			setHoverTime(isFinite(newTime) ? newTime : null);
		}
	}

	function onCanvasTouchEnd() {
		setHoverX(null);
		setHoverTime(null);
	}

	// Use keyboard controls hook
	const { onKeyDown } = useKeyboardControls({
		duration,
		keyboardSmallStep,
		keyboardLargeStep,
		disableKeyboardControls,
		seek,
		seekTo,
		togglePlay,
	});

	// Expose imperative methods via ref
	useImperativeHandle(
		ref,
		() => ({
			play: async () => {
				const a = audioRef.current;
				if (!a) {
					return;
				}
				try {
					a.preload = 'auto';
					await a.play();
				} catch (error) {
					// Re-throw with context about common issues
					if (error instanceof DOMException) {
						throw new Error(
							`Failed to play audio: ${error.message}. ` +
								'On Safari/iOS, playback must be initiated by a user gesture. ' +
								'Call resumeAudioContext() first if needed.'
						);
					}
					throw error;
				}
			},
			pause: () => {
				const a = audioRef.current;
				if (!a) {
					return;
				}
				a.pause();
			},
			seek: (time: number) => {
				seekTo(time);
			},
			resumeAudioContext: async () => {
				// Resume any suspended AudioContext (needed for Safari/iOS)
				// This creates a temporary AudioContext to trigger user activation
				// which enables audio playback across the page
				const AudioContextClass =
					(window as any).AudioContext ||
					((window as any).webkitAudioContext as typeof AudioContext | undefined);
				if (!AudioContextClass) {
					return;
				}

				try {
					const tempCtx = new AudioContextClass();
					if (tempCtx.state === 'suspended') {
						await tempCtx.resume();
					}
					await tempCtx.close();
				} catch (error) {
					// Silently fail if AudioContext creation fails
					// This is a best-effort attempt to enable audio
					if (import.meta.env.DEV) {
						console.warn('Failed to resume AudioContext:', error);
					}
				}
			},
		}),
		[seekTo, audioRef]
	);

	return (
		<div ref={containerRef} className={`waveform-navigator ${className}`}>
			<div
				className="waveform-interactive"
				role="slider"
				aria-label={ariaLabel}
				aria-valuemin={0}
				aria-valuemax={duration > 0 ? duration : 1}
				aria-valuenow={displayTime}
				aria-valuetext={`${formatTime(displayTime)} of ${formatTime(duration)}`}
				tabIndex={0}
				onKeyDown={onKeyDown}
				onMouseLeave={onCanvasLeave}
			>
				<canvas
					ref={canvasRef}
					onClick={onCanvasClick}
					onMouseMove={onCanvasMove}
					onMouseLeave={onCanvasLeave}
					onTouchStart={onCanvasTouchStart}
					onTouchMove={onCanvasTouchMove}
					onTouchEnd={onCanvasTouchEnd}
					onTouchCancel={onCanvasTouchEnd}
					className="waveform-canvas"
					tabIndex={-1}
				/>

				{errorState && (
					<div className="waveform-error" role="alert" aria-live="assertive">
						<div className="waveform-error-icon" aria-hidden="true">
							⚠️
						</div>
						<div className="waveform-error-message">{errorState.message}</div>
					</div>
				)}

				{hoverX !== null && !errorState && (
					<>
						<div className="hover-line" style={{ left: `${hoverX}px` }} />
						<div className="hover-tooltip" style={{ left: `${hoverX}px` }}>
							{hoverTime !== null ? formatTime(hoverTime) : ''}
						</div>
					</>
				)}
			</div>

			{showControls && (
				<WaveformControls
					isPlaying={isPlaying}
					isLoading={isLoading}
					displayTime={displayTime}
					duration={duration}
					volume={volume}
					onTogglePlay={togglePlay}
					onSeek={seek}
					onVolumeChange={setVolume}
					seekTo={seekTo}
					showTime={showTime}
					showVolume={showVolume}
					renderButtons={renderButtons}
					styles={{
						playButtonColor,
						playIconColor,
						rewindButtonColor,
						rewindIconColor,
						forwardButtonColor,
						forwardIconColor,
						volumeSliderFillColor,
						volumeIconColor,
						timeColor,
					}}
				/>
			)}
		</div>
	);
});

// Add display name for React DevTools
WaveformNavigator.displayName = 'WaveformNavigator';

export default WaveformNavigator;
export { WaveformNavigator };
