import React, { useRef, useState } from 'react';
import WaveformNavigator from '../../../src';
import type { WaveformNavigatorHandle } from '../../../src';

const DEMO_AUDIO_PATH = `${import.meta.env.BASE_URL}media/Demo.mp3`;

export default function ControlledTab() {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const waveformRef = useRef<WaveformNavigatorHandle>(null);

	const [currentTime, setCurrentTime] = useState(0);
	const [showControls, setShowControls] = useState(true);

	// Controlled mode
	const [useControlled, setUseControlled] = useState(false);
	const [controlledTime, setControlledTime] = useState<number | undefined>(
		undefined
	);

	const handleProgrammaticPlay = async () => {
		await waveformRef.current?.resumeAudioContext();
		await waveformRef.current?.play();
	};

	const handleProgrammaticPause = () => {
		waveformRef.current?.pause();
	};

	const handleProgrammaticSeek = (time: number) => {
		waveformRef.current?.seek(time);
	};

	return (
		<div>
			<h2>Programmatic &amp; Controlled Mode</h2>
			<p style={{ color: '#6b7280', marginBottom: 24 }}>
				Forward a ref to access <code>play()</code>, <code>pause()</code>, and{' '}
				<code>seek()</code> imperatively, or opt into fully controlled mode where
				the parent drives the playhead position.
			</p>

			{/* Controlled mode */}
			<div className="demo-section" style={{ backgroundColor: '#e8f4f8' }}>
				<h3 style={{ marginTop: 0 }}>Controlled Mode</h3>
				<p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
					Enable controlled mode to drive the playhead from your own state via{' '}
					<code>controlledCurrentTime</code> and <code>onCurrentTimeChange</code>.
				</p>

				<label className="demo-checkbox">
					<input
						type="checkbox"
						checked={useControlled}
						onChange={(e) => {
							setUseControlled(e.target.checked);
							setControlledTime(e.target.checked ? currentTime : undefined);
						}}
					/>
					Enable controlled mode
				</label>

				{useControlled && (
					<div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
						<button className="demo-button" onClick={() => setControlledTime(0)}>
							Jump to 0s
						</button>
						<button className="demo-button" onClick={() => setControlledTime(10)}>
							Jump to 10s
						</button>
						<button className="demo-button" onClick={() => setControlledTime(30)}>
							Jump to 30s
						</button>
					</div>
				)}
			</div>

			{/* Show/hide controls */}
			<div
				className="demo-section"
				style={{ backgroundColor: '#e8e8f8', marginTop: 16 }}
			>
				<h3 style={{ marginTop: 0 }}>Minimal UI / showControls</h3>
				<p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
					Hide the built-in controls with <code>showControls=&#123;false&#125;</code>{' '}
					and supply your own using the forwarded ref.
				</p>

				<label className="demo-checkbox">
					<input
						type="checkbox"
						checked={showControls}
						onChange={(e) => setShowControls(e.target.checked)}
					/>
					Show built-in controls
				</label>

				{!showControls && (
					<div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
						<button className="demo-button" onClick={handleProgrammaticPlay}>
							▶ Play
						</button>
						<button className="demo-button" onClick={handleProgrammaticPause}>
							⏸ Pause
						</button>
						<button className="demo-button" onClick={() => handleProgrammaticSeek(0)}>
							⏮ Seek 0s
						</button>
						<button
							className="demo-button"
							onClick={() => handleProgrammaticSeek(15)}
						>
							Seek 15s
						</button>
						<button
							className="demo-button"
							onClick={() => handleProgrammaticSeek(30)}
						>
							⏭ Seek 30s
						</button>
					</div>
				)}
			</div>

			{/* Playback rate via audioElementRef */}
			<div
				className="demo-section"
				style={{ backgroundColor: '#fff8e8', marginTop: 16 }}
			>
				<h3 style={{ marginTop: 0 }}>Audio Element Ref</h3>
				<p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
					The <code>audioElementRef</code> prop gives you direct access to the
					underlying <code>&lt;audio&gt;</code> element for things like{' '}
					<code>playbackRate</code>.
				</p>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<button
						className="demo-button"
						onClick={() => {
							if (audioRef.current) audioRef.current.playbackRate = 0.5;
						}}
					>
						0.5× speed
					</button>
					<button
						className="demo-button"
						onClick={() => {
							if (audioRef.current) audioRef.current.playbackRate = 1.0;
						}}
					>
						1.0× speed
					</button>
					<button
						className="demo-button"
						onClick={() => {
							if (audioRef.current) audioRef.current.playbackRate = 1.5;
						}}
					>
						1.5× speed
					</button>
					<button
						className="demo-button"
						onClick={() => {
							if (audioRef.current) audioRef.current.playbackRate = 2.0;
						}}
					>
						2.0× speed
					</button>
				</div>
			</div>

			<div style={{ marginTop: 24 }}>
				<p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
					Current time: <strong>{currentTime.toFixed(2)}s</strong>
					{useControlled && controlledTime !== undefined && (
						<span style={{ marginLeft: 12 }}>
							Controlled time: <strong>{controlledTime.toFixed(2)}s</strong>
						</span>
					)}
				</p>
				<WaveformNavigator
					ref={waveformRef}
					audio={DEMO_AUDIO_PATH}
					height={140}
					preload="metadata"
					showControls={showControls}
					controlledCurrentTime={useControlled ? controlledTime : undefined}
					onCurrentTimeChange={(time) => {
						setCurrentTime(time);
						if (useControlled) setControlledTime(time);
					}}
					audioElementRef={audioRef}
					onTimeUpdate={(time) => setCurrentTime(time)}
					onPeaksComputed={() => {
						(window as any).__waveformReady = true;
					}}
				/>
			</div>
		</div>
	);
}
