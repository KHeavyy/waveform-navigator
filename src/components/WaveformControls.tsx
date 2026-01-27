import React, { useRef, useEffect } from 'react';
import { formatTime } from '../utils';

/**
 * Style configuration for WaveformControls appearance.
 */
export interface WaveformControlsStyles {
	playButtonColor?: string;
	playIconColor?: string;
	rewindButtonColor?: string;
	rewindIconColor?: string;
	forwardButtonColor?: string;
	forwardIconColor?: string;
	volumeSliderFillColor?: string;
	volumeIconColor?: string;
}

export interface WaveformControlsProps {
	isPlaying: boolean;
	displayTime: number;
	duration: number;
	volume: number;
	onTogglePlay: () => void;
	onSeek: (delta: number) => void;
	onVolumeChange: (volume: number) => void;
	/**
	 * Style configuration object for control colors.
	 * Example: styles={{ playButtonColor: '#000', volumeSliderFillColor: '#f00' }}
	 */
	styles?: WaveformControlsStyles;
}

export const WaveformControls: React.FC<WaveformControlsProps> = ({
	isPlaying,
	displayTime,
	duration,
	volume,
	onTogglePlay,
	onSeek,
	onVolumeChange,
	styles = {},
}) => {
	// Extract style values with defaults
	const {
		playButtonColor = '#111827',
		playIconColor = '#fff',
		rewindButtonColor = '#fff',
		rewindIconColor = '#111827',
		forwardButtonColor = '#fff',
		forwardIconColor = '#111827',
		volumeSliderFillColor = '#111827',
		volumeIconColor = '#374151',
	} = styles;

	// Track previous volume for mute/restore functionality
	const previousVolumeRef = useRef(volume);

	// Update previousVolume when volume changes to a non-zero value
	useEffect(() => {
		if (volume > 0) {
			previousVolumeRef.current = volume;
		}
	}, [volume]);

	// Determine volume icon based on current volume
	const getVolumeIcon = () => {
		if (volume === 0) {
			// Muted icon
			return (
				<svg
					viewBox="0 0 24 24"
					width="18"
					height="18"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M5 9v6h4l5 4V5L9 9H5z" fill={volumeIconColor} />
					<line
						x1="17"
						y1="8"
						x2="22"
						y2="13"
						stroke={volumeIconColor}
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<line
						x1="22"
						y1="8"
						x2="17"
						y2="13"
						stroke={volumeIconColor}
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			);
		} else if (volume < 0.5) {
			// Low volume icon
			return (
				<svg
					viewBox="0 0 24 24"
					width="18"
					height="18"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M5 9v6h4l5 4V5L9 9H5z" fill={volumeIconColor} />
					<path
						d="M15.54 8.46a5 5 0 0 1 0 7.07"
						stroke={volumeIconColor}
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			);
		} else {
			// High volume icon
			return (
				<svg
					viewBox="0 0 24 24"
					width="18"
					height="18"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M5 9v6h4l5 4V5L9 9H5z" fill={volumeIconColor} />
					<path
						d="M15.54 8.46a5 5 0 0 1 0 7.07M18.36 5.64a9 9 0 0 1 0 12.73"
						stroke={volumeIconColor}
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			);
		}
	};

	// Toggle mute/restore volume
	const handleVolumeIconClick = () => {
		if (volume === 0) {
			// Restore previous volume
			const volumeToRestore =
				previousVolumeRef.current > 0 ? previousVolumeRef.current : 0.5;
			onVolumeChange(volumeToRestore);
		} else {
			// Mute - save current volume and set to 0
			previousVolumeRef.current = volume;
			onVolumeChange(0);
		}
	};
	return (
		<div className="controls">
			<div className="left">
				<div className="time">
					{formatTime(displayTime)} / {formatTime(duration)}
				</div>
			</div>

			<div className="center">
				<button
					className="ctrl rewind"
					onClick={() => onSeek(-10)}
					aria-label="rewind"
					style={{ backgroundColor: rewindButtonColor }}
				>
					<svg
						viewBox="0 0 24 24"
						width="18"
						height="18"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
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
						<svg
							viewBox="0 0 24 24"
							width="20"
							height="20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<rect x="6" y="5" width="4" height="14" fill={playIconColor} />
							<rect x="14" y="5" width="4" height="14" fill={playIconColor} />
						</svg>
					) : (
						<svg
							viewBox="0 0 24 24"
							width="20"
							height="20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
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
					<svg
						viewBox="0 0 24 24"
						width="18"
						height="18"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path d="M3 5v14l8-7-8-7zm10 14V5l8 7-8 7z" fill={forwardIconColor} />
					</svg>
				</button>
			</div>

			<div className="right">
				<button
					className="speaker"
					onClick={handleVolumeIconClick}
					aria-label={volume === 0 ? 'unmute' : 'mute'}
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
					style={
						{
							'--volume-fill-color': volumeSliderFillColor,
							'--volume-percent': `${volume * 100}%`,
						} as React.CSSProperties
					}
				/>
			</div>
		</div>
	);
};
