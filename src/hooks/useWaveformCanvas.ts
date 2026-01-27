import { useEffect, useRef } from 'react';
import { syncCanvasSize } from '../utils';

interface UseWaveformCanvasProps {
	width: number;
	height: number;
	barWidth: number;
	gap: number;
	displayMode: 'bars' | 'analog';
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
	displayMode,
	barColor,
	progressColor,
	backgroundColor,
	playheadColor,
	peaks,
	currentTime,
	duration,
	isPlaying,
}: UseWaveformCanvasProps): UseWaveformCanvasReturn {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const dprRef = useRef<number>(1);

	// Whether we've signaled that the waveform has been drawn at least once
	const readyDispatchedRef = useRef<boolean>(false);

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
			const context = canvas.getContext('2d', { willReadFrequently: true });
			if (!context) {
				console.warn('Failed to get 2D context for waveform canvas');
				return;
			}
			ctxRef.current = context;
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
	 * Interpolate amplitude at a given position for smooth progress rendering
	 */
	function interpolateAmplitude(
		position: number,
		peaksArr: Float32Array
	): number {
		const index = position / (barWidth + gap);
		const lowerIndex = Math.floor(index);
		const upperIndex = Math.ceil(index);
		const fraction = index - lowerIndex;

		if (upperIndex < peaksArr.length) {
			const lowerAmp = peaksArr[lowerIndex] || 0;
			const upperAmp = peaksArr[upperIndex] || 0;
			return lowerAmp + (upperAmp - lowerAmp) * fraction;
		} else if (lowerIndex < peaksArr.length) {
			return peaksArr[lowerIndex];
		}
		return 0;
	}

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

			if (displayMode === 'analog') {
				// Draw analog waveform (continuous filled waveform)
				ctx.fillStyle = barColor;
				ctx.beginPath();

				const midY = height / 2;
				const scaleY = height * 0.95;

				// Start at the left edge
				ctx.moveTo(0, midY);

				// Draw the top half of the waveform
				for (let i = 0; i < peaksArr.length; i++) {
					const x = i * (barWidth + gap);
					const amplitude = peaksArr[i] * scaleY / 2;
					const y = midY - amplitude;
					ctx.lineTo(x, y);
				}

				// Draw the bottom half in reverse
				for (let i = peaksArr.length - 1; i >= 0; i--) {
					const x = i * (barWidth + gap);
					const amplitude = peaksArr[i] * scaleY / 2;
					const y = midY + amplitude;
					ctx.lineTo(x, y);
				}

				ctx.closePath();
				ctx.fill();
			} else {
				// Draw bar waveform (traditional bars with gaps)
				for (let i = 0; i < peaksArr.length; i++) {
					const x = i * (barWidth + gap);
					const w = barWidth;
					const h = peaksArr[i] * (height * 0.95);
					const y = height / 2 - h / 2;
					ctx.fillStyle = barColor;
					ctx.fillRect(x, y, w, h);
				}
			}

			// Cache the newly drawn base waveform
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			baseWaveformCache.current = ctx.getImageData(
				0,
				0,
				canvas.width,
				canvas.height
			);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

			// Dispatch a readiness event once the waveform has been drawn and cached
			if (!readyDispatchedRef.current) {
				readyDispatchedRef.current = true;
				try {
					(window as any).__waveformReady = true;
					window.dispatchEvent(new Event('waveform-ready'));
				} catch (err) {
					// Silence any environment errors (e.g., non-window global)
					console.warn('Could not dispatch waveform-ready event', err);
				}
			}
		}

		// Draw progress overlay (using logical coordinates)
		if (displayMode === 'analog') {
			// For analog mode, draw a filled polygon for the progress portion
			ctx.fillStyle = progressColor;
			ctx.beginPath();

			const midY = height / 2;
			const scaleY = height * 0.95;

			// Start at the left edge
			ctx.moveTo(0, midY);

			// Draw the top half up to the played position
			for (let i = 0; i < peaksArr.length; i++) {
				const x = i * (barWidth + gap);
				if (x > playedWidth) break;
				const amplitude = peaksArr[i] * scaleY / 2;
				const y = midY - amplitude;
				ctx.lineTo(x, y);
			}

			// If we stopped in the middle, add the playhead position points
			if (playedWidth < width) {
				const interpolatedAmplitude = interpolateAmplitude(playedWidth, peaksArr);
				const topY = midY - (interpolatedAmplitude * scaleY / 2);
				ctx.lineTo(playedWidth, topY);

				// Draw the bottom half in reverse - reuse the interpolated amplitude
				const bottomY = midY + (interpolatedAmplitude * scaleY / 2);
				ctx.lineTo(playedWidth, bottomY);
			}

			for (let i = Math.min(peaksArr.length - 1, Math.floor(playedWidth / (barWidth + gap))); i >= 0; i--) {
				const x = i * (barWidth + gap);
				const amplitude = peaksArr[i] * scaleY / 2;
				const y = midY + amplitude;
				ctx.lineTo(x, y);
			}

			ctx.closePath();
			ctx.fill();
		} else {
			// For bar mode, draw progress bars
			for (let i = 0; i < peaksArr.length; i++) {
				const x = i * (barWidth + gap);
				const w = barWidth;
				const h = peaksArr[i] * (height * 0.95);
				const y = height / 2 - h / 2;
				if (x + w <= playedWidth) {
					ctx.fillStyle = progressColor;
					ctx.fillRect(x, y, w, h);
				} else if (x < playedWidth) {
					const partial = Math.max(0, playedWidth - x);
					ctx.fillStyle = progressColor;
					ctx.fillRect(x, y, partial, h);
				}
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
		// Allow readiness event to fire again after cache change
		readyDispatchedRef.current = false;
	}, [peaks, barWidth, gap, displayMode, barColor, backgroundColor]);

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
	}, [isPlaying, peaks, progressColor, playheadColor, currentTime]);

	return {
		canvasRef,
	};
}
