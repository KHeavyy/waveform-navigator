import React, { useState } from 'react';
import './styles.css';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useWaveformData } from './hooks/useWaveformData';
import { useWaveformCanvas } from './hooks/useWaveformCanvas';
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
	controlledCurrentTime,
	onCurrentTimeChange,
	audioElementRef,
	onPlay,
	onPause,
	onEnded,
	onLoaded,
	onTimeUpdate,
	onPeaksComputed
}) => {
	const [hoverX, setHoverX] = useState<number | null>(null);
	const [hoverTime, setHoverTime] = useState<number | null>(null);

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
		width,
		barWidth,
		gap,
		onPeaksComputed
	});

	// Use waveform canvas hook
	const { canvasRef } = useWaveformCanvas({
		width,
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

	return (
		<div className={`waveform-navigator ${className}`}>
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
