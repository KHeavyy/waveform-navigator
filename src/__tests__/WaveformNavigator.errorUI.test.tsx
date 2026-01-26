import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import WaveformNavigator from '../WaveformNavigator';

describe('WaveformNavigator error UI', () => {
	it('shows error UI when waveform hook reports an error', async () => {
		// Remove AudioContext so useWaveformData will call onError
		const origAC = (window as any).AudioContext;
		const origRO = (global as any).ResizeObserver;
		(window as any).AudioContext = undefined;
		// Ensure ResizeObserver is constructible for this test
		(global as any).ResizeObserver = class {
			cb: ResizeObserverCallback;
			constructor(cb: ResizeObserverCallback) {
				this.cb = cb;
			}
			observe() {}
			disconnect() {}
			unobserve() {}
		};

		const file = new File([new ArrayBuffer(8)], 'test.wav', {
			type: 'audio/wav',
		});
		(file as any).arrayBuffer = async () => new ArrayBuffer(8);

		render(<WaveformNavigator audio={file} />);

		await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
		(window as any).AudioContext = origAC;
		(global as any).ResizeObserver = origRO;
	});
});
