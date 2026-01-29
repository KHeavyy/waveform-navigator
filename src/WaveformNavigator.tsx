import React, { useState, useEffect, useImperativeHandle } from 'react';
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
}

export interface WaveformNavigatorProps {
	audio: AudioProp;
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
	onError?: (error: Error, type: 'audio' | 'waveform') => void;
	// accessibility props
	keyboardSmallStep?: number;
	keyboardLargeStep?: number;
	disableKeyboardControls?: boolean;
	ariaLabel?: string;
	// UI control props
	showControls?: boolean;
}

const WaveformNavigator = React.forwardRef<
	WaveformNavigatorHandle,
	WaveformNavigatorProps
>(
	(
		{
			audio,
			width = 800,
			height = 120,
			className = '',
			barWidth = 3,
			gap = 2,
			styles = {},
			markers = [],
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
			onError,
			keyboardSmallStep = 5,
			keyboardLargeStep,
			disableKeyboardControls = false,
			ariaLabel = 'Audio waveform seek bar',
			showControls = true,
		},
		ref
	) => {
		const [hoverX, setHoverX] = useState<number | null>(null);
		const [hoverTime, setHoverTime] = useState<number | null>(null);
		const [errorState, setErrorState] = useState<{
			message: string;
			type: 'audio' | 'waveform';
		} | null>(null);

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
		} = styles;

		// Clear error state when audio prop changes
		useEffect(() => {
			setErrorState(null);
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
			duration,
			volume,
			setVolume,
			togglePlay,
			seek,
			seekTo,
			displayTime,
		} = useAudioPlayer({
			audio,
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
			workerUrl,
			forceMainThread,
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
			if (!rect) {
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
						if (process.env.NODE_ENV === 'development') {
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
						displayTime={displayTime}
						duration={duration}
						volume={volume}
						onTogglePlay={togglePlay}
						onSeek={seek}
						onVolumeChange={setVolume}
						styles={{
							playButtonColor,
							playIconColor,
							rewindButtonColor,
							rewindIconColor,
							forwardButtonColor,
							forwardIconColor,
							volumeSliderFillColor,
							volumeIconColor,
						}}
					/>
				)}
			</div>
		);
	}
);

// Add display name for React DevTools
WaveformNavigator.displayName = 'WaveformNavigator';

export default WaveformNavigator;
export { WaveformNavigator };
