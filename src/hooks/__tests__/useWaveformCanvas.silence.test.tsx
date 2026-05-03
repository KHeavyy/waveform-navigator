import { render, waitFor } from '@testing-library/react';
import { useWaveformCanvas } from '../useWaveformCanvas';
import { describe, it, expect, beforeEach } from 'vitest';

const CANVAS_HEIGHT = 20;
const BAR_WIDTH = 2;

function TestComponent({ peaks }: { peaks: Float32Array }) {
	const { canvasRef } = useWaveformCanvas({
		width: 100,
		height: CANVAS_HEIGHT,
		barWidth: BAR_WIDTH,
		gap: 1,
		barColor: '#000',
		progressColor: '#f00',
		backgroundColor: 'transparent',
		playheadColor: '#0f0',
		peaks,
		currentTime: 0,
		duration: 10,
		isPlaying: false,
	});
	return <canvas ref={canvasRef} data-testid="canvas" />;
}

// Extract bar-height fillRect calls, excluding full-height elements like the playhead
function getBarHeights(mockCtx: any): number[] {
	return mockCtx.fillRect.mock.calls
		.filter(([, , w, h]: number[]) => w === BAR_WIDTH && h < CANVAS_HEIGHT)
		.map(([, , , h]: number[]) => h);
}

describe('useWaveformCanvas silent audio rendering', () => {
	let mockCtx: any;

	beforeEach(() => {
		(window as any).__waveformReady = false;
		mockCtx = (HTMLCanvasElement.prototype.getContext as any)('2d');
		mockCtx.fillRect.mockClear();
	});

	it('renders bars with minimum height for fully silent (all-zero) peaks', async () => {
		render(<TestComponent peaks={new Float32Array([0, 0, 0, 0, 0])} />);

		await waitFor(() => expect((window as any).__waveformReady).toBeTruthy());

		const barHeights = getBarHeights(mockCtx);
		expect(barHeights.length).toBeGreaterThan(0);
		barHeights.forEach((h) => {
			expect(h).toBeGreaterThanOrEqual(2);
		});
	});

	it('renders bars with minimum height of exactly 2px when peak is zero', async () => {
		render(<TestComponent peaks={new Float32Array([0])} />);

		await waitFor(() => expect((window as any).__waveformReady).toBeTruthy());

		const barHeights = getBarHeights(mockCtx);
		expect(barHeights.length).toBeGreaterThan(0);
		expect(barHeights[0]).toBe(2);
	});

	it('silent bars are shorter than loud bars', async () => {
		render(<TestComponent peaks={new Float32Array([0, 0, 0])} />);
		await waitFor(() => expect((window as any).__waveformReady).toBeTruthy());

		const silentHeights = getBarHeights(mockCtx);
		const silentAvg =
			silentHeights.reduce((a, b) => a + b, 0) / silentHeights.length;

		mockCtx.fillRect.mockClear();
		(window as any).__waveformReady = false;

		render(<TestComponent peaks={new Float32Array([1.0, 1.0, 1.0])} />);
		await waitFor(() => expect((window as any).__waveformReady).toBeTruthy());

		const loudHeights = getBarHeights(mockCtx);
		const loudAvg = loudHeights.reduce((a, b) => a + b, 0) / loudHeights.length;

		expect(loudAvg).toBeGreaterThan(silentAvg);
	});
});
