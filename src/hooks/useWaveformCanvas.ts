import { useEffect, useRef } from 'react';
import { syncCanvasSize } from '../utils';
import type { Marker } from '../WaveformNavigator';

interface UseWaveformCanvasProps {
	width: number;
	height: number;
	barWidth: number;
	gap: number;
	barColor: string;
	progressColor: string;
	backgroundColor: string;
	playheadColor: string;
	markerColor?: string;
	markerLabelColor?: string;
	markers?: Marker[];
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
	markerColor = '#10b981',
	markerLabelColor = '#ffffff',
	markers = [],
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
		if (!canvas) {
			return;
		}

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
	 * Draw waveform with progress overlay.
	 * Uses cached base waveform (ImageData) and only draws progress bars + playhead.
	 * Builds and caches the base waveform on first render or after cache invalidation.
	 * Called on every frame during playback via requestAnimationFrame.
	 */
	function drawWaveform(peaksArr: Float32Array, time: number) {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}

		const ctx = ctxRef.current;
		if (!ctx) {
			return;
		}

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
				const y = height / 2 - h / 2;
				ctx.fillStyle = barColor;
				ctx.fillRect(x, y, w, h);
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

		// Draw playhead (using logical coordinates)
		const px = playedWidth;
		ctx.fillStyle = playheadColor;
		ctx.fillRect(px - 1, 0, 2, height);

		// Draw markers (using logical coordinates)
		if (markers && markers.length > 0) {
			drawMarkers(ctx, markers, dur, width, height);
		}
	}

	/**
	 * Draw markers on the waveform.
	 * Renders either default markers (line + label) or custom markup if provided.
	 */
	function drawMarkers(
		ctx: CanvasRenderingContext2D,
		markersArr: Marker[],
		dur: number,
		canvasWidth: number,
		canvasHeight: number
	) {
		if (dur <= 0) {
			return;
		}

		markersArr.forEach((marker, index) => {
			// Calculate x position from time
			const markerX = (marker.time / dur) * canvasWidth;

			// Skip markers outside the visible range
			if (markerX < 0 || markerX > canvasWidth) {
				return;
			}

			// Use custom markup if provided, otherwise use default
			if (marker.markup) {
				// Custom marker rendering
				ctx.save();
				marker.markup({
					ctx,
					x: markerX,
					height: canvasHeight,
					index,
					marker,
				});
				ctx.restore();
			} else {
				// Default marker rendering: vertical line with label
				ctx.save();

				// Draw vertical line
				ctx.fillStyle = markerColor;
				ctx.fillRect(markerX - 1, 0, 2, canvasHeight);

				// Draw label background and text
				const label = `M${index + 1}`;
				ctx.font = '12px sans-serif';
				const textMetrics = ctx.measureText(label);
				const labelWidth = textMetrics.width + 8;
				const labelHeight = 20;
				// Clamp label position to stay within canvas bounds
				const labelX = Math.max(
					0,
					Math.min(canvasWidth - labelWidth, markerX - labelWidth / 2)
				);
				const labelY = 8;

				// Draw label background
				ctx.fillStyle = markerColor;
				ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

				// Draw label text
				ctx.fillStyle = markerLabelColor;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				// Center text within the clamped label bounds
				ctx.fillText(label, labelX + labelWidth / 2, labelY + labelHeight / 2);

				ctx.restore();
			}
		});
	}

	// Invalidate cache when base waveform properties change
	useEffect(() => {
		baseWaveformCache.current = null;
		// Allow readiness event to fire again after cache change
		readyDispatchedRef.current = false;
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
	}, [
		isPlaying,
		peaks,
		progressColor,
		playheadColor,
		markerColor,
		markerLabelColor,
		markers,
		currentTime,
	]);

	return {
		canvasRef,
	};
}
