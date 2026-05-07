import React, { useRef, useEffect, useState } from 'react';
import { formatTime } from '../utils';
import type { RenderButtonsProps } from '../WaveformNavigator';

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
	timeColor?: string;
}

export interface WaveformControlsProps {
	isPlaying: boolean;
	/**
	 * When true, renders a spinning ring around the play button to indicate
	 * that audio is being fetched or buffered.
	 */
	isLoading?: boolean;
	displayTime: number;
	duration: number;
	volume: number;
	onTogglePlay: () => void;
	onSeek: (delta: number) => void;
	onVolumeChange: (volume: number) => void;
	/**
	 * Absolute seek handler forwarded from the player hook, required when
	 * a `renderButtons` function uses `seekTo`.
	 */
	seekTo?: (time: number) => void;
	/**
	 * Show the playback time display. Defaults to true.
	 */
	showTime?: boolean;
	/**
	 * Show the volume control. Defaults to true.
	 */
	showVolume?: boolean;
	/**
	 * Render function that replaces the default rewind/play/forward button group.
	 * When provided, the built-in buttons are not rendered and this function is
	 * called with current playback state and control handlers.
	 */
	renderButtons?: (props: RenderButtonsProps) => React.ReactNode;
	/**
	 * Style configuration object for control colors.
	 * Example: styles={{ playButtonColor: '#000', volumeSliderFillColor: '#f00' }}
	 */
	styles?: WaveformControlsStyles;
}

export const WaveformControls: React.FC<WaveformControlsProps> = ({
	isPlaying,
	isLoading = false,
	displayTime,
	duration,
	volume,
	onTogglePlay,
	onSeek,
	onVolumeChange,
	seekTo,
	showTime = true,
	showVolume = true,
	renderButtons,
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
		timeColor = '#374151',
	} = styles;

	const [volumeOpen, setVolumeOpen] = useState(false);
	const controlsRef = useRef<HTMLDivElement>(null);

	// Track previous volume for mute/restore functionality
	const previousVolumeRef = useRef(volume);

	// Close the volume popup when clicking outside the controls
	useEffect(() => {
		if (!volumeOpen) return;
		const handleOutside = (e: MouseEvent) => {
			if (controlsRef.current && !controlsRef.current.contains(e.target as Node)) {
				setVolumeOpen(false);
			}
		};
		document.addEventListener('mousedown', handleOutside);
		return () => document.removeEventListener('mousedown', handleOutside);
	}, [volumeOpen]);

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

	// Toggle mute/restore volume (wider containers) or expand/collapse slider (narrow containers)
	const handleVolumeIconClick = () => {
		const isNarrow = (controlsRef.current?.clientWidth ?? Infinity) <= 480;
		if (isNarrow) {
			setVolumeOpen((prev) => !prev);
		} else {
			if (volume === 0) {
				const volumeToRestore =
					previousVolumeRef.current > 0 ? previousVolumeRef.current : 0.5;
				onVolumeChange(volumeToRestore);
			} else {
				previousVolumeRef.current = volume;
				onVolumeChange(0);
			}
		}
	};
	return (
		<div ref={controlsRef} className="controls">
			{showTime && (
				<div className="left">
					<div className="time" style={{ color: timeColor }}>
						{formatTime(displayTime)} / {formatTime(duration)}
					</div>
				</div>
			)}

			<div className="center">
				{renderButtons ? (
					renderButtons({
						isPlaying,
						isLoading,
						onTogglePlay,
						seek: onSeek,
						seekTo: seekTo ?? (() => {}),
					})
				) : (
					<>
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

						<div
							className={`play-wrapper${isLoading ? ' play-wrapper--loading' : ''}`}
							style={
								{ '--play-spinner-color': playButtonColor } as React.CSSProperties
							}
						>
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
						</div>

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
					</>
				)}
			</div>

			{showVolume && (
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
					{volumeOpen && (
						<div className="vol-popup">
							<input
								className="vol-range-vertical"
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
					)}
				</div>
			)}
		</div>
	);
};
