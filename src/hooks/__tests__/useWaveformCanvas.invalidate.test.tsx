import { render, waitFor } from '@testing-library/react';
import { useWaveformCanvas } from '../useWaveformCanvas';
import { describe, it, expect } from 'vitest';

function TestComponent({ peaks }: any) {
	const { canvasRef } = useWaveformCanvas({
		width: 100,
		height: 20,
		barWidth: 2,
		gap: 1,
		displayMode: 'bars',
		barColor: '#000',
		progressColor: '#f00',
		backgroundColor: 'transparent',
		playheadColor: '#0f0',
		peaks,
		currentTime: 0,
		duration: 10,
		isPlaying: false,
	});
	return <canvas ref={canvasRef} />;
}

describe('useWaveformCanvas cache invalidation', () => {
	it('rebuilds cache when peaks change', async () => {
		(window as any).__waveformReady = false;

		const { rerender } = render(
			<TestComponent peaks={new Float32Array([0.1, 0.2])} />
		);

		await waitFor(() => expect((window as any).__waveformReady).toBeTruthy());

		// Reset readiness so we can observe it again
		(window as any).__waveformReady = false;

		rerender(<TestComponent peaks={new Float32Array([0.3, 0.4])} />);

		await waitFor(() => expect((window as any).__waveformReady).toBeTruthy());
	});
});
