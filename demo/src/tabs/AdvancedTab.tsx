import React, { useEffect, useState } from 'react';
import WaveformNavigator from '../../../src';

const DEMO_AUDIO_PATH = `${import.meta.env.BASE_URL}media/Demo.mp3`;

export default function AdvancedTab() {
	// Pre-computed peaks — persisted to localStorage so reloads exercise the flow
	const [savedPeaks, setSavedPeaks] = useState<Float32Array | null>(() => {
		try {
			const raw = localStorage.getItem('demo_peaks');
			if (!raw) return null;
			return new Float32Array(JSON.parse(raw) as number[]);
		} catch {
			return null;
		}
	});
	const [savedDuration, setSavedDuration] = useState<number>(() => {
		const raw = localStorage.getItem('demo_duration');
		return raw ? Number(raw) : 0;
	});
	const [usePrecomputedPeaks, setUsePrecomputedPeaks] = useState<boolean>(
		() => !!savedPeaks
	);
	const [duration, setDuration] = useState(0);

	// Preload mode
	const [preloadMode, setPreloadMode] = useState<'none' | 'metadata' | 'auto'>(
		() =>
			(localStorage.getItem('demo_preload') as 'none' | 'metadata' | 'auto') ??
			'none'
	);

	// Worker mode
	const [forceMainThread, setForceMainThread] = useState(false);

	// Error simulation
	const [testAudioPath, setTestAudioPath] = useState(DEMO_AUDIO_PATH);
	const [error, setError] = useState<string | null>(null);

	// Audio loading state
	const [audioLoading, setAudioLoading] = useState(false);

	// When rendering from saved/precomputed peaks, peaks computation is skipped,
	// so set __waveformReady here so e2e waits don't hang.
	useEffect(() => {
		if (usePrecomputedPeaks && savedPeaks) {
			(window as any).__waveformReady = true;
		}
	}, [usePrecomputedPeaks, savedPeaks]);

	return (
		<div>
			<h2>Advanced Features</h2>
			<p style={{ color: '#6b7280', marginBottom: 24 }}>
				Pre-computed peaks for instant rendering, preload mode control, Web Worker
				configuration, and error handling.
			</p>

			{/* Pre-computed peaks */}
			<div className="demo-section" style={{ backgroundColor: '#e8f8f0' }}>
				<h3 style={{ marginTop: 0 }}>⚡ Pre-computed Peaks</h3>
				<p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
					Save peaks after the first load and pass them back via{' '}
					<code>precomputedPeaks</code> to skip audio decoding on subsequent visits —
					waveform renders instantly with no network request needed.
				</p>

				<div style={{ marginBottom: 8 }}>
					<strong>Peaks captured:</strong>{' '}
					{savedPeaks ? (
						<span style={{ color: '#166534' }}>
							✅ {savedPeaks.length} bars
							{savedDuration > 0 && ` · duration: ${savedDuration.toFixed(2)}s`}{' '}
							<button
								style={{ fontSize: 11, marginLeft: 6 }}
								onClick={() => {
									setSavedPeaks(null);
									setSavedDuration(0);
									setUsePrecomputedPeaks(false);
									localStorage.removeItem('demo_peaks');
									localStorage.removeItem('demo_duration');
								}}
							>
								Clear
							</button>
						</span>
					) : (
						<span style={{ color: '#6b7280' }}>
							None yet — load the audio once to capture peaks
						</span>
					)}
				</div>

				<label className="demo-checkbox">
					<input
						type="checkbox"
						checked={usePrecomputedPeaks}
						disabled={!savedPeaks}
						onChange={(e) => setUsePrecomputedPeaks(e.target.checked)}
					/>
					<strong>Use pre-computed peaks</strong>
					{!savedPeaks && (
						<span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
							(load audio first to enable)
						</span>
					)}
				</label>

				{usePrecomputedPeaks && savedPeaks && (
					<p
						style={{ fontSize: 12, color: '#166534', marginTop: 8, marginBottom: 0 }}
					>
						✅ Waveform renders instantly from saved peaks — fetch and decode are
						skipped entirely.
					</p>
				)}
			</div>

			{/* Preload mode */}
			<div
				className="demo-section"
				style={{ backgroundColor: '#fef9ec', marginTop: 16 }}
			>
				<h3 style={{ marginTop: 0 }}>🌐 Preload Mode</h3>
				<p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
					Controls when the browser starts downloading the audio file. Open DevTools
					→ Network and watch the request fire (or not) as you switch modes.
				</p>

				<div
					style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}
				>
					{(['none', 'metadata', 'auto'] as const).map((mode) => (
						<label
							key={mode}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 4,
								cursor: 'pointer',
								padding: '4px 12px',
								borderRadius: 4,
								background: preloadMode === mode ? '#111827' : '#e5e7eb',
								color: preloadMode === mode ? '#fff' : '#111827',
								fontFamily: 'monospace',
								fontSize: 13,
							}}
						>
							<input
								type="radio"
								name="preload"
								value={mode}
								checked={preloadMode === mode}
								onChange={() => {
									setPreloadMode(mode);
									localStorage.setItem('demo_preload', mode);
								}}
								style={{ display: 'none' }}
							/>
							{mode}
						</label>
					))}
				</div>

				<p style={{ fontSize: 12, color: '#374151', margin: 0 }}>
					{preloadMode === 'none' && (
						<>
							<strong>none</strong> — no audio bytes downloaded until play is pressed.
							Best paired with <code>precomputedPeaks</code>.
						</>
					)}
					{preloadMode === 'metadata' && (
						<>
							<strong>metadata</strong> — only file headers are fetched on mount so
							duration is available immediately.
						</>
					)}
					{preloadMode === 'auto' && (
						<>
							<strong>auto</strong> — browser eagerly downloads the full audio on
							mount. Useful when playback is very likely.
						</>
					)}
				</p>
			</div>

			{/* Worker mode */}
			<div
				className="demo-section"
				style={{ backgroundColor: '#f8e8f8', marginTop: 16 }}
			>
				<h3 style={{ marginTop: 0 }}>🧵 Web Worker</h3>
				<p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
					Peak computation runs in a Web Worker by default to keep the UI thread
					free. Disable it to observe the performance difference on large files.
				</p>

				<label className="demo-checkbox">
					<input
						type="checkbox"
						checked={forceMainThread}
						onChange={(e) => setForceMainThread(e.target.checked)}
					/>
					Force main-thread processing (disable worker)
				</label>

				<p
					style={{ fontSize: 12, color: '#6b7280', marginTop: 8, marginBottom: 0 }}
				>
					{forceMainThread
						? '⚠️ Peak computation runs on main thread — may block UI for large files'
						: '✅ Using Web Worker for peak computation (default)'}
				</p>
			</div>

			{/* Loading state */}
			<div
				className="demo-section"
				style={{ backgroundColor: '#fdf4ff', marginTop: 16 }}
			>
				<h3 style={{ marginTop: 0 }}>⏳ Loading State</h3>
				<p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
					When <code>preload="none"</code> is combined with{' '}
					<code>precomputedPeaks</code>, the waveform renders instantly but the audio
					hasn&#39;t been fetched. Pressing play triggers the fetch and shows a
					spinner on the play button until enough data is buffered.
				</p>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					<span style={{ fontSize: 13 }}>Loading state:</span>
					<span
						style={{
							padding: '3px 10px',
							borderRadius: 6,
							fontSize: 13,
							fontWeight: 600,
							background: audioLoading ? '#fef3c7' : '#f0fdf4',
							color: audioLoading ? '#92400e' : '#166534',
						}}
					>
						{audioLoading ? '⏳ fetching…' : '✅ idle'}
					</span>
				</div>
				<p
					style={{ fontSize: 12, color: '#6b7280', marginTop: 8, marginBottom: 0 }}
				>
					💡 Throttle to Slow 3G in DevTools → Network, then press play to see the
					spinner.
				</p>
			</div>

			{/* Error handling */}
			<div
				className="demo-section"
				style={{ backgroundColor: '#ffe8e8', marginTop: 16 }}
			>
				<h3 style={{ marginTop: 0 }}>❌ Error Handling</h3>
				<p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
					The component surfaces load failures via the <code>onError</code> callback
					and renders an error overlay automatically.
				</p>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
					<button
						className="demo-button"
						onClick={() => {
							setError(null);
							setTestAudioPath(DEMO_AUDIO_PATH);
						}}
					>
						✅ Reset to valid audio
					</button>
					<button
						className="demo-button"
						onClick={() => {
							setError(null);
							setTestAudioPath('/nonexistent/file.mp3');
						}}
					>
						❌ Simulate 404
					</button>
					<button
						className="demo-button"
						onClick={() => {
							setError(null);
							setTestAudioPath('https://cors-test.example.com/audio.mp3');
						}}
					>
						❌ Simulate CORS error
					</button>
				</div>
				{error && (
					<p style={{ fontSize: 13, color: '#dc2626', marginBottom: 0 }}>
						<strong>onError received:</strong> {error}
					</p>
				)}
			</div>

			{/* Waveform */}
			<div style={{ marginTop: 24 }}>
				<WaveformNavigator
					audio={testAudioPath}
					height={140}
					forceMainThread={forceMainThread}
					preload={preloadMode}
					precomputedPeaks={
						usePrecomputedPeaks && savedPeaks ? savedPeaks : undefined
					}
					initialDuration={
						usePrecomputedPeaks && savedDuration > 0 ? savedDuration : undefined
					}
					onLoaded={(dur) => {
						setDuration(dur);
						setError(null);
						if (dur > 0) {
							setSavedDuration(dur);
							try {
								localStorage.setItem('demo_duration', String(dur));
							} catch {
								/* ignore */
							}
						}
					}}
					onLoadingChange={(loading) => setAudioLoading(loading)}
					onPeaksComputed={(peaks) => {
						(window as any).__waveformReady = true;
						const copy = peaks.slice();
						setSavedPeaks(copy);
						try {
							localStorage.setItem('demo_peaks', JSON.stringify(Array.from(copy)));
							if (duration > 0) {
								setSavedDuration(duration);
								localStorage.setItem('demo_duration', String(duration));
							}
						} catch {
							/* ignore */
						}
					}}
					onError={(err) => {
						setError(err.message);
					}}
				/>
			</div>
		</div>
	);
}
