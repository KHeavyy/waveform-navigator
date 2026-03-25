import { render, waitFor } from '@testing-library/react';
import { vi, describe, afterEach, it, expect } from 'vitest';

// Mock fetch to return a buffer
const originalFetch = global.fetch;

describe('useWaveformData decode failure', () => {
	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('calls onError when decodeAudioData throws', async () => {
		global.fetch = vi.fn(
			async () =>
				({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }) as any
		) as any;

		// Mock AudioContext to throw on decode
		(window as any).AudioContext = class {
			async decodeAudioData(_: ArrayBuffer) {
				throw new Error('decode failed');
			}
			close() {}
		};

		const onError = vi.fn();

		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent() {
			useWaveformData({
				audio: '/dummy.mp3',
				width: 100,
				barWidth: 2,
				gap: 1,
				onError,
			} as any);
			return <div />;
		}

		render(<TestComponent />);

		await waitFor(() => expect(onError).toHaveBeenCalled());
	});
});
