import React, { useEffect, useRef, useState } from 'react';
import './styles.css';

type AudioProp = string | File | null | undefined;

export interface WaveformNavigatorProps {
	audio: AudioProp;
	width?: number;
	height?: number;
	className?: string;
	// visual customizations
	barWidth?: number;
	gap?: number;
	barColor?: string;
	progressColor?: string;
	backgroundColor?: string;
	playheadColor?: string;
	// controlled props
	controlledCurrentTime?: number;
	onCurrentTimeChange?: (time: number) => void;
	audioElementRef?: React.RefObject<HTMLAudioElement>;
	// callback events
	onPlay?: () => void;
	onPause?: () => void;
	onEnded?: () => void;
	onLoaded?: (duration: number) => void;
	onTimeUpdate?: (currentTime: number) => void;
	onPeaksComputed?: (peaks: Float32Array) => void;
}

const WaveformNavigator: React.FC<WaveformNavigatorProps> = ({
	audio,
	width = 800,
	height = 120,
	className = '',
	barWidth = 3,
	gap = 2,
	barColor = '#2b6ef6',
	progressColor = '#0747a6',
	backgroundColor = 'transparent',
	playheadColor = '#ff4d4f',
	controlledCurrentTime,
	onCurrentTimeChange,
	audioElementRef,
	onPlay,
	onPause,
	onEnded,
	onLoaded,
	onTimeUpdate,
	onPeaksComputed
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const objectUrlRef = useRef<string | null>(null);
	const audioCtxRef = useRef<AudioContext | null>(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [duration, setDuration] = useState<number>(0);
	const [currentTime, setCurrentTime] = useState<number>(0);
	const [volume, setVolume] = useState<number>(1);
	const [peaks, setPeaks] = useState<Float32Array | null>(null);
	const [hoverX, setHoverX] = useState<number | null>(null);
	const [hoverTime, setHoverTime] = useState<number | null>(null);

	// requestAnimationFrame id for smooth progress updates
	const rafRef = useRef<number | null>(null);

	// worker ref for peak computation
	const workerRef = useRef<Worker | null>(null);

// Initialize audio element
	useEffect(() => {
		const el = new Audio();
		el.preload = 'auto';
		el.crossOrigin = 'anonymous';
		audioRef.current = el;
		
		// Expose audio element via ref if provided
		if (audioElementRef) {
			(audioElementRef as React.MutableRefObject<HTMLAudioElement | null>).current = el;
		}

		const onPlayEvent = () => {
			setIsPlaying(true);
			onPlay?.();
		};
		const onPauseEvent = () => {
			setIsPlaying(false);
			onPause?.();
		};
		const onTimeEvent = () => {
			const time = el.currentTime;
			setCurrentTime(time);
			onTimeUpdate?.(time);
			// Call onCurrentTimeChange for controlled mode
			if (controlledCurrentTime === undefined) {
				onCurrentTimeChange?.(time);
			}
		};
		const onLoadedEvent = () => {
			const dur = el.duration || 0;
			setDuration(dur);
			onLoaded?.(dur);
		};
		const onEndedEvent = () => {
			onEnded?.();
		};

		el.addEventListener('play', onPlayEvent);
		el.addEventListener('pause', onPauseEvent);
		el.addEventListener('timeupdate', onTimeEvent);
		el.addEventListener('loadedmetadata', onLoadedEvent);
		el.addEventListener('ended', onEndedEvent);

		return () => {
			el.pause();
			el.removeEventListener('play', onPlayEvent);
			el.removeEventListener('pause', onPauseEvent);
			el.removeEventListener('timeupdate', onTimeEvent);
			el.removeEventListener('loadedmetadata', onLoadedEvent);
			el.removeEventListener('ended', onEndedEvent);
			if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
			if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
				audioCtxRef.current.close();
			}
			if (workerRef.current) {
				workerRef.current.postMessage({ type: 'terminate' });
				workerRef.current.terminate();
				workerRef.current = null;
			}
			// Clean up ref
			if (audioElementRef) {
				(audioElementRef as React.MutableRefObject<HTMLAudioElement | null>).current = null;
			}
		};
	}, [audioElementRef, onPlay, onPause, onEnded, onLoaded, onTimeUpdate, onCurrentTimeChange, controlledCurrentTime]);

// Set audio source when `audio` prop changes and decode waveform
useEffect(() => {
	if (!audioRef.current) return;
	const el = audioRef.current;

	// Cleanup previous
	if (objectUrlRef.current) {
		URL.revokeObjectURL(objectUrlRef.current);
		objectUrlRef.current = null;
	}

	const loadArrayBuffer = async () => {
		try {
			let arrayBuffer: ArrayBuffer | null = null;
			if (typeof audio === 'string') {
				const resp = await fetch(audio, { mode: 'cors' });
				arrayBuffer = await resp.arrayBuffer();
				el.src = audio;
			} else if (audio instanceof File) {
				arrayBuffer = await audio.arrayBuffer();
				const url = URL.createObjectURL(audio);
				objectUrlRef.current = url;
				el.src = url;
			} else {
				console.warn('Unsupported audio prop', audio);
				return;
			}

			const AudioContextClass: any = (window as any).AudioContext || (window as any).webkitAudioContext;
			if (!AudioContextClass) return;
			const ac: AudioContext = new AudioContextClass();
			audioCtxRef.current = ac;
			const decoded = await ac.decodeAudioData(arrayBuffer.slice(0));
			const channelData = decoded.numberOfChannels > 0 ? decoded.getChannelData(0) : null;

			// Offload peak computation to worker (streaming)
			if (channelData) drawPeaks(channelData, decoded.sampleRate);
		} catch (err) {
			console.warn('Failed to load audio for waveform:', err);
		}
	};

	loadArrayBuffer();
}, [audio]);

	function drawPeaks(channelData: Float32Array | null, sampleRate: number) {
		const canvas = canvasRef.current;
		if (!canvas || !channelData) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, width, height);

		const slot = Math.max(1, Math.floor(width / (barWidth + gap)));
		const samplesPerSlot = Math.floor(channelData.length / slot) || 1;
		const peaksArr = new Float32Array(slot);
		for (let i = 0; i < slot; i++) {
			let start = i * samplesPerSlot;
			let end = Math.min(start + samplesPerSlot, channelData.length);
			let max = 0;
			for (let s = start; s < end; s++) {
				const v = Math.abs(channelData[s]);
				if (v > max) max = v;
			}
			peaksArr[i] = max; // use peak amplitude for more accurate heights
		}

		// draw background if requested
		if (backgroundColor && backgroundColor !== 'transparent') {
			ctx.fillStyle = backgroundColor;
			ctx.fillRect(0, 0, width, height);
		}

		const mid = height / 2;
		for (let i = 0; i < slot; i++) {
			const x = i * (barWidth + gap);
			const h = peaksArr[i] * (height * 0.95);
			const y = mid - h / 2;
			ctx.fillStyle = barColor;
			ctx.fillRect(x, y, barWidth, h);
		}

		// If worker is supported, compute peaks in worker; otherwise just set peaks
		if (window.Worker) {
			// create worker lazily
			if (!workerRef.current) {
				workerRef.current = new Worker(new URL('./peaks.worker.ts', import.meta.url), { type: 'module' });
				workerRef.current.onmessage = (ev: MessageEvent) => {
					const msg = ev.data;
					if (msg.type === 'progress') {
						const peaksArrReceived = new Float32Array(msg.peaksBuffer);
						setPeaks(peaksArrReceived);
						onPeaksComputed?.(peaksArrReceived);
						// draw base bars on first partial message so UI becomes responsive
						const ctx2 = canvas.getContext('2d');
						if (ctx2) {
							ctx2.save();
							// draw base bars from received peaks
							ctx2.clearRect(0, 0, canvas.width, canvas.height);
							if (backgroundColor && backgroundColor !== 'transparent') {
								ctx2.fillStyle = backgroundColor;
								ctx2.fillRect(0, 0, width, height);
							}
							const mid2 = height / 2;
							for (let i = 0; i < peaksArrReceived.length; i++) {
								const x = i * (barWidth + gap);
								const h = peaksArrReceived[i] * (height * 0.95);
								const y = mid2 - h / 2;
								ctx2.fillStyle = barColor;
								ctx2.fillRect(x, y, barWidth, h);
							}
							ctx2.restore();
						}
					}
				};
			}

			// transfer channel buffer ownership to worker for processing
			try {
				workerRef.current.postMessage({
					type: 'compute',
					channelBuffer: channelData.buffer,
					channelLength: channelData.length,
					width,
					barWidth,
					gap,
					chunkSize: 262144
				}, [channelData.buffer]);
			} catch (err) {
				// fallback: local set
				setPeaks(peaksArr);
				onPeaksComputed?.(peaksArr);
			}
		} else {
			setPeaks(peaksArr);
			onPeaksComputed?.(peaksArr);
		}
	}

	function drawProgressOverlay(peaksArr: Float32Array, currentTimeParam?: number) {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			const played = typeof currentTimeParam === 'number' ? currentTimeParam : currentTime;
			const playedRatio = duration > 0 ? played / duration : 0;
			const renderedWidth = canvas.getBoundingClientRect().width || width;
			const playedWidth = Math.max(0, Math.min(1, playedRatio)) * renderedWidth;

			// Clear the entire drawing surface (device pixels) to avoid overlay smearing
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.restore();

			// draw background and base waveform bars
			if (backgroundColor && backgroundColor !== 'transparent') {
				ctx.fillStyle = backgroundColor;
				ctx.fillRect(0, 0, renderedWidth, height);
			}

			for (let i = 0; i < peaksArr.length; i++) {
				const x = i * (barWidth + gap);
				const w = barWidth;
				const h = peaksArr[i] * (height * 0.95);
				const y = (height / 2) - h / 2;
				ctx.fillStyle = barColor;
				ctx.fillRect(x, y, w, h);
			}

			// Draw progress by painting progressColor over bars up to playedWidth
			for (let i = 0; i < peaksArr.length; i++) {
				const x = i * (barWidth + gap);
				const w = barWidth;
				const h = peaksArr[i] * (height * 0.95);
				const y = (height / 2) - h / 2;
				if (x + w <= playedWidth) {
					ctx.fillStyle = progressColor;
					ctx.fillRect(x, y, w, h);
				} else if (x < playedWidth) {
					const partial = Math.max(0, playedWidth - x);
					ctx.fillStyle = progressColor;
					ctx.fillRect(x, y, partial, h);
				}
			}

			// playhead
			const px = playedWidth;
			ctx.fillStyle = playheadColor;
			ctx.fillRect(px - 1, 0, 2, height);
	}

	function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const x = e.clientX - rect.left;
		const t = (x / rect.width) * duration;
		if (audioRef.current && !Number.isNaN(t)) {
			const newTime = Math.max(0, Math.min(duration, t));
			if (controlledCurrentTime !== undefined) {
				// In controlled mode, notify parent
				onCurrentTimeChange?.(newTime);
			} else {
				// In uncontrolled mode, update directly
				audioRef.current.currentTime = newTime;
			}
		}
	}

	function onCanvasMove(e: React.MouseEvent<HTMLCanvasElement>) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const x = e.clientX - rect.left;
		setHoverX(x);
		const t = duration > 0 ? (x / rect.width) * duration : 0;
		setHoverTime(isFinite(t) ? t : null);
	}

	function onCanvasLeave() {
		setHoverX(null);
		setHoverTime(null);
	}

	function togglePlay() {
		const a = audioRef.current;
		if (!a) return;
		if (a.paused) a.play(); else a.pause();
	}

	function seek(delta: number) {
		const a = audioRef.current;
		if (!a) return;
		const newTime = Math.max(0, Math.min((a.duration || 0), a.currentTime + delta));
		if (controlledCurrentTime !== undefined) {
			// In controlled mode, notify parent
			onCurrentTimeChange?.(newTime);
		} else {
			// In uncontrolled mode, update directly
			a.currentTime = newTime;
		}
	}

	function onVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
		const v = Number(e.target.value);
		setVolume(v);
		if (audioRef.current) audioRef.current.volume = v;
	}

	useEffect(() => {
		if (!audioRef.current) return;
		audioRef.current.volume = volume;
	}, [volume]);

	// Controlled mode: sync audio element when controlledCurrentTime changes
	useEffect(() => {
		if (controlledCurrentTime !== undefined && audioRef.current) {
			const audio = audioRef.current;
			// Only update if there's a significant difference to avoid feedback loop
			if (Math.abs(audio.currentTime - controlledCurrentTime) > 0.01) {
				audio.currentTime = controlledCurrentTime;
			}
		}
	}, [controlledCurrentTime]);

	// Use controlled time when provided, otherwise use internal state
	const displayTime = controlledCurrentTime !== undefined ? controlledCurrentTime : currentTime;

	// smooth progress updates while playing using requestAnimationFrame
	useEffect(() => {
		let rafId = 0;
		function loop() {
			const a = audioRef.current;
			if (a && !a.paused && peaks) {
				drawProgressOverlay(peaks, a.currentTime);
				rafId = window.requestAnimationFrame(loop);
			}
		}

		if (isPlaying) {
			rafId = window.requestAnimationFrame(loop);
			rafRef.current = rafId;
		} else {
			if (rafRef.current) {
				window.cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		}

		return () => {
			if (rafId) window.cancelAnimationFrame(rafId);
		};
	}, [isPlaying, peaks]);

	// redraw on time or peaks change (non-animated update)
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !peaks) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// clear and draw base waveform bars
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (backgroundColor && backgroundColor !== 'transparent') {
			ctx.fillStyle = backgroundColor;
			ctx.fillRect(0, 0, width, height);
		}

		const mid = height / 2;
		for (let i = 0; i < peaks.length; i++) {
			const x = i * (barWidth + gap);
			const h = peaks[i] * (height * 0.95);
			const y = mid - h / 2;
			ctx.fillStyle = barColor;
			ctx.fillRect(x, y, barWidth, h);
		}

		// draw current progress/playhead
		drawProgressOverlay(peaks, displayTime);
	}, [displayTime, peaks]);

	return (
		<div className={`waveform-navigator ${className}`}>
			<canvas ref={canvasRef} onClick={onCanvasClick} onMouseMove={onCanvasMove} onMouseLeave={onCanvasLeave} className="waveform-canvas" />

			{hoverX !== null && (
				<>
					<div className="hover-line" style={{ left: `${hoverX}px` }} />
					<div className="hover-tooltip" style={{ left: `${hoverX}px` }}>{hoverTime !== null ? formatTime(hoverTime) : ''}</div>
				</>
			)}

			<div className="controls">
				<div className="left">
					<div className="time">{formatTime(displayTime)} / {formatTime(duration)}</div>
				</div>

				<div className="center">
					<button className="ctrl rewind" onClick={() => seek(-10)} aria-label="rewind">
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M11 19V5l-8 7 8 7zM21 19V5l-8 7 8 7z" fill="#111827" />
						</svg>
					</button>

					<button className="play" onClick={togglePlay} aria-label={isPlaying ? 'pause' : 'play'}>
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

					<button className="ctrl forward" onClick={() => seek(10)} aria-label="forward">
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
					<input className="vol-range" type="range" min="0" max="1" step="0.01" value={volume} onChange={onVolumeChange} aria-label="volume" />
				</div>
			</div>
		</div>
	);
};

function formatTime(t: number) {
	if (!t || !isFinite(t)) return '0:00';
	const s = Math.floor(t % 60).toString().padStart(2, '0');
	const m = Math.floor(t / 60);
	return `${m}:${s}`;
}

export default WaveformNavigator;
export { WaveformNavigator };
