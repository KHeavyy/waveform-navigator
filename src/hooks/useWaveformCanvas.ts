import { useEffect, useRef } from 'react';
import { syncCanvasSize } from '../utils';

interface UseWaveformCanvasProps {
	width: number;
	height: number;
	barWidth: number;
	gap: number;
	barColor: string;
	progressColor: string;
	backgroundColor: string;
	playheadColor: string;
	peaks: Float32Array | null;
	currentTime: number;
	duration: number;
	isPlaying: boolean;
}

interface UseWaveformCanvasReturn {
	canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function useWaveformCanvas({
	width,
	height,
	barWidth,
	gap,
	barColor,
	progressColor,
	backgroundColor,
	playheadColor,
	peaks,
	currentTime,
	duration,
	isPlaying
}: UseWaveformCanvasProps): UseWaveformCanvasReturn {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const dprRef = useRef<number>(1);
	
	// Cache the base waveform as ImageData for performance optimization
	// This avoids redrawing all bars on every progress update
	const baseWaveformCache = useRef<ImageData | null>(null);
	
	// Cache the canvas context with willReadFrequently hint for optimal getImageData performance
	const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
	
	// Use refs for frequently changing values to avoid recreating RAF loop
	const currentTimeRef = useRef(currentTime);
	const durationRef = useRef(duration);
	const peaksRef = useRef(peaks);
	
	// Keep refs updated
	useEffect(() => {
		currentTimeRef.current = currentTime;
		durationRef.current = duration;
		peaksRef.current = peaks;
	}, [currentTime, duration, peaks]);

	// Initialize canvas with HiDPI support
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		
		// Initialize canvas context with willReadFrequently hint for optimal ImageData operations
		if (!ctxRef.current) {
			ctxRef.current = canvas.getContext('2d', { willReadFrequently: true });
		}
		
		// Sync canvas size with devicePixelRatio and store DPR
		dprRef.current = syncCanvasSize(canvas, width, height);
		
		// Invalidate cache on resize since canvas dimensions changed
		baseWaveformCache.current = null;
		
		// Redraw after canvas resize to prevent blank canvas
		// drawWaveform will handle building the cache via fallback if needed
		if (peaks && !isPlaying) {
			drawWaveform(peaks, currentTime);
		}
	}, [width, height]);

	/**
	 * Draw waveform with progress overlay.
	 * Uses cached base waveform (ImageData) and only draws progress bars + playhead.
	 * Builds and caches the base waveform on first render or after cache invalidation.
	 * Called on every frame during playback via requestAnimationFrame.
	 */
	function drawWaveform(peaksArr: Float32Array, time: number) {
		const canvas = canvasRef.current;
		if (!canvas) return;
		
		const ctx = ctxRef.current;
		if (!ctx) return;

		const dur = durationRef.current;
		const playedRatio = dur > 0 ? time / dur : 0;
		const playedWidth = Math.max(0, Math.min(1, playedRatio)) * width;
		const dpr = dprRef.current;

		// Restore cached base waveform for optimal performance
		// This avoids redrawing all base bars on every frame
		if (baseWaveformCache.current) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.putImageData(baseWaveformCache.current, 0, 0);
			
			// Re-apply DPR transform for logical pixel drawing
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		} else {
			// Build and cache base waveform if cache doesn't exist
			// This ensures cache is built on first render or after invalidation
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

			if (backgroundColor && backgroundColor !== 'transparent') {
				ctx.fillStyle = backgroundColor;
				ctx.fillRect(0, 0, width, height);
			}

			for (let i = 0; i < peaksArr.length; i++) {
				const x = i * (barWidth + gap);
				const w = barWidth;
				const h = peaksArr[i] * (height * 0.95);
				const y = (height / 2) - h / 2;
				ctx.fillStyle = barColor;
				ctx.fillRect(x, y, w, h);
			}
			
			// Cache the newly drawn base waveform
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			baseWaveformCache.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}

		// Draw progress overlay (using logical coordinates)
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

		// Draw playhead (using logical coordinates)
		const px = playedWidth;
		ctx.fillStyle = playheadColor;
		ctx.fillRect(px - 1, 0, 2, height);
	}

	// Invalidate cache when base waveform properties change
	useEffect(() => {
		baseWaveformCache.current = null;
	}, [peaks, barWidth, gap, barColor, backgroundColor]);

	// Smooth progress updates while playing using requestAnimationFrame
	useEffect(() => {
		function loop() {
			const currentPeaks = peaksRef.current;
			const currentTimeValue = currentTimeRef.current;
			if (currentPeaks) {
				drawWaveform(currentPeaks, currentTimeValue);
				rafRef.current = window.requestAnimationFrame(loop);
			}
		}

		if (isPlaying && peaks) {
			// Start animation loop - drawWaveform will build cache on first frame if needed
			rafRef.current = window.requestAnimationFrame(loop);
		} else {
			if (rafRef.current) {
				window.cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			// Draw once when paused - will build and cache if needed
			if (peaks) {
				drawWaveform(peaks, currentTime);
			}
		}

		return () => {
			if (rafRef.current) {
				window.cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [isPlaying, peaks, progressColor, playheadColor]);

	return {
		canvasRef
	};
}
