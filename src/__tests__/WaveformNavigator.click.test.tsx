import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, afterEach, expect, it } from 'vitest';

import WaveformNavigator from '../WaveformNavigator';

describe('WaveformNavigator click-to-seek', () => {
	const origAudio = (global as any).Audio;

	afterEach(() => {
		(global as any).Audio = origAudio;
		// restore any mocked getBoundingClientRect
		HTMLCanvasElement.prototype.getBoundingClientRect = origGetBounding;
	});

	const origGetBounding = HTMLCanvasElement.prototype.getBoundingClientRect;

	it('calls onCurrentTimeChange when controlled and canvas clicked', async () => {
		// Mock Audio constructor so we can dispatch events and control duration
		(global as any).Audio = function () {
			const el = document.createElement('audio');
			// make it findable by tests if needed
			(window as any).__lastAudio = el;
			return el;
		} as any;

		// Mock canvas bounding rect to provide width and left
		HTMLCanvasElement.prototype.getBoundingClientRect = function () {
			return {
				left: 0,
				top: 0,
				width: 200,
				height: 50,
				right: 200,
				bottom: 50,
				x: 0,
				y: 0,
			};
		} as any;

		const onCurrentTimeChange = vi.fn();

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				onCurrentTimeChange={onCurrentTimeChange}
				controlledCurrentTime={0}
			/>
		);

		// Wait for the internal audio element to be created by the hook
		await waitFor(() => expect((window as any).__lastAudio).toBeTruthy());
		// Simulate loadedmetadata to set duration in the hook
		const audioEl = (window as any).__lastAudio as HTMLAudioElement;
		Object.defineProperty(audioEl, 'duration', {
			value: 120,
			configurable: true,
		});
		audioEl.dispatchEvent(new Event('loadedmetadata'));

		// Wait for the component to update the duration state (aria-valuemax)
		await waitFor(() => {
			const interactive = container.querySelector(
				'.waveform-interactive'
			) as HTMLElement | null;
			if (!interactive) {
				throw new Error('interactive not mounted');
			}
			const max = interactive.getAttribute('aria-valuemax');
			if (max !== '120') {
				throw new Error('duration not applied yet');
			}
		});

		// Find the canvas and click in the middle (x=100)
		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		expect(canvas).toBeTruthy();
		fireEvent.click(canvas, { clientX: 100, clientY: 10 });

		await waitFor(() => expect(onCurrentTimeChange).toHaveBeenCalled());

		// Expect roughly (100/200)*120 = 60 seconds
		const calledWith = onCurrentTimeChange.mock.calls[0][0];
		expect(Math.abs(calledWith - 60)).toBeLessThan(1);
	});
});
