import React, { useRef, useState } from 'react';
import WaveformNavigator from '../../src';
import type {
	WaveformNavigatorHandle,
	WaveformNavigatorStyles,
} from '../../src';

export default function App() {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const waveformRef = useRef<WaveformNavigatorHandle>(null);
	// Hardcoded demo audio path (served from demo/media/Demo.mp3)
	const demoAudioPath = '/media/Demo.mp3';

	// Demo controlled mode
	const [controlledTime, setControlledTime] = useState<number | undefined>(
		undefined
	);
	const [useControlled, setUseControlled] = useState(false);

	// Demo callbacks
	const [playState, setPlayState] = useState('paused');
	const [duration, setDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [peaksReady, setPeaksReady] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Demo responsive mode
	const [responsiveEnabled, setResponsiveEnabled] = useState(true);
	const [containerWidth, setContainerWidth] = useState(900);

	// Demo worker mode
	const [forceMainThread, setForceMainThread] = useState(false);

	// Demo error simulation
	const [testAudioPath, setTestAudioPath] = useState(demoAudioPath);

	// Demo ref forwarding and showControls
	const [showControls, setShowControls] = useState(true);

	// Demo style customization
	const [customStyles, setCustomStyles] = useState(false);
	const [customStylesConfig, setCustomStylesConfig] =
		useState<WaveformNavigatorStyles>({
			barColor: '#2b6ef6',
			progressColor: '#0747a6',
			backgroundColor: 'transparent',
			playheadColor: '#ff4d4f',
			playButtonColor: '#111827',
			playIconColor: '#fff',
			rewindButtonColor: '#fff',
			rewindIconColor: '#111827',
			forwardButtonColor: '#fff',
			forwardIconColor: '#111827',
			volumeSliderFillColor: '#111827',
			volumeIconColor: '#374151',
		});

	// Demo display mode
	const [displayMode, setDisplayMode] = useState<'bars' | 'analog'>('bars');

	// Display mode descriptions
	const DISPLAY_MODE_DESCRIPTIONS = {
		bars: '📊 Bar mode: Traditional visualization with bars and gaps',
		analog: '📈 Analog mode: Continuous filled waveform (analog style)',
	};

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
		<div style={{ padding: 24 }}>
			<h1>waveform-navigator demo</h1>

			<div style={{ marginBottom: 12 }}>
				<p>
					Using demo audio: <strong>media/Demo.mp3</strong>
				</p>
			</div>

			{/* Status display */}
			<div
				style={{
					marginBottom: 12,
					padding: 12,
					backgroundColor: '#f0f0f0',
					borderRadius: 4,
				}}
			>
				<h3>Status</h3>
				<p>
					<strong>Play State:</strong> {playState}
				</p>
				<p>
					<strong>Duration:</strong> {duration.toFixed(2)}s
				</p>
				<p>
					<strong>Current Time:</strong> {currentTime.toFixed(2)}s
				</p>
				<p>
					<strong>Peaks Ready:</strong> {peaksReady ? 'Yes' : 'No'}
				</p>
				<p>
					<strong>Mode:</strong> {useControlled ? 'Controlled' : 'Uncontrolled'}
				</p>
				{error && (
					<p>
						<strong style={{ color: '#dc2626' }}>Error:</strong> {error}
					</p>
				)}
			</div>

			{/* Controlled mode controls */}
			<div
				style={{
					marginBottom: 12,
					padding: 12,
					backgroundColor: '#e8f4f8',
					borderRadius: 4,
				}}
			>
				<h3>Controlled Mode Demo</h3>
				<label>
					<input
						type="checkbox"
						checked={useControlled}
						onChange={(e) => {
							setUseControlled(e.target.checked);
							if (e.target.checked) {
								setControlledTime(currentTime);
							} else {
								setControlledTime(undefined);
							}
						}}
					/>
					Enable Controlled Mode
				</label>
				{useControlled && (
					<div style={{ marginTop: 8 }}>
						<button onClick={() => setControlledTime(0)}>Jump to 0s</button>{' '}
						<button onClick={() => setControlledTime(10)}>Jump to 10s</button>{' '}
						<button onClick={() => setControlledTime(30)}>Jump to 30s</button>
					</div>
				)}
			</div>

			{/* Audio element ref demo */}
			<div
				style={{
					marginBottom: 12,
					padding: 12,
					backgroundColor: '#fff8e8',
					borderRadius: 4,
				}}
			>
				<h3>Audio Element Control Demo</h3>
				<button
					onClick={() => {
						if (audioRef.current) {
							audioRef.current.playbackRate = 0.5;
						}
					}}
				>
					0.5x Speed
				</button>{' '}
				<button
					onClick={() => {
						if (audioRef.current) {
							audioRef.current.playbackRate = 1.0;
						}
					}}
				>
					1.0x Speed
				</button>{' '}
				<button
					onClick={() => {
						if (audioRef.current) {
							audioRef.current.playbackRate = 1.5;
						}
					}}
				>
					1.5x Speed
				</button>
			</div>

			{/* Responsive mode demo */}
			<div
				style={{
					marginBottom: 12,
					padding: 12,
					backgroundColor: '#e8f8e8',
					borderRadius: 4,
				}}
			>
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
			<div
				style={{
					marginBottom: 12,
					padding: 12,
					backgroundColor: '#f8e8f8',
					borderRadius: 4,
				}}
			>
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
			<div
				style={{
					marginBottom: 12,
					padding: 12,
					backgroundColor: '#e8e8f8',
					borderRadius: 4,
				}}
			>
				<h3>Programmatic Control & Minimal UI Demo</h3>
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
						<p style={{ fontSize: 14, marginBottom: 8 }}>
							<strong>Custom Controls (using ref):</strong>
						</p>
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

			{/* Style customization demo */}
			<div
				style={{
					marginBottom: 12,
					padding: 12,
					backgroundColor: '#f0e8f8',
					borderRadius: 4,
				}}
			>
				<h3>🎨 Style Customization Demo (styles prop)</h3>
				<div style={{ marginBottom: 8 }}>
					<label>
						<input
							type="checkbox"
							checked={customStyles}
							onChange={(e) => setCustomStyles(e.target.checked)}
						/>
						Enable Custom Styles
					</label>
					<p style={{ fontSize: 12, marginTop: 4 }}>
						{customStyles
							? '🎨 Custom styles applied via styles prop'
							: '⚪ Using default styles'}
					</p>
				</div>
				{customStyles && (
					<div>
						<p style={{ fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
							Waveform Colors:
						</p>
						<div
							style={{
								marginBottom: 16,
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
								gap: 12,
							}}
						>
							<div>
								<label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
									Bar Color:
								</label>
								<input
									type="color"
									value={customStylesConfig.barColor}
									onChange={(e) =>
										setCustomStylesConfig({
											...customStylesConfig,
											barColor: e.target.value,
										})
									}
									style={{ width: '100%', height: 32, cursor: 'pointer' }}
								/>
							</div>
							<div>
								<label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
									Progress Color:
								</label>
								<input
									type="color"
									value={customStylesConfig.progressColor}
									onChange={(e) =>
										setCustomStylesConfig({
											...customStylesConfig,
											progressColor: e.target.value,
										})
									}
									style={{ width: '100%', height: 32, cursor: 'pointer' }}
								/>
							</div>
							<div>
								<label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
									Playhead Color:
								</label>
								<input
									type="color"
									value={customStylesConfig.playheadColor}
									onChange={(e) =>
										setCustomStylesConfig({
											...customStylesConfig,
											playheadColor: e.target.value,
										})
									}
									style={{ width: '100%', height: 32, cursor: 'pointer' }}
								/>
							</div>
						</div>

						<p style={{ fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
							Control Button Colors:
						</p>
						<div
							style={{
								marginBottom: 16,
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
								gap: 12,
							}}
						>
							<div>
								<label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
									Play Button:
								</label>
								<input
									type="color"
									value={customStylesConfig.playButtonColor}
									onChange={(e) =>
										setCustomStylesConfig({
											...customStylesConfig,
											playButtonColor: e.target.value,
										})
									}
									style={{ width: '100%', height: 32, cursor: 'pointer' }}
								/>
							</div>
							<div>
								<label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
									Play Icon:
								</label>
								<input
									type="color"
									value={customStylesConfig.playIconColor}
									onChange={(e) =>
										setCustomStylesConfig({
											...customStylesConfig,
											playIconColor: e.target.value,
										})
									}
									style={{ width: '100%', height: 32, cursor: 'pointer' }}
								/>
							</div>
							<div>
								<label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
									Rewind Button:
								</label>
								<input
									type="color"
									value={customStylesConfig.rewindButtonColor}
									onChange={(e) =>
										setCustomStylesConfig({
											...customStylesConfig,
											rewindButtonColor: e.target.value,
										})
									}
									style={{ width: '100%', height: 32, cursor: 'pointer' }}
								/>
							</div>
							<div>
								<label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
									Rewind Icon:
								</label>
								<input
									type="color"
									value={customStylesConfig.rewindIconColor}
									onChange={(e) =>
										setCustomStylesConfig({
											...customStylesConfig,
											rewindIconColor: e.target.value,
										})
									}
									style={{ width: '100%', height: 32, cursor: 'pointer' }}
								/>
							</div>
							<div>
								<label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
									Forward Button:
								</label>
								<input
									type="color"
									value={customStylesConfig.forwardButtonColor}
									onChange={(e) =>
										setCustomStylesConfig({
											...customStylesConfig,
											forwardButtonColor: e.target.value,
										})
									}
									style={{ width: '100%', height: 32, cursor: 'pointer' }}
								/>
							</div>
							<div>
								<label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
									Forward Icon:
								</label>
								<input
									type="color"
									value={customStylesConfig.forwardIconColor}
									onChange={(e) =>
										setCustomStylesConfig({
											...customStylesConfig,
											forwardIconColor: e.target.value,
										})
									}
									style={{ width: '100%', height: 32, cursor: 'pointer' }}
								/>
							</div>
						</div>

						<p style={{ fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
							Volume Control Colors:
						</p>
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
								gap: 12,
							}}
						>
							<div>
								<label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
									Slider Fill:
								</label>
								<input
									type="color"
									value={customStylesConfig.volumeSliderFillColor}
									onChange={(e) =>
										setCustomStylesConfig({
											...customStylesConfig,
											volumeSliderFillColor: e.target.value,
										})
									}
									style={{ width: '100%', height: 32, cursor: 'pointer' }}
								/>
							</div>
							<div>
								<label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
									Volume Icon:
								</label>
								<input
									type="color"
									value={customStylesConfig.volumeIconColor}
									onChange={(e) =>
										setCustomStylesConfig({
											...customStylesConfig,
											volumeIconColor: e.target.value,
										})
									}
									style={{ width: '100%', height: 32, cursor: 'pointer' }}
								/>
							</div>
						</div>
					</div>
				)}
				<p style={{ fontSize: 12, marginTop: 12, color: '#666' }}>
					💡 The volume icon dynamically changes based on volume level
					(muted/low/medium/high). Click the volume icon to toggle mute/unmute!
				</p>
			</div>

			{/* Display mode demo */}
			<div
				style={{
					marginBottom: 12,
					padding: 12,
					backgroundColor: '#e8f0f8',
					borderRadius: 4,
				}}
			>
				<h3>📊 Display Mode Demo</h3>
				<div style={{ marginBottom: 8 }}>
					<p style={{ fontSize: 14, marginBottom: 8 }}>
						Toggle between bar and analog waveform visualization:
					</p>
					<button
						onClick={() => setDisplayMode('bars')}
						style={{
							marginRight: 8,
							marginBottom: 8,
							padding: '8px 16px',
							backgroundColor: displayMode === 'bars' ? '#2563eb' : '#e5e7eb',
							color: displayMode === 'bars' ? '#fff' : '#000',
							border: 'none',
							borderRadius: 4,
							cursor: 'pointer',
							fontWeight: displayMode === 'bars' ? 'bold' : 'normal',
						}}
					>
						📊 Bar Mode
					</button>
					<button
						onClick={() => setDisplayMode('analog')}
						style={{
							marginBottom: 8,
							padding: '8px 16px',
							backgroundColor: displayMode === 'analog' ? '#2563eb' : '#e5e7eb',
							color: displayMode === 'analog' ? '#fff' : '#000',
							border: 'none',
							borderRadius: 4,
							cursor: 'pointer',
							fontWeight: displayMode === 'analog' ? 'bold' : 'normal',
						}}
					>
						📈 Analog Mode
					</button>
				</div>
				<p style={{ fontSize: 12, marginTop: 4, color: '#666' }}>
					{DISPLAY_MODE_DESCRIPTIONS[displayMode]}
				</p>
				<p style={{ fontSize: 12, marginTop: 4, color: '#666' }}>
					💡 The same color configuration applies to both modes. Try changing colors
					with custom styles enabled!
				</p>
			</div>

			{/* Error handling demo */}
			<div
				style={{
					marginBottom: 12,
					padding: 12,
					backgroundColor: '#ffe8e8',
					borderRadius: 4,
				}}
			>
				<h3>Error Handling Demo</h3>
				<p style={{ fontSize: 14, marginBottom: 8 }}>
					Test error scenarios by loading invalid audio:
				</p>
				<button
					onClick={() => {
						setError(null);
						setPeaksReady(false);
						setTestAudioPath(demoAudioPath);
					}}
					style={{ marginRight: 8, marginBottom: 8 }}
				>
					✅ Load Valid Audio
				</button>
				<button
					onClick={() => {
						setError(null);
						setPeaksReady(false);
						setTestAudioPath('/nonexistent/file.mp3');
					}}
					style={{ marginRight: 8, marginBottom: 8 }}
				>
					❌ Test 404 Error
				</button>
				<button
					onClick={() => {
						setError(null);
						setPeaksReady(false);
						setTestAudioPath('https://cors-test.example.com/audio.mp3');
					}}
					style={{ marginBottom: 8 }}
				>
					❌ Test CORS Error (Example)
				</button>
				<p style={{ fontSize: 12, marginTop: 8 }}>
					When an error occurs, the component displays an error overlay and calls the
					onError callback. Note: The CORS test button uses an example URL for
					demonstration purposes.
				</p>
			</div>

			<div
				style={{
					width: responsiveEnabled ? '100%' : containerWidth,
					maxWidth: containerWidth,
					transition: 'width 0.3s',
				}}
			>
				<WaveformNavigator
					ref={waveformRef}
					audio={testAudioPath}
					width={900}
					height={140}
					displayMode={displayMode}
					responsive={responsiveEnabled}
					forceMainThread={forceMainThread}
					showControls={showControls}
					controlledCurrentTime={useControlled ? controlledTime : undefined}
					onCurrentTimeChange={(time) => {
						setControlledTime(time);
					}}
					audioElementRef={audioRef}
					onPlay={() => setPlayState('playing')}
					onPause={() => setPlayState('paused')}
					onEnded={() => setPlayState('ended')}
					onLoaded={(dur) => {
						setDuration(dur);
						setError(null); // Clear error on successful load
					}}
					onTimeUpdate={(time) => setCurrentTime(time)}
					onPeaksComputed={(peaks) => {
						console.log('Peaks computed:', peaks.length, 'bars');
						setPeaksReady(true);
					}}
					onError={(err, type) => {
						console.error(`${type} error:`, err.message);
						setError(err.message);
						setPeaksReady(false);
					}}
					styles={customStyles ? customStylesConfig : undefined}
				/>
			</div>
		</div>
	);
}
