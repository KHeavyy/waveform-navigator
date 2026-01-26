import React, { useState, useRef, useEffect } from 'react';
import { formatTime } from '../utils';

export interface WaveformControlsProps {
	isPlaying: boolean;
	displayTime: number;
	duration: number;
	volume: number;
	onTogglePlay: () => void;
	onSeek: (delta: number) => void;
	onVolumeChange: (volume: number) => void;
	// Color customization props
	playButtonColor?: string;
	playIconColor?: string;
	rewindButtonColor?: string;
	rewindIconColor?: string;
	forwardButtonColor?: string;
	forwardIconColor?: string;
	volumeSliderFillColor?: string;
}

export const WaveformControls: React.FC<WaveformControlsProps> = ({
	isPlaying,
	displayTime,
	duration,
	volume,
	onTogglePlay,
	onSeek,
	onVolumeChange,
	playButtonColor = '#111827',
	playIconColor = '#fff',
	rewindButtonColor = '#fff',
	rewindIconColor = '#111827',
	forwardButtonColor = '#fff',
	forwardIconColor = '#111827',
	volumeSliderFillColor = '#111827'
}) => {
	// Track previous volume for mute/restore functionality
	const [isMuted, setIsMuted] = useState(false);
	const previousVolumeRef = useRef(volume);

	// Update previousVolume when volume changes (but not when muting)
	useEffect(() => {
		if (volume > 0 && !isMuted) {
			previousVolumeRef.current = volume;
		}
	}, [volume, isMuted]);

	// Determine volume icon based on current volume
	const getVolumeIcon = () => {
		if (volume === 0 || isMuted) {
			// Muted icon
			return (
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M5 9v6h4l5 4V5L9 9H5z" fill="#374151" />
					<line x1="17" y1="8" x2="22" y2="13" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
					<line x1="22" y1="8" x2="17" y2="13" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
				</svg>
			);
		} else if (volume < 0.33) {
			// Low volume icon
			return (
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M5 9v6h4l5 4V5L9 9H5z" fill="#374151" />
					<path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
				</svg>
			);
		} else if (volume < 0.66) {
			// Medium volume icon
			return (
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M5 9v6h4l5 4V5L9 9H5z" fill="#374151" />
					<path d="M15.54 8.46a5 5 0 0 1 0 7.07M18.36 5.64a9 9 0 0 1 0 12.73" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
				</svg>
			);
		} else {
			// High volume icon
			return (
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M5 9v6h4l5 4V5L9 9H5z" fill="#374151" />
					<path d="M15.54 8.46a5 5 0 0 1 0 7.07M18.36 5.64a9 9 0 0 1 0 12.73M21 3a13 13 0 0 1 0 18" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
				</svg>
			);
		}
	};

	// Toggle mute/restore volume
	const handleVolumeIconClick = () => {
		if (volume === 0 || isMuted) {
			// Restore previous volume
			const volumeToRestore = previousVolumeRef.current > 0 ? previousVolumeRef.current : 0.5;
			onVolumeChange(volumeToRestore);
			setIsMuted(false);
		} else {
			// Mute
			previousVolumeRef.current = volume;
			onVolumeChange(0);
			setIsMuted(true);
		}
	};
	return (
		<div className="controls">
			<div className="left">
				<div className="time">{formatTime(displayTime)} / {formatTime(duration)}</div>
			</div>

			<div className="center">
				<button 
					className="ctrl rewind" 
					onClick={() => onSeek(-10)} 
					aria-label="rewind"
					style={{ backgroundColor: rewindButtonColor }}
				>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M11 19V5l-8 7 8 7zM21 19V5l-8 7 8 7z" fill={rewindIconColor} />
					</svg>
				</button>

				<button 
					className="play" 
					onClick={onTogglePlay} 
					aria-label={isPlaying ? 'pause' : 'play'}
					style={{ backgroundColor: playButtonColor }}
				>
					{isPlaying ? (
						<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
							<rect x="6" y="5" width="4" height="14" fill={playIconColor} />
							<rect x="14" y="5" width="4" height="14" fill={playIconColor} />
						</svg>
					) : (
						<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M5 3v18l15-9L5 3z" fill={playIconColor} />
						</svg>
					)}
				</button>

				<button 
					className="ctrl forward" 
					onClick={() => onSeek(10)} 
					aria-label="forward"
					style={{ backgroundColor: forwardButtonColor }}
				>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M3 5v14l8-7-8-7zm10 14V5l8 7-8 7z" fill={forwardIconColor} />
					</svg>
				</button>
			</div>

			<div className="right">
				<button 
					className="speaker" 
					onClick={handleVolumeIconClick}
					aria-label={volume === 0 || isMuted ? 'unmute' : 'mute'}
				>
					{getVolumeIcon()}
				</button>
				<input 
					className="vol-range" 
					type="range" 
					min="0" 
					max="1" 
					step="0.01" 
					value={volume} 
					onChange={(e) => onVolumeChange(Number(e.target.value))} 
					aria-label="volume"
					style={{
						'--volume-fill-color': volumeSliderFillColor,
						'--volume-percent': `${volume * 100}%`
					} as React.CSSProperties}
				/>
			</div>
		</div>
	);
};
