import React, { useState } from 'react';
import './styles.css';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useWaveformData } from './hooks/useWaveformData';
import { useWaveformCanvas } from './hooks/useWaveformCanvas';
import { useResponsiveWidth } from './hooks/useResponsiveWidth';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { WaveformControls } from './components/WaveformControls';
import { formatTime } from './utils';

type AudioProp = string | File | null | undefined;

export interface WaveformNavigatorProps {
	audio: AudioProp;
	width?: number;
	height?: number;
	className?: string;
	// visual customizations
	barWidth?: number;
	gap?: number;
	barColor?: string;
	progressColor?: string;
	backgroundColor?: string;
	playheadColor?: string;
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
	// accessibility props
	keyboardSmallStep?: number;
	keyboardLargeStep?: number;
	disableKeyboardControls?: boolean;
	ariaLabel?: string;
}

const WaveformNavigator: React.FC<WaveformNavigatorProps> = ({
	audio,
	width = 800,
	height = 120,
	className = '',
	barWidth = 3,
	gap = 2,
	barColor = '#2b6ef6',
	progressColor = '#0747a6',
	backgroundColor = 'transparent',
	playheadColor = '#ff4d4f',
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
	keyboardSmallStep = 5,
	keyboardLargeStep,
	disableKeyboardControls = false,
	ariaLabel = 'Audio waveform seek bar'
}) => {
	const [hoverX, setHoverX] = useState<number | null>(null);
	const [hoverTime, setHoverTime] = useState<number | null>(null);

	// Use responsive width hook when responsive mode is enabled
	const { width: responsiveWidth, containerRef } = useResponsiveWidth({
		responsive,
		debounceMs: responsiveDebounceMs,
		fallbackWidth: width
	});

	// Use responsive width if enabled, otherwise use the provided width prop
	const effectiveWidth = responsive ? responsiveWidth : width;

	// Use audio player hook
	const {
		isPlaying,
		duration,
		volume,
		setVolume,
		togglePlay,
		seek,
		seekTo,
		displayTime
	} = useAudioPlayer({
		audio,
		controlledCurrentTime,
		onCurrentTimeChange,
		audioElementRef,
		onPlay,
		onPause,
		onEnded,
		onLoaded,
		onTimeUpdate
	});

	// Use waveform data hook
	const { peaks } = useWaveformData({
		audio,
		width: effectiveWidth,
		barWidth,
		gap,
		workerUrl,
		forceMainThread,
		onPeaksComputed
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
		peaks,
		currentTime: displayTime,
		duration,
		isPlaying
	});

	function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const x = e.clientX - rect.left;
		const t = (x / rect.width) * duration;
		if (!Number.isNaN(t)) {
			const newTime = Math.max(0, Math.min(duration, t));
			seekTo(newTime);
		}
	}

	function onCanvasMove(e: React.MouseEvent<HTMLCanvasElement>) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
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
		togglePlay
	});

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
				/>

				{hoverX !== null && (
					<>
						<div className="hover-line" style={{ left: `${hoverX}px` }} />
						<div className="hover-tooltip" style={{ left: `${hoverX}px` }}>
							{hoverTime !== null ? formatTime(hoverTime) : ''}
						</div>
					</>
				)}
			</div>

			<WaveformControls
				isPlaying={isPlaying}
				displayTime={displayTime}
				duration={duration}
				volume={volume}
				onTogglePlay={togglePlay}
				onSeek={seek}
				onVolumeChange={setVolume}
			/>
		</div>
	);
};

export default WaveformNavigator;
export { WaveformNavigator };
