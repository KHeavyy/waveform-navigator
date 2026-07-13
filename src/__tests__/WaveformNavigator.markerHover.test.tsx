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

describe('WaveformNavigator onMarkerHover', () => {
	const origAudio = (global as any).Audio;
	const origGetBounding = HTMLCanvasElement.prototype.getBoundingClientRect;

	beforeEach(() => {
		HTMLCanvasElement.prototype.getBoundingClientRect = () => CANVAS_RECT;
	});

	afterEach(() => {
		(global as any).Audio = origAudio;
		HTMLCanvasElement.prototype.getBoundingClientRect = origGetBounding;
	});

	// duration = 120s, width = 200px → marker at time=60 → markerX = 100

	it('fires on enter with the marker and index', async () => {
		mockAudio();
		const onMarkerHover = vi.fn();
		const markers: Marker[] = [{ time: 60, id: 'm1' }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				markers={markers}
				onMarkerHover={onMarkerHover}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.mouseMove(canvas, { clientX: 100, clientY: 10 });

		expect(onMarkerHover).toHaveBeenCalledTimes(1);
		expect(onMarkerHover).toHaveBeenCalledWith(markers[0], 0);
	});

	it('fires on change when moving from one marker to another', async () => {
		mockAudio();
		const onMarkerHover = vi.fn();
		// time=10 → x≈16.67, time=110 → x≈183.33
		const markers: Marker[] = [
			{ time: 10, id: 'a' },
			{ time: 110, id: 'b' },
		];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				markers={markers}
				onMarkerHover={onMarkerHover}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.mouseMove(canvas, { clientX: 17, clientY: 10 });
		fireEvent.mouseMove(canvas, { clientX: 17, clientY: 10 }); // same marker again — no extra fire
		fireEvent.mouseMove(canvas, { clientX: 183, clientY: 10 });

		expect(onMarkerHover).toHaveBeenCalledTimes(2);
		expect(onMarkerHover.mock.calls[0]).toEqual([markers[0], 0]);
		expect(onMarkerHover.mock.calls[1]).toEqual([markers[1], 1]);
	});

	it('fires with (null, null) when leaving a marker without leaving the canvas', async () => {
		mockAudio();
		const onMarkerHover = vi.fn();
		const markers: Marker[] = [{ time: 60, id: 'm1' }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				markers={markers}
				onMarkerHover={onMarkerHover}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.mouseMove(canvas, { clientX: 100, clientY: 10 });
		fireEvent.mouseMove(canvas, { clientX: 10, clientY: 10 });

		expect(onMarkerHover).toHaveBeenCalledTimes(2);
		expect(onMarkerHover.mock.calls[0]).toEqual([markers[0], 0]);
		expect(onMarkerHover.mock.calls[1]).toEqual([null, null]);
	});

	it('fires with (null, null) on canvas leave', async () => {
		mockAudio();
		const onMarkerHover = vi.fn();
		const markers: Marker[] = [{ time: 60, id: 'm1' }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				markers={markers}
				onMarkerHover={onMarkerHover}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.mouseMove(canvas, { clientX: 100, clientY: 10 });
		expect(onMarkerHover).toHaveBeenCalledTimes(1);

		fireEvent.mouseLeave(canvas);

		expect(onMarkerHover).toHaveBeenCalledTimes(2);
		expect(onMarkerHover.mock.calls[1]).toEqual([null, null]);
	});

	it('does not fire when the pointer never enters a marker hit region', async () => {
		mockAudio();
		const onMarkerHover = vi.fn();
		const markers: Marker[] = [{ time: 60, id: 'm1' }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				markers={markers}
				onMarkerHover={onMarkerHover}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.mouseMove(canvas, { clientX: 10, clientY: 10 });

		expect(onMarkerHover).not.toHaveBeenCalled();
	});

	it('touch start on a marker fires onMarkerHover so markup can see hovered', async () => {
		mockAudio();
		const onMarkerHover = vi.fn();
		const markers: Marker[] = [{ time: 60, id: 'm1' }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				markers={markers}
				onMarkerHover={onMarkerHover}
				onMarkerClick={() => {}}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.touchStart(canvas, { touches: [{ clientX: 100, clientY: 10 }] });

		expect(onMarkerHover).toHaveBeenCalledTimes(1);
		expect(onMarkerHover).toHaveBeenCalledWith(markers[0], 0);

		fireEvent.touchEnd(canvas, { touches: [] });

		expect(onMarkerHover).toHaveBeenCalledTimes(2);
		expect(onMarkerHover.mock.calls[1]).toEqual([null, null]);
	});

	it('touch drag beyond slop clears hover when leaving a pending marker', async () => {
		mockAudio();
		const onMarkerHover = vi.fn();
		const markers: Marker[] = [{ time: 60, id: 'm1' }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				controlledCurrentTime={0}
				markers={markers}
				onMarkerHover={onMarkerHover}
				onMarkerClick={() => {}}
			/>
		);

		const audioEl = await waitForAudio();
		await act(async () => setDuration(audioEl, 120));
		await waitForDuration(container, 120);

		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		fireEvent.touchStart(canvas, { touches: [{ clientX: 100, clientY: 10 }] });
		expect(onMarkerHover).toHaveBeenCalledWith(markers[0], 0);

		fireEvent.touchMove(canvas, { touches: [{ clientX: 160, clientY: 10 }] });

		expect(onMarkerHover).toHaveBeenCalledTimes(2);
		expect(onMarkerHover.mock.calls[1]).toEqual([null, null]);
	});
});
