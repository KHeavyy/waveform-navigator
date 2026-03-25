import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

describe('useWaveformData when AudioContext is missing', () => {
	it('calls onError with AudioContext not supported message', async () => {
		// Ensure AudioContext is undefined
		const orig = (window as any).AudioContext;
		(window as any).AudioContext = undefined;

		const onPeaksComputed = vi.fn();
		const onError = vi.fn();

		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent() {
			const file = new File([new ArrayBuffer(8)], 'test.wav', {
				type: 'audio/wav',
			});
			(file as any).arrayBuffer = async () => new ArrayBuffer(8);
			useWaveformData({
				audio: file,
				width: 100,
				barWidth: 2,
				gap: 1,
				onPeaksComputed,
				onError,
			} as any);
			return <div />;
		}

		render(<TestComponent />);

		await waitFor(() => expect(onError).toHaveBeenCalled());
		expect(onError.mock.calls[0][0].message).toContain(
			'AudioContext not supported'
		);
		(window as any).AudioContext = orig;
	});
});
