import React, { useState } from 'react';
import WaveformNavigator from '../../../src';
import type { RenderButtonsProps } from '../../../src';

const DEMO_AUDIO_PATH = `${import.meta.env.BASE_URL}media/Demo.mp3`;

export default function CustomButtonsTab() {
	const [peaksReady, setPeaksReady] = useState(false);
	const [showTime, setShowTime] = useState(true);
	const [showVolume, setShowVolume] = useState(true);

	const renderButtons = ({
		isPlaying,
		isLoading,
		onTogglePlay,
		seek,
	}: RenderButtonsProps) => (
		<div
			style={{ display: 'flex', gap: 8, alignItems: 'center' }}
			data-testid="custom-buttons"
		>
			<button
				className="custom-ctrl"
				onClick={() => seek(-10)}
				aria-label="rewind 10 seconds"
				title="Rewind 10s"
			>
				⏮ −10s
			</button>

			<button
				className="custom-play-btn"
				onClick={onTogglePlay}
				aria-label={isPlaying ? 'pause' : 'play'}
				data-testid="custom-play-btn"
				disabled={isLoading}
				style={{
					padding: '8px 20px',
					borderRadius: 6,
					border: 'none',
					background: isPlaying ? '#dc2626' : '#111827',
					color: '#fff',
					fontWeight: 600,
					cursor: isLoading ? 'wait' : 'pointer',
					opacity: isLoading ? 0.6 : 1,
				}}
			>
				{isLoading ? '…' : isPlaying ? '⏸ Pause' : '▶ Play'}
			</button>

			<button
				className="custom-ctrl"
				onClick={() => seek(10)}
				aria-label="skip 10 seconds"
				title="Skip 10s"
			>
				+10s ⏭
			</button>

			{/* Example extra button a user might add */}
			<button
				className="custom-ctrl"
				onClick={() => alert('Next track clicked!')}
				aria-label="next track"
				data-testid="next-track-btn"
				title="Next Track"
			>
				Next ›
			</button>
		</div>
	);

	return (
		<div>
			<h2>Custom Buttons</h2>
			<p style={{ color: '#6b7280', marginBottom: 24 }}>
				Use <code>renderButtons</code> to replace the built-in rewind/play/forward
				button group with your own UI — while keeping the built-in time display and
				volume slider. Toggle <code>showTime</code> and <code>showVolume</code> to
				independently control their visibility.
			</p>

			{/* Live toggles */}
			<div
				className="demo-section"
				style={{ backgroundColor: '#f9fafb', marginBottom: 24 }}
			>
				<h3 style={{ marginTop: 0 }}>Live Controls</h3>
				<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
					<label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<input
							type="checkbox"
							checked={showTime}
							onChange={(e) => setShowTime(e.target.checked)}
							data-testid="toggle-show-time"
						/>
						<code>showTime</code>
					</label>
					<label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<input
							type="checkbox"
							checked={showVolume}
							onChange={(e) => setShowVolume(e.target.checked)}
							data-testid="toggle-show-volume"
						/>
						<code>showVolume</code>
					</label>
				</div>
			</div>

			{/* Waveform */}
			<div style={{ marginTop: 8 }}>
				<WaveformNavigator
					audio={DEMO_AUDIO_PATH}
					height={120}
					preload="metadata"
					showTime={showTime}
					showVolume={showVolume}
					renderButtons={renderButtons}
					onPeaksComputed={() => {
						setPeaksReady(true);
						(window as any).__waveformReady = true;
					}}
				/>
			</div>

			<div
				className="demo-section"
				style={{ marginTop: 24, backgroundColor: '#f0fdf4' }}
			>
				<h3 style={{ marginTop: 0 }}>Usage</h3>
				<pre
					style={{ margin: 0, fontSize: 13, overflowX: 'auto' }}
				>{`import type { RenderButtonsProps } from 'waveform-navigator';

const renderButtons = ({
  isPlaying,
  isLoading,
  onTogglePlay,
  seek,
  seekTo,
}: RenderButtonsProps) => (
  <>
    <button onClick={() => seek(-10)}>⏮ −10s</button>
    <button onClick={onTogglePlay} disabled={isLoading}>
      {isPlaying ? '⏸ Pause' : '▶ Play'}
    </button>
    <button onClick={() => seek(10)}>+10s ⏭</button>
    <button onClick={handleNextTrack}>Next ›</button>
  </>
);

<WaveformNavigator
  audio="/audio.mp3"
  renderButtons={renderButtons}
  showTime={true}   // default — keep time display
  showVolume={false} // hide volume if you handle it elsewhere
/>`}</pre>
			</div>

			<div
				className="demo-section"
				style={{ marginTop: 16, backgroundColor: '#eff6ff' }}
			>
				<h3 style={{ marginTop: 0 }}>Notes</h3>
				<ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#374151' }}>
					<li>
						<code>renderButtons</code> receives <code>isPlaying</code>,{' '}
						<code>isLoading</code>, <code>onTogglePlay</code>,{' '}
						<code>seek(delta)</code> and <code>seekTo(time)</code>.
					</li>
					<li>
						<code>showTime</code> and <code>showVolume</code> default to{' '}
						<code>true</code> — existing behaviour is unchanged unless you opt out.
					</li>
					<li>
						<code>showControls={'{false}'}</code> still hides the entire controls bar,
						regardless of the other props.
					</li>
				</ul>
			</div>

			{/* Status */}
			<div
				className="demo-section"
				style={{ backgroundColor: '#f9fafb', marginTop: 16 }}
			>
				<span className="status-label">Peaks ready: </span>
				<span
					className={`status-badge ${peaksReady ? 'badge-green' : 'badge-grey'}`}
				>
					{peaksReady ? 'yes' : 'no'}
				</span>
			</div>
		</div>
	);
}
