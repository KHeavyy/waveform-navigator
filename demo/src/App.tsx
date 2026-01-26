import React, { useRef, useState } from 'react'
import WaveformNavigator from '../../src'
import type { WaveformNavigatorHandle } from '../../src'

export default function App() {
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const waveformRef = useRef<WaveformNavigatorHandle>(null)
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
	const [error, setError] = useState<string | null>(null)
	
	// Demo responsive mode
	const [responsiveEnabled, setResponsiveEnabled] = useState(true)
	const [containerWidth, setContainerWidth] = useState(900)
	
	// Demo worker mode
	const [forceMainThread, setForceMainThread] = useState(false)
	
	// Demo error simulation
	const [testAudioPath, setTestAudioPath] = useState(demoAudioPath)
	
	// Demo ref forwarding and showControls
	const [showControls, setShowControls] = useState(true)

	const handleProgrammaticPlay = async () => {
		await waveformRef.current?.resumeAudioContext()
		await waveformRef.current?.play()
	}

	const handleProgrammaticPause = () => {
		waveformRef.current?.pause()
	}

	const handleProgrammaticSeek = (time: number) => {
		waveformRef.current?.seek(time)
	}

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
				{error && (
					<p><strong style={{ color: '#dc2626' }}>Error:</strong> {error}</p>
				)}
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
			
			{/* Worker mode demo */}
			<div style={{ marginBottom: 12, padding: 12, backgroundColor: '#f8e8f8', borderRadius: 4 }}>
				<h3>Worker Mode Demo</h3>
				<label>
					<input 
						type="checkbox" 
						checked={forceMainThread} 
						onChange={(e) => setForceMainThread(e.target.checked)}
					/>
					Force Main-Thread Processing (disable worker)
				</label>
				<p style={{ fontSize: 12, marginTop: 8 }}>
					{forceMainThread 
						? '⚠️ Peak computation runs on main thread (slower for large files)' 
						: '✅ Using Web Worker for peak computation (default)'}
				</p>
			</div>
			
			{/* Ref forwarding and minimal UI demo */}
			<div style={{ marginBottom: 12, padding: 12, backgroundColor: '#e8e8f8', borderRadius: 4 }}>
				<h3>Programmatic Control & Minimal UI Demo (NEW)</h3>
				<div style={{ marginBottom: 8 }}>
					<label>
						<input 
							type="checkbox" 
							checked={showControls} 
							onChange={(e) => setShowControls(e.target.checked)}
						/>
						Show Built-in Controls
					</label>
					<p style={{ fontSize: 12, marginTop: 4 }}>
						{showControls 
							? '✅ Showing built-in playback controls' 
							: '⚠️ Controls hidden - use programmatic control below'}
					</p>
				</div>
				{!showControls && (
					<div style={{ marginTop: 12 }}>
						<p style={{ fontSize: 14, marginBottom: 8 }}><strong>Custom Controls (using ref):</strong></p>
						<button 
							onClick={handleProgrammaticPlay}
							style={{ marginRight: 8, marginBottom: 8 }}
						>
							▶️ Play (Programmatic)
						</button>
						<button 
							onClick={handleProgrammaticPause}
							style={{ marginRight: 8, marginBottom: 8 }}
						>
							⏸ Pause (Programmatic)
						</button>
						<button 
							onClick={() => handleProgrammaticSeek(0)}
							style={{ marginRight: 8, marginBottom: 8 }}
						>
							⏮ Seek to 0s
						</button>
						<button 
							onClick={() => handleProgrammaticSeek(15)}
							style={{ marginRight: 8, marginBottom: 8 }}
						>
							Seek to 15s
						</button>
						<button 
							onClick={() => handleProgrammaticSeek(30)}
							style={{ marginBottom: 8 }}
						>
							⏭ Seek to 30s
						</button>
					</div>
				)}
			</div>
			
			{/* Error handling demo */}
			<div style={{ marginBottom: 12, padding: 12, backgroundColor: '#ffe8e8', borderRadius: 4 }}>
				<h3>Error Handling Demo</h3>
				<p style={{ fontSize: 14, marginBottom: 8 }}>Test error scenarios by loading invalid audio:</p>
				<button 
					onClick={() => {
						setError(null)
						setPeaksReady(false)
						setTestAudioPath(demoAudioPath)
					}}
					style={{ marginRight: 8, marginBottom: 8 }}
				>
					✅ Load Valid Audio
				</button>
				<button 
					onClick={() => {
						setError(null)
						setPeaksReady(false)
						setTestAudioPath('/nonexistent/file.mp3')
					}}
					style={{ marginRight: 8, marginBottom: 8 }}
				>
					❌ Test 404 Error
				</button>
				<button 
					onClick={() => {
						setError(null)
						setPeaksReady(false)
						setTestAudioPath('https://cors-test.example.com/audio.mp3')
					}}
					style={{ marginBottom: 8 }}
				>
					❌ Test CORS Error (Example)
				</button>
				<p style={{ fontSize: 12, marginTop: 8 }}>
					When an error occurs, the component displays an error overlay and calls the onError callback.
					Note: The CORS test button uses an example URL for demonstration purposes.
				</p>
			</div>
			
			<div style={{ width: responsiveEnabled ? '100%' : containerWidth, maxWidth: containerWidth, transition: 'width 0.3s' }}>
				<WaveformNavigator 
					ref={waveformRef}
					audio={testAudioPath} 
					width={900} 
					height={140}
					responsive={responsiveEnabled}
					forceMainThread={forceMainThread}
					showControls={showControls}
					controlledCurrentTime={useControlled ? controlledTime : undefined}
					onCurrentTimeChange={(time) => {
						setControlledTime(time)
					}}
					audioElementRef={audioRef}
					onPlay={() => setPlayState('playing')}
					onPause={() => setPlayState('paused')}
					onEnded={() => setPlayState('ended')}
					onLoaded={(dur) => {
						setDuration(dur)
						setError(null) // Clear error on successful load
					}}
					onTimeUpdate={(time) => setCurrentTime(time)}
					onPeaksComputed={(peaks) => {
						console.log('Peaks computed:', peaks.length, 'bars')
						setPeaksReady(true)
					}}
					onError={(err, type) => {
						console.error(`${type} error:`, err.message)
						setError(err.message)
						setPeaksReady(false)
					}}
				/>
			</div>
		</div>
	)
}
