import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, afterEach, expect, it } from 'vitest';

import WaveformNavigator from '../WaveformNavigator';
import type { Marker } from '../WaveformNavigator';

describe('WaveformNavigator markers prop', () => {
	const origAudio = (global as any).Audio;

	afterEach(() => {
		(global as any).Audio = origAudio;
	});

	it('renders without markers by default', async () => {
		(global as any).Audio = function () {
			const el = document.createElement('audio');
			(window as any).__lastAudio = el;
			return el;
		} as any;

		const { container } = render(
			<WaveformNavigator audio="/test.mp3" responsive={false} />
		);

		await waitFor(() => expect((window as any).__lastAudio).toBeTruthy());
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	it('accepts markers prop as an empty array', async () => {
		(global as any).Audio = function () {
			const el = document.createElement('audio');
			(window as any).__lastAudio = el;
			return el;
		} as any;

		const markers: Marker[] = [];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				markers={markers}
				responsive={false}
			/>
		);

		await waitFor(() => expect((window as any).__lastAudio).toBeTruthy());
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	it('accepts markers prop with time values', async () => {
		(global as any).Audio = function () {
			const el = document.createElement('audio');
			(window as any).__lastAudio = el;
			return el;
		} as any;

		const markers: Marker[] = [{ time: 10 }, { time: 20 }, { time: 30 }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				markers={markers}
				responsive={false}
			/>
		);

		await waitFor(() => expect((window as any).__lastAudio).toBeTruthy());
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	it('accepts markers with custom markup functions', async () => {
		(global as any).Audio = function () {
			const el = document.createElement('audio');
			(window as any).__lastAudio = el;
			return el;
		} as any;

		const customMarkup = (props: any) => {
			props.ctx.fillStyle = '#ff0000';
			props.ctx.fillRect(props.x - 5, 0, 10, props.height);
		};

		const markers: Marker[] = [
			{ time: 10 },
			{ time: 20, markup: customMarkup },
		];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				markers={markers}
				responsive={false}
			/>
		);

		await waitFor(() => expect((window as any).__lastAudio).toBeTruthy());
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	it('accepts custom marker colors via styles prop', async () => {
		(global as any).Audio = function () {
			const el = document.createElement('audio');
			(window as any).__lastAudio = el;
			return el;
		} as any;

		const markers: Marker[] = [{ time: 15 }];

		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				markers={markers}
				responsive={false}
				styles={{
					markerColor: '#ff0000',
					markerLabelColor: '#00ff00',
				}}
			/>
		);

		await waitFor(() => expect((window as any).__lastAudio).toBeTruthy());
		expect(container.querySelector('canvas')).toBeTruthy();
	});
});


