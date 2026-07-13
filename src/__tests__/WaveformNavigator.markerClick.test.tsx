import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, expect, it } from 'vitest';

import WaveformNavigator from '../WaveformNavigator';
import type { Marker } from '../WaveformNavigator';

const CANVAS_RECT = {
	left: 0,
	top: 0,
	width: 200,
	height: 50,
	right: 200,
	bottom: 50,
	x: 0,
	y: 0,
} as DOMRect;

function mockAudio() {
	(global as any).Audio = function () {
		const el = document.createElement('audio');
		(window as any).__lastAudio = el;
		return el;
	};
}

async function waitForAudio() {
	await waitFor(() => expect((window as any).__lastAudio).toBeTruthy());
	return (window as any).__lastAudio as HTMLAudioElement;
}

async function setDuration(audioEl: HTMLAudioElement, duration: number) {
	Object.defineProperty(audioEl, 'duration', {
		value: duration,
		configurable: true,
	});
	audioEl.dispatchEvent(new Event('loadedmetadata'));
}

async function waitForDuration(container: HTMLElement, duration: number) {
	await waitFor(() => {
		const el = container.querySelector('.waveform-interactive');
		if (el?.getAttribute('aria-valuemax') !== String(duration)) {
			throw new Error('duration not applied yet');
		}
	});
}

