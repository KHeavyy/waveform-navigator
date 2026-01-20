import React from 'react';
import { formatTime } from '../utils';

interface WaveformControlsProps {
	isPlaying: boolean;
	displayTime: number;
	duration: number;
	volume: number;
	onTogglePlay: () => void;
	onSeek: (delta: number) => void;
	onVolumeChange: (volume: number) => void;
}

export const WaveformControls: React.FC<WaveformControlsProps> = ({
	isPlaying,
	displayTime,
	duration,
	volume,
	onTogglePlay,
	onSeek,
	onVolumeChange
}) => {
	return (
		<div className="controls">
			<div className="left">
				<div className="time">{formatTime(displayTime)} / {formatTime(duration)}</div>
			</div>

			<div className="center">
				<button className="ctrl rewind" onClick={() => onSeek(-10)} aria-label="rewind">
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M11 19V5l-8 7 8 7zM21 19V5l-8 7 8 7z" fill="#111827" />
					</svg>
				</button>

				<button className="play" onClick={onTogglePlay} aria-label={isPlaying ? 'pause' : 'play'}>
					{isPlaying ? (
						<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
							<rect x="6" y="5" width="4" height="14" fill="#fff" />
							<rect x="14" y="5" width="4" height="14" fill="#fff" />
						</svg>
					) : (
						<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M5 3v18l15-9L5 3z" fill="#fff" />
						</svg>
					)}
				</button>

				<button className="ctrl forward" onClick={() => onSeek(10)} aria-label="forward">
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M3 5v14l8-7-8-7zm10 14V5l8 7-8 7z" fill="#111827" />
					</svg>
				</button>
			</div>

			<div className="right">
				<label className="speaker" aria-hidden>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M5 9v6h4l5 4V5L9 9H5z" fill="#374151" />
					</svg>
				</label>
				<input 
					className="vol-range" 
					type="range" 
					min="0" 
					max="1" 
					step="0.01" 
					value={volume} 
					onChange={(e) => onVolumeChange(Number(e.target.value))} 
					aria-label="volume" 
				/>
			</div>
		</div>
	);
};
