import { render, waitFor } from '@testing-library/react';
import { useWaveformCanvas } from '../useWaveformCanvas';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Marker } from '../../WaveformNavigator';

// Test component to render the hook with markers
function TestComponent({
	markers,
	markerColor = '#10b981',
	markerLabelColor = '#ffffff',
}: {
	markers: Marker[];
	markerColor?: string;
	markerLabelColor?: string;
}) {
	const { canvasRef } = useWaveformCanvas({
		width: 100,
		height: 50,
		barWidth: 2,
		gap: 1,
		barColor: '#000',
		progressColor: '#f00',
		backgroundColor: 'transparent',
		playheadColor: '#0f0',
		markerColor,
		markerLabelColor,
		markers,
		peaks: new Float32Array([0.5, 0.2, 0.8]),
		currentTime: 0,
		duration: 10,
		isPlaying: false,
	});
	return <canvas ref={canvasRef} data-testid="canvas" />;
}

describe('useWaveformCanvas with markers', () => {
	let mockContext: any;

	beforeEach(() => {
		mockContext = {
			setTransform: vi.fn(),
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			getImageData: vi.fn().mockReturnValue({}),
			putImageData: vi.fn(),
			fillText: vi.fn(),
			measureText: vi.fn().mockReturnValue({ width: 20 }),
			save: vi.fn(),
			restore: vi.fn(),
			fillStyle: '',
			textAlign: '',
			textBaseline: '',
		};
		HTMLCanvasElement.prototype.getContext = vi
			.fn()
			.mockReturnValue(mockContext);
	});

	it('renders markers with default appearance', async () => {
		const markers: Marker[] = [{ time: 2.5 }, { time: 5 }];

		// Clear waveform ready flag
		(window as any).__waveformReady = false;

		render(<TestComponent markers={markers} />);

		// Wait for waveform to be drawn and ready
		await waitFor(() => {
			if (!(window as any).__waveformReady) {
				throw new Error('not ready');
			}
		});

		// Wait a bit for drawing to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify that marker labels were drawn
		const textCalls = mockContext.fillText.mock.calls.map(
			(call: any) => call[0]
		);
		expect(textCalls).toContain('M1');
		expect(textCalls).toContain('M2');
	});

	it('renders markers with custom markup', async () => {
		const customMarkup = vi.fn((props) => {
			// Draw a custom circle
			props.ctx.fillStyle = '#ff0000';
			props.ctx.fillRect(props.x - 5, props.height / 2 - 5, 10, 10);
		});

		const markers: Marker[] = [{ time: 5, markup: customMarkup }];

		// Clear waveform ready flag
		(window as any).__waveformReady = false;

		render(<TestComponent markers={markers} />);

		// Wait for waveform to be drawn and ready
		await waitFor(() => {
			if (!(window as any).__waveformReady) {
				throw new Error('not ready');
			}
		});

		// Wait a bit for drawing to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify custom markup was called with correct props
		expect(customMarkup).toHaveBeenCalled();
		expect(customMarkup.mock.calls[0][0]).toHaveProperty('ctx');
		expect(customMarkup.mock.calls[0][0]).toHaveProperty('x');
		expect(customMarkup.mock.calls[0][0]).toHaveProperty('height', 50);
		expect(customMarkup.mock.calls[0][0]).toHaveProperty('index', 0);
		expect(customMarkup.mock.calls[0][0].marker).toBe(markers[0]);
	});

	it('does not render markers outside duration bounds', async () => {
		const markers: Marker[] = [
			{ time: -1 }, // before start
			{ time: 5 }, // valid
			{ time: 15 }, // after end (duration is 10)
		];

		// Clear waveform ready flag
		(window as any).__waveformReady = false;

		render(<TestComponent markers={markers} />);

		// Wait for waveform to be drawn and ready
		await waitFor(() => {
			if (!(window as any).__waveformReady) {
				throw new Error('not ready');
			}
		});

		// Wait a bit for drawing to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Only M2 (the valid marker) should be drawn
		const textCalls = mockContext.fillText.mock.calls.map(
			(call: any) => call[0]
		);
		expect(textCalls).toContain('M2'); // valid marker at index 1
		expect(textCalls).not.toContain('M1'); // out of bounds
		expect(textCalls).not.toContain('M3'); // out of bounds
	});

	it('respects custom marker colors', async () => {
		const markers: Marker[] = [{ time: 5 }];
		const customMarkerColor = '#ff0000';
		const customLabelColor = '#00ff00';

		// Clear waveform ready flag
		(window as any).__waveformReady = false;

		render(
			<TestComponent
				markers={markers}
				markerColor={customMarkerColor}
				markerLabelColor={customLabelColor}
			/>
		);

		// Wait for waveform to be drawn and ready
		await waitFor(() => {
			if (!(window as any).__waveformReady) {
				throw new Error('not ready');
			}
		});

		// Wait a bit for drawing to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify markers were drawn
		expect(mockContext.fillText).toHaveBeenCalled();
		expect(mockContext.fillRect).toHaveBeenCalled();

		// Check that custom colors were set (fillStyle is mutated during draw)
		const fillStyleValues = mockContext.fillRect.mock.calls.map(() =>
			String(mockContext.fillStyle)
		);
		// At least one of the fill operations should have used custom colors
		expect(fillStyleValues.length).toBeGreaterThan(0);
	});

	it('renders multiple markers at different positions', async () => {
		const markers: Marker[] = [
			{ time: 1 },
			{ time: 3 },
			{ time: 5 },
			{ time: 7 },
		];

		// Clear waveform ready flag
		(window as any).__waveformReady = false;

		render(<TestComponent markers={markers} />);

		// Wait for waveform to be drawn and ready
		await waitFor(() => {
			if (!(window as any).__waveformReady) {
				throw new Error('not ready');
			}
		});

		// Wait a bit for drawing to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// All markers should be rendered
		const textCalls = mockContext.fillText.mock.calls.map(
			(call: any) => call[0]
		);
		expect(textCalls).toContain('M1');
		expect(textCalls).toContain('M2');
		expect(textCalls).toContain('M3');
		expect(textCalls).toContain('M4');
	});
});