describe('WaveformNavigator marker click/hit-testing', () => {
	const origAudio = (global as any).Audio;
	const origGetBounding = HTMLCanvasElement.prototype.getBoundingClientRect;

	beforeEach(() => {
		HTMLCanvasElement.prototype.getBoundingClientRect = () => CANVAS_RECT;
	});

	afterEach(() => {
		(global as any).Audio = origAudio;
		HTMLCanvasElement.prototype.getBoundingClientRect = origGetBounding;
	});

	// duration = 120s, width = 200px → 1s = 200/120 ≈ 1.667px
	// marker at time=60 → markerX = 100

	it('clicking at a marker x fires onMarkerClick with the right marker/index and does not seek', async () => {
		mockAudio();
		const onCurrentTimeChange = vi.fn();
		const onMarkerClick = vi.fn();
		const markers: Marker[] = [{ time: 60, id: 'm1' }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				onCurrentTimeChange={onCurrentTimeChange}
				markers={markers}
				onMarkerClick={onMarkerClick}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.click(canvas, { clientX: 100, clientY: 10 });

		expect(onMarkerClick).toHaveBeenCalledTimes(1);
		expect(onMarkerClick.mock.calls[0][0]).toBe(markers[0]);
		expect(onMarkerClick.mock.calls[0][1]).toBe(0);
		expect(onCurrentTimeChange).not.toHaveBeenCalled();
	});

	it('clicking outside all marker labels seeks as before', async () => {
		mockAudio();
		const onCurrentTimeChange = vi.fn();
		const onMarkerClick = vi.fn();
		const markers: Marker[] = [{ time: 60 }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				onCurrentTimeChange={onCurrentTimeChange}
				markers={markers}
				onMarkerClick={onMarkerClick}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		// Marker is at x=100, far outside the default label hit region
		fireEvent.click(canvas, { clientX: 10, clientY: 10 });

		expect(onMarkerClick).not.toHaveBeenCalled();
		await waitFor(() => expect(onCurrentTimeChange).toHaveBeenCalled());
		const seekedTo = onCurrentTimeChange.mock.calls[0][0] as number;
		expect(Math.abs(seekedTo - 6)).toBeLessThan(1);
	});

	it('clicking the stem below the default label seeks instead of firing onMarkerClick', async () => {
		mockAudio();
		const onCurrentTimeChange = vi.fn();
		const onMarkerClick = vi.fn();
		const markers: Marker[] = [{ time: 60, id: 'm1' }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				onCurrentTimeChange={onCurrentTimeChange}
				markers={markers}
				onMarkerClick={onMarkerClick}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		// Label occupies y≈8–28; click the stem well below it at the marker x
		fireEvent.click(canvas, { clientX: 100, clientY: 40 });

		expect(onMarkerClick).not.toHaveBeenCalled();
		await waitFor(() => expect(onCurrentTimeChange).toHaveBeenCalled());
		const seekedTo = onCurrentTimeChange.mock.calls[0][0] as number;
		expect(Math.abs(seekedTo - 60)).toBeLessThan(1);
	});

	it('resolves overlapping hit regions to nearest marker', async () => {
		mockAudio();
		const onMarkerClick = vi.fn();
		// markerX for time=59 → (59/120)*200 ≈ 98.33; for time=61 → ≈101.67
		const markers: Marker[] = [
			{ time: 59, id: 'far' },
			{ time: 61, id: 'near' },
		];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				markers={markers}
				onMarkerClick={onMarkerClick}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		// click closer to the second marker (x=101, second marker at ~101.67, first at ~98.33)
		fireEvent.click(canvas, { clientX: 101, clientY: 10 });

		expect(onMarkerClick).toHaveBeenCalledTimes(1);
		expect(onMarkerClick.mock.calls[0][0]).toBe(markers[1]);
		expect(onMarkerClick.mock.calls[0][1]).toBe(1);
	});

	it('resolves ties to the lowest array index', async () => {
		mockAudio();
		const onMarkerClick = vi.fn();
		// Both markers land at the exact same x (time=60 → x=100)
		const markers: Marker[] = [
			{ time: 60, id: 'a' },
			{ time: 60, id: 'b' },
		];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				markers={markers}
				onMarkerClick={onMarkerClick}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.click(canvas, { clientX: 100, clientY: 10 });

		expect(onMarkerClick).toHaveBeenCalledTimes(1);
		expect(onMarkerClick.mock.calls[0][0]).toBe(markers[0]);
		expect(onMarkerClick.mock.calls[0][1]).toBe(0);
	});

	it('respects a custom hitTest that reports a hit far from the default label', async () => {
		mockAudio();
		const onMarkerClick = vi.fn();
		const hitTest = vi.fn(() => true);
		// marker at time=10 → markerX ≈ 16.67, far from click at x=180
		const markers: Marker[] = [{ time: 10, hitTest }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				markers={markers}
				onMarkerClick={onMarkerClick}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.click(canvas, { clientX: 180, clientY: 10 });

		expect(hitTest).toHaveBeenCalled();
		expect(onMarkerClick).toHaveBeenCalledTimes(1);
		expect(onMarkerClick.mock.calls[0][0]).toBe(markers[0]);
	});

	it('respects a custom hitTest that reports a miss inside the default label', async () => {
		mockAudio();
		const onCurrentTimeChange = vi.fn();
		const onMarkerClick = vi.fn();
		const hitTest = vi.fn(() => false);
		// marker at time=60 → markerX = 100, click right on top of it
		const markers: Marker[] = [{ time: 60, hitTest }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				onCurrentTimeChange={onCurrentTimeChange}
				markers={markers}
				onMarkerClick={onMarkerClick}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.click(canvas, { clientX: 100, clientY: 10 });

		expect(hitTest).toHaveBeenCalled();
		expect(onMarkerClick).not.toHaveBeenCalled();
		await waitFor(() => expect(onCurrentTimeChange).toHaveBeenCalled());
	});

	it('regression: with no onMarkerClick prop, a click at a marker x seeks as before', async () => {
		mockAudio();
		const onCurrentTimeChange = vi.fn();
		const markers: Marker[] = [{ time: 60 }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				onCurrentTimeChange={onCurrentTimeChange}
				markers={markers}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.click(canvas, { clientX: 100, clientY: 10 });

		await waitFor(() => expect(onCurrentTimeChange).toHaveBeenCalled());
		const seekedTo = onCurrentTimeChange.mock.calls[0][0] as number;
		expect(Math.abs(seekedTo - 60)).toBeLessThan(1);
	});

	it('with only onMarkerHover, clicking a marker still seeks as before', async () => {
		mockAudio();
		const onCurrentTimeChange = vi.fn();
		const onMarkerHover = vi.fn();
		const markers: Marker[] = [{ time: 60 }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				onCurrentTimeChange={onCurrentTimeChange}
				onMarkerHover={onMarkerHover}
				markers={markers}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.click(canvas, { clientX: 100, clientY: 10 });

		await waitFor(() => expect(onCurrentTimeChange).toHaveBeenCalled());
		const seekedTo = onCurrentTimeChange.mock.calls[0][0] as number;
		expect(Math.abs(seekedTo - 60)).toBeLessThan(1);
	});

	it('does not hit-test markers that are off-canvas', async () => {
		mockAudio();
		const onCurrentTimeChange = vi.fn();
		const onMarkerClick = vi.fn();
		const hitTest = vi.fn(() => true);
		const markers: Marker[] = [{ time: 130, hitTest }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				onCurrentTimeChange={onCurrentTimeChange}
				onMarkerClick={onMarkerClick}
				markers={markers}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.click(canvas, { clientX: 180, clientY: 10 });

		expect(hitTest).not.toHaveBeenCalled();
		expect(onMarkerClick).not.toHaveBeenCalled();
		await waitFor(() => expect(onCurrentTimeChange).toHaveBeenCalled());
	});

	it('touch tap on a marker fires onMarkerClick without seeking', async () => {
		mockAudio();
		const onCurrentTimeChange = vi.fn();
		const onMarkerClick = vi.fn();
		const markers: Marker[] = [{ time: 60, id: 'm1' }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				onCurrentTimeChange={onCurrentTimeChange}
				markers={markers}
				onMarkerClick={onMarkerClick}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;

		fireEvent.touchStart(canvas, { touches: [{ clientX: 100, clientY: 10 }] });
		expect(onCurrentTimeChange).not.toHaveBeenCalled();

		fireEvent.touchEnd(canvas, { touches: [] });

		expect(onMarkerClick).toHaveBeenCalledTimes(1);
		expect(onMarkerClick.mock.calls[0][0]).toBe(markers[0]);
		expect(onMarkerClick.mock.calls[0][1]).toBe(0);
		expect(onCurrentTimeChange).not.toHaveBeenCalled();
	});

	it('touch drag starting on a marker cancels the pending marker and falls back to scrub-seek', async () => {
		mockAudio();
		const onCurrentTimeChange = vi.fn();
		const onMarkerClick = vi.fn();
		const markers: Marker[] = [{ time: 60, id: 'm1' }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				onCurrentTimeChange={onCurrentTimeChange}
				markers={markers}
				onMarkerClick={onMarkerClick}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;

		fireEvent.touchStart(canvas, { touches: [{ clientX: 100, clientY: 10 }] });
		expect(onCurrentTimeChange).not.toHaveBeenCalled();

		// Move well beyond the ~10px slop
		fireEvent.touchMove(canvas, { touches: [{ clientX: 160, clientY: 10 }] });
		await waitFor(() => expect(onCurrentTimeChange).toHaveBeenCalled());

		fireEvent.touchEnd(canvas, { touches: [] });

		// The pending marker was cancelled by the drag, so no click should fire
		expect(onMarkerClick).not.toHaveBeenCalled();
	});

	it('with only onMarkerHover, touching a marker still seeks as before', async () => {
		mockAudio();
		const onCurrentTimeChange = vi.fn();
		const onMarkerHover = vi.fn();
		const markers: Marker[] = [{ time: 60 }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				onCurrentTimeChange={onCurrentTimeChange}
				onMarkerHover={onMarkerHover}
				markers={markers}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.touchStart(canvas, { touches: [{ clientX: 100, clientY: 10 }] });

		await waitFor(() => expect(onCurrentTimeChange).toHaveBeenCalled());
		const seekedTo = onCurrentTimeChange.mock.calls[0][0] as number;
		expect(Math.abs(seekedTo - 60)).toBeLessThan(1);
	});
});
