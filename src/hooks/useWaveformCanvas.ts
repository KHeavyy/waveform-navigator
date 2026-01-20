import { useEffect, useRef } from 'react';

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

	// Initialize canvas
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.scale(dpr, dpr);
	}, [width, height]);

	// Draw waveform with progress
	function drawWaveform(peaksArr: Float32Array, time: number) {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const playedRatio = duration > 0 ? time / duration : 0;
		const renderedWidth = canvas.getBoundingClientRect().width || width;
		const playedWidth = Math.max(0, Math.min(1, playedRatio)) * renderedWidth;

		// Clear the entire drawing surface
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.restore();

		// Draw background
		if (backgroundColor && backgroundColor !== 'transparent') {
			ctx.fillStyle = backgroundColor;
			ctx.fillRect(0, 0, renderedWidth, height);
		}

		// Draw base waveform bars
		for (let i = 0; i < peaksArr.length; i++) {
			const x = i * (barWidth + gap);
			const w = barWidth;
			const h = peaksArr[i] * (height * 0.95);
			const y = (height / 2) - h / 2;
			ctx.fillStyle = barColor;
			ctx.fillRect(x, y, w, h);
		}

		// Draw progress overlay
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

		// Draw playhead
		const px = playedWidth;
		ctx.fillStyle = playheadColor;
		ctx.fillRect(px - 1, 0, 2, height);
	}

	// Smooth progress updates while playing using requestAnimationFrame
	useEffect(() => {
		let rafId = 0;
		
		function loop() {
			if (peaks) {
				drawWaveform(peaks, currentTime);
				rafId = window.requestAnimationFrame(loop);
			}
		}

		if (isPlaying && peaks) {
			rafId = window.requestAnimationFrame(loop);
			rafRef.current = rafId;
		} else {
			if (rafRef.current) {
				window.cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			// Draw once when paused to show current state
			if (peaks) {
				drawWaveform(peaks, currentTime);
			}
		}

		return () => {
			if (rafId) window.cancelAnimationFrame(rafId);
		};
	}, [isPlaying, peaks, currentTime, duration, barWidth, gap, barColor, progressColor, backgroundColor, playheadColor, width, height]);

	return {
		canvasRef
	};
}
