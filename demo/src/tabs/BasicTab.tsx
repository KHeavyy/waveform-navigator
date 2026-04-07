import React, { useRef, useState } from 'react';
import WaveformNavigator from '../../../src';
import type { WaveformNavigatorHandle } from '../../../src';

const DEMO_AUDIO_PATH = `${import.meta.env.BASE_URL}media/Demo.mp3`;

export default function BasicTab() {
	const waveformRef = useRef<WaveformNavigatorHandle>(null);

	const [playState, setPlayState] = useState('paused');
	const [audioLoading, setAudioLoading] = useState(false);
	const [duration, setDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [peaksReady, setPeaksReady] = useState(false);
	const [error, setError] = useState<string | null>(null);

	return (
		<div>
			<h2>Basic Usage</h2>
			<p style={{ color: '#6b7280', marginBottom: 24 }}>
				The component in its default configuration — loads audio, computes peaks via
				a Web Worker, and renders a responsive waveform with built-in playback
				controls.
			</p>

			{/* Status */}
			<div className="demo-section" style={{ backgroundColor: '#f9fafb' }}>
				<h3>Callbacks &amp; State</h3>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
						gap: 8,
					}}
				>
					<div className="status-item">
						<span className="status-label">Play state</span>
						<span
							className={`status-badge ${playState === 'playing' ? 'badge-green' : 'badge-grey'}`}
						>
							{playState}
						</span>
					</div>
					<div className="status-item">
						<span className="status-label">Audio loading</span>
						<span
							className={`status-badge ${audioLoading ? 'badge-yellow' : 'badge-green'}`}
						>
							{audioLoading ? 'loading…' : 'ready'}
						</span>
					</div>
					<div className="status-item">
						<span className="status-label">Duration</span>
						<span className="status-value">{duration.toFixed(2)}s</span>
					</div>
					<div className="status-item">
						<span className="status-label">Current time</span>
						<span className="status-value">{currentTime.toFixed(2)}s</span>
					</div>
					<div className="status-item">
						<span className="status-label">Peaks ready</span>
						<span
							className={`status-badge ${peaksReady ? 'badge-green' : 'badge-grey'}`}
						>
							{peaksReady ? 'yes' : 'no'}
						</span>
					</div>
				</div>
				{error && (
					<p style={{ marginTop: 8, color: '#dc2626', fontSize: 13 }}>
						<strong>Error:</strong> {error}
					</p>
				)}
			</div>

			{/* Waveform */}
			<div style={{ marginTop: 24 }}>
				<WaveformNavigator
					ref={waveformRef}
					audio={DEMO_AUDIO_PATH}
					height={140}
					preload="metadata"
					onPlay={() => setPlayState('playing')}
					onPause={() => setPlayState('paused')}
					onEnded={() => setPlayState('ended')}
					onLoadingChange={(loading) => setAudioLoading(loading)}
					onLoaded={(dur) => {
						setDuration(dur);
						setError(null);
					}}
					onTimeUpdate={(time) => setCurrentTime(time)}
					onPeaksComputed={() => {
						setPeaksReady(true);
						(window as any).__waveformReady = true;
					}}
					onError={(err) => {
						setError(err.message);
						setPeaksReady(false);
					}}
				/>
			</div>

			<div
				className="demo-section"
				style={{ marginTop: 24, backgroundColor: '#f0fdf4' }}
			>
				<h3 style={{ marginTop: 0 }}>Usage</h3>
				<pre style={{ margin: 0, fontSize: 13, overflowX: 'auto' }}>
					{`<WaveformNavigator
                        audio="/path/to/audio.mp3"
                        height={140}
                        onPlay={() => console.log('playing')}
                        onPause={() => console.log('paused')}
                        onLoaded={(duration) => console.log('loaded', duration)}
                        onPeaksComputed={(peaks) => console.log('peaks', peaks.length)}
                    />`}
				</pre>
			</div>
		</div>
	);
}
