import React, { useRef, useState } from 'react'
import WaveformNavigator from '../../src'

export default function App() {
	const audioRef = useRef<HTMLAudioElement | null>(null)
	// Hardcoded demo audio path (served from demo/media/Demo.mp3)
	const demoAudioPath = '/media/Demo.mp3'
	
	// Demo controlled mode
	const [controlledTime, setControlledTime] = useState<number | undefined>(undefined)
	const [useControlled, setUseControlled] = useState(false)
	
	// Demo callbacks
	const [playState, setPlayState] = useState('paused')
	const [duration, setDuration] = useState(0)
	const [currentTime, setCurrentTime] = useState(0)
	const [peaksReady, setPeaksReady] = useState(false)
	
	// Demo responsive mode
	const [responsiveEnabled, setResponsiveEnabled] = useState(true)
	const [containerWidth, setContainerWidth] = useState(900)

	return (
		<div style={{ padding: 24 }}>
			<h1>waveform-navigator demo</h1>
			
			<div style={{ marginBottom: 12 }}>
				<p>Using demo audio: <strong>media/Demo.mp3</strong></p>
			</div>
			
			{/* Status display */}
			<div style={{ marginBottom: 12, padding: 12, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
				<h3>Status</h3>
				<p><strong>Play State:</strong> {playState}</p>
				<p><strong>Duration:</strong> {duration.toFixed(2)}s</p>
				<p><strong>Current Time:</strong> {currentTime.toFixed(2)}s</p>
				<p><strong>Peaks Ready:</strong> {peaksReady ? 'Yes' : 'No'}</p>
				<p><strong>Mode:</strong> {useControlled ? 'Controlled' : 'Uncontrolled'}</p>
			</div>
			
			{/* Controlled mode controls */}
			<div style={{ marginBottom: 12, padding: 12, backgroundColor: '#e8f4f8', borderRadius: 4 }}>
				<h3>Controlled Mode Demo</h3>
				<label>
					<input 
						type="checkbox" 
						checked={useControlled} 
						onChange={(e) => {
							setUseControlled(e.target.checked)
							if (e.target.checked) {
								setControlledTime(currentTime)
							} else {
								setControlledTime(undefined)
							}
						}}
					/>
					Enable Controlled Mode
				</label>
				{useControlled && (
					<div style={{ marginTop: 8 }}>
						<button onClick={() => setControlledTime(0)}>Jump to 0s</button>
						{' '}
						<button onClick={() => setControlledTime(10)}>Jump to 10s</button>
						{' '}
						<button onClick={() => setControlledTime(30)}>Jump to 30s</button>
					</div>
				)}
			</div>
			
			{/* Audio element ref demo */}
			<div style={{ marginBottom: 12, padding: 12, backgroundColor: '#fff8e8', borderRadius: 4 }}>
				<h3>Audio Element Control Demo</h3>
				<button onClick={() => {
					if (audioRef.current) {
						audioRef.current.playbackRate = 0.5
					}
				}}>0.5x Speed</button>
				{' '}
				<button onClick={() => {
					if (audioRef.current) {
						audioRef.current.playbackRate = 1.0
					}
				}}>1.0x Speed</button>
				{' '}
				<button onClick={() => {
					if (audioRef.current) {
						audioRef.current.playbackRate = 1.5
					}
				}}>1.5x Speed</button>
			</div>
			
			{/* Responsive mode demo */}
			<div style={{ marginBottom: 12, padding: 12, backgroundColor: '#e8f8e8', borderRadius: 4 }}>
				<h3>Responsive Mode Demo</h3>
				<label>
					<input 
						type="checkbox" 
						checked={responsiveEnabled} 
						onChange={(e) => setResponsiveEnabled(e.target.checked)}
					/>
					Enable Responsive Mode (default: true)
				</label>
				<div style={{ marginTop: 8 }}>
					<label>
						Container Width: {containerWidth}px
						<input 
							type="range" 
							min="300" 
							max="1200" 
							value={containerWidth}
							onChange={(e) => setContainerWidth(Number(e.target.value))}
							style={{ marginLeft: 8, width: 300 }}
						/>
					</label>
				</div>
				<p style={{ fontSize: 12, marginTop: 8 }}>
					{responsiveEnabled 
						? '✅ Waveform will automatically resize to match container width' 
						: '⚠️ Waveform uses fixed width prop (900px)'}
				</p>
			</div>
			
			<div style={{ width: containerWidth, border: '2px dashed #ccc', transition: 'width 0.3s' }}>
				<WaveformNavigator 
					audio={demoAudioPath} 
					width={900} 
					height={140}
					responsive={responsiveEnabled}
					controlledCurrentTime={useControlled ? controlledTime : undefined}
					onCurrentTimeChange={(time) => {
						setControlledTime(time)
					}}
					audioElementRef={audioRef}
					onPlay={() => setPlayState('playing')}
					onPause={() => setPlayState('paused')}
					onEnded={() => setPlayState('ended')}
					onLoaded={(dur) => setDuration(dur)}
					onTimeUpdate={(time) => setCurrentTime(time)}
					onPeaksComputed={(peaks) => {
						console.log('Peaks computed:', peaks.length, 'bars')
						setPeaksReady(true)
					}}
				/>
			</div>
		</div>
	)
}
