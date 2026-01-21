import { useEffect, useRef, useState } from 'react';

interface UseWaveformDataProps {
	audio: string | File | null | undefined;
	width: number;
	barWidth: number;
	gap: number;
	onPeaksComputed?: (peaks: Float32Array) => void;
}

interface UseWaveformDataReturn {
	peaks: Float32Array | null;
}

export function useWaveformData({
	audio,
	width,
	barWidth,
	gap,
	onPeaksComputed
}: UseWaveformDataProps): UseWaveformDataReturn {
	const [peaks, setPeaks] = useState<Float32Array | null>(null);
	const audioCtxRef = useRef<AudioContext | null>(null);
	const workerRef = useRef<Worker | null>(null);
	const onPeaksComputedRef = useRef(onPeaksComputed);
	const audioBufferRef = useRef<Float32Array | null>(null);
	const lastWidthRef = useRef<number | null>(null);
	const lastBarWidthRef = useRef<number | null>(null);
	const lastGapRef = useRef<number | null>(null);

	useEffect(() => {
		onPeaksComputedRef.current = onPeaksComputed;
	}, [onPeaksComputed]);

	// Initialize worker once
	useEffect(() => {
		if (window.Worker && !workerRef.current) {
			workerRef.current = new Worker(new URL('../peaks.worker.ts', import.meta.url), { type: 'module' });
			workerRef.current.onmessage = (ev: MessageEvent) => {
				const msg = ev.data;
				if (msg.type === 'progress') {
					const peaksArrReceived = new Float32Array(msg.peaksBuffer);
					setPeaks(peaksArrReceived);
					onPeaksComputedRef.current?.(peaksArrReceived);
				}
			};
		}
	}, []);

	// Cleanup worker on unmount
	useEffect(() => {
		return () => {
			if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
				audioCtxRef.current.close();
			}
			if (workerRef.current) {
				workerRef.current.postMessage({ type: 'terminate' });
				workerRef.current.terminate();
				workerRef.current = null;
			}
		};
	}, []);

	// Load and decode audio data when audio prop changes
	useEffect(() => {
		if (!audio) {
			setPeaks(null);
			audioBufferRef.current = null;
			return;
		}

		const loadArrayBuffer = async () => {
			try {
				// Close previous AudioContext if it exists
				if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
					await audioCtxRef.current.close();
					audioCtxRef.current = null;
				}

				let arrayBuffer: ArrayBuffer | null = null;
				if (typeof audio === 'string') {
					const resp = await fetch(audio, { mode: 'cors' });
					arrayBuffer = await resp.arrayBuffer();
				} else if (audio instanceof File) {
					arrayBuffer = await audio.arrayBuffer();
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

				// Store the audio buffer for resampling
				if (channelData) {
					audioBufferRef.current = channelData;
					lastWidthRef.current = width;
					lastBarWidthRef.current = barWidth;
					lastGapRef.current = gap;
					computePeaks(channelData);
				}
			} catch (err) {
				console.warn('Failed to load audio for waveform:', err);
			}
		};

		loadArrayBuffer();
	}, [audio]);

	// Recompute peaks when width, barWidth, or gap changes (without re-fetching audio)
	useEffect(() => {
		if (audioBufferRef.current) {
			// Only recompute if dimensions actually changed (with threshold for sub-pixel changes)
			const widthChanged = Math.abs(width - (lastWidthRef.current || 0)) > 1;
			const barWidthChanged = barWidth !== lastBarWidthRef.current;
			const gapChanged = gap !== lastGapRef.current;
			
			if (widthChanged || barWidthChanged || gapChanged) {
				lastWidthRef.current = width;
				lastBarWidthRef.current = barWidth;
				lastGapRef.current = gap;
				computePeaks(audioBufferRef.current);
			}
		}
	}, [width, barWidth, gap]);

	function computePeaks(channelData: Float32Array) {
		const slot = Math.max(1, Math.floor(width / (barWidth + gap)));
		const samplesPerSlot = Math.floor(channelData.length / slot) || 1;
		const peaksArr = new Float32Array(slot);
		
		// Quick initial computation for immediate display
		for (let i = 0; i < slot; i++) {
			let start = i * samplesPerSlot;
			let end = Math.min(start + samplesPerSlot, channelData.length);
			let max = 0;
			for (let s = start; s < end; s++) {
				const v = Math.abs(channelData[s]);
				if (v > max) max = v;
			}
			peaksArr[i] = max;
		}

		// Set initial peaks for immediate display
		setPeaks(peaksArr);
		onPeaksComputedRef.current?.(peaksArr);

		// Use worker for more accurate computation if available
		if (workerRef.current) {
			try {
				// Transfer a copy of the buffer to avoid losing the original data
				const channelCopy = new Float32Array(channelData);
				workerRef.current.postMessage({
					type: 'compute',
					channelBuffer: channelCopy.buffer,
					channelLength: channelCopy.length,
					width,
					barWidth,
					gap,
					chunkSize: 262144
				}, [channelCopy.buffer]);
			} catch (err) {
				// Fallback peaks are already set above
				console.warn('Worker postMessage failed, using fallback peaks:', err);
			}
		}
	}

	return {
		peaks
	};
}
