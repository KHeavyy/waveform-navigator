import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, expect, it } from 'vitest';

import WaveformNavigator from '../WaveformNavigator';

// ─── shared helpers ──────────────────────────────────────────────────────────

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

function mockMatchMedia(isMobile: boolean) {
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: isMobile && query === '(max-width: 480px)',
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}));
}

// ─── test suite ──────────────────────────────────────────────────────────────

describe('WaveformNavigator – mobile features', () => {
	const origAudio = (global as any).Audio;
	const origGetBounding = HTMLCanvasElement.prototype.getBoundingClientRect;
	const origMatchMedia = window.matchMedia;

	beforeEach(() => {
		HTMLCanvasElement.prototype.getBoundingClientRect = () => CANVAS_RECT;
	});

	afterEach(() => {
		(global as any).Audio = origAudio;
		HTMLCanvasElement.prototype.getBoundingClientRect = origGetBounding;
		window.matchMedia = origMatchMedia;
	});

	// ── touch seeking ──────────────────────────────────────────────────────

	describe('touch seeking on the waveform canvas', () => {
		it('seeks to the correct position on touchstart', async () => {
			mockAudio();
			const onCurrentTimeChange = vi.fn();

			const { container } = render(
				<WaveformNavigator
					audio="/test.mp3"
					responsive={false}
					onCurrentTimeChange={onCurrentTimeChange}
					controlledCurrentTime={0}
				/>
			);

			const audioEl = await waitForAudio();
			await act(async () => setDuration(audioEl, 120));
			await waitForDuration(container, 120);

			const canvas = container.querySelector('canvas') as HTMLCanvasElement;

			// Touch at x=100 on a 200 px canvas → 50 % of 120 s = 60 s
			fireEvent.touchStart(canvas, {
				touches: [{ clientX: 100, clientY: 10 }],
			});

			await waitFor(() => expect(onCurrentTimeChange).toHaveBeenCalled());
			const seekedTo = onCurrentTimeChange.mock.calls[0][0] as number;
			expect(Math.abs(seekedTo - 60)).toBeLessThan(1);
		});

		it('clamps seek position to the start of the track when touch is before the canvas', async () => {
			mockAudio();
			const onCurrentTimeChange = vi.fn();

			const { container } = render(
				<WaveformNavigator
					audio="/test.mp3"
					responsive={false}
					onCurrentTimeChange={onCurrentTimeChange}
					controlledCurrentTime={0}
				/>
			);

			const audioEl = await waitForAudio();
			await act(async () => setDuration(audioEl, 120));
			await waitForDuration(container, 120);

			const canvas = container.querySelector('canvas') as HTMLCanvasElement;
			// clientX=-50 is before the left edge of the canvas (left=0), should clamp to 0 s
			fireEvent.touchStart(canvas, {
				touches: [{ clientX: -50, clientY: 10 }],
			});

			await waitFor(() => expect(onCurrentTimeChange).toHaveBeenCalled());
			const seekedTo = onCurrentTimeChange.mock.calls[0][0] as number;
			expect(seekedTo).toBe(0);
		});

		it('updates the seek position continuously during touchmove', async () => {
			mockAudio();
			const onCurrentTimeChange = vi.fn();

			const { container } = render(
				<WaveformNavigator
					audio="/test.mp3"
					responsive={false}
					onCurrentTimeChange={onCurrentTimeChange}
					controlledCurrentTime={0}
				/>
			);

			const audioEl = await waitForAudio();
			await act(async () => setDuration(audioEl, 120));
			await waitForDuration(container, 120);

			const canvas = container.querySelector('canvas') as HTMLCanvasElement;

			// Start near the beginning, then move toward the end
			fireEvent.touchStart(canvas, { touches: [{ clientX: 40, clientY: 10 }] });
			fireEvent.touchMove(canvas, { touches: [{ clientX: 160, clientY: 10 }] });

			await waitFor(() =>
				expect(onCurrentTimeChange.mock.calls.length).toBeGreaterThanOrEqual(2)
			);

			// The first call should be for an earlier time than the second
			const first = onCurrentTimeChange.mock.calls[0][0] as number; // ~24 s
			const last = onCurrentTimeChange.mock.calls[
				onCurrentTimeChange.mock.calls.length - 1
			][0] as number; // ~96 s
			expect(first).toBeLessThan(last);
		});

		it('shows the hover tooltip during a touch and hides it on touchend', async () => {
			mockAudio();

			const { container } = render(
				<WaveformNavigator audio="/test.mp3" responsive={false} />
			);

			const audioEl = await waitForAudio();
			await act(async () => setDuration(audioEl, 120));

			const canvas = container.querySelector('canvas') as HTMLCanvasElement;

			fireEvent.touchStart(canvas, { touches: [{ clientX: 100, clientY: 10 }] });
			await waitFor(() =>
				expect(container.querySelector('.hover-tooltip')).toBeTruthy()
			);

			fireEvent.touchEnd(canvas);
			await waitFor(() =>
				expect(container.querySelector('.hover-tooltip')).toBeFalsy()
			);
		});
	});

	// ── timeColor style prop ───────────────────────────────────────────────

	describe('timeColor style prop', () => {
		it('applies a custom timeColor to the time display element', () => {
			const { container } = render(
				<WaveformNavigator
					audio="/test.mp3"
					responsive={false}
					styles={{ timeColor: '#ff0000' }}
				/>
			);

			const time = container.querySelector('.time') as HTMLElement;
			expect(time).toBeTruthy();
			// Inline style should reference the supplied colour; JSDOM typically
			// normalises hex values to rgb() so we accept either form.
			const style = time.getAttribute('style') ?? '';
			expect(style).toMatch(/color/i);
			// rgb(255, 0, 0) or #ff0000
			expect(time.style.color).toMatch(/rgb\(255,\s*0,\s*0\)|#ff0000/i);
		});

		it('applies the default timeColor when none is supplied', () => {
			const { container } = render(
				<WaveformNavigator audio="/test.mp3" responsive={false} />
			);

			const time = container.querySelector('.time') as HTMLElement;
			expect(time).toBeTruthy();
			// Default is #374151 → rgb(55, 65, 81)
			expect(time.style.color).toMatch(/rgb\(55,\s*65,\s*81\)|#374151/i);
		});

		it('uses a different colour when timeColor is changed', () => {
			const { container: c1 } = render(
				<WaveformNavigator
					audio="/test.mp3"
					responsive={false}
					styles={{ timeColor: '#0000ff' }}
				/>
			);
			const { container: c2 } = render(
				<WaveformNavigator
					audio="/test.mp3"
					responsive={false}
					styles={{ timeColor: '#ff0000' }}
				/>
			);

			const blue = (c1.querySelector('.time') as HTMLElement).style.color;
			const red = (c2.querySelector('.time') as HTMLElement).style.color;
			expect(blue).not.toBe(red);
		});
	});

	// ── collapsible volume on mobile ───────────────────────────────────────

	describe('collapsible volume control', () => {
		it('speaker button shows vol-popup on narrow containers', async () => {
			mockAudio();
			mockMatchMedia(true); // simulate mobile

			const { container } = render(
				<WaveformNavigator audio="/test.mp3" responsive={false} />
			);

			expect(container.querySelector('.vol-popup')).toBeNull();

			const speaker = container.querySelector('.speaker') as HTMLButtonElement;
			fireEvent.click(speaker);

			await waitFor(() =>
				expect(container.querySelector('.vol-popup')).toBeTruthy()
			);
		});

		it('second speaker click hides vol-popup on narrow containers', async () => {
			mockAudio();
			mockMatchMedia(true);

			const { container } = render(
				<WaveformNavigator audio="/test.mp3" responsive={false} />
			);

			const speaker = container.querySelector('.speaker') as HTMLButtonElement;

			// Open
			fireEvent.click(speaker);
			await waitFor(() =>
				expect(container.querySelector('.vol-popup')).toBeTruthy()
			);

			// Close
			fireEvent.click(speaker);
			await waitFor(() =>
				expect(container.querySelector('.vol-popup')).toBeFalsy()
			);
		});

		it('speaker button does NOT show vol-popup on wide containers', async () => {
			mockAudio();

			// Simulate a wide container so clientWidth > 480
			const originalClientWidth = Object.getOwnPropertyDescriptor(
				HTMLElement.prototype,
				'clientWidth'
			);
			Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
				configurable: true,
				get() {
					return 800;
				},
			});

			const { container } = render(
				<WaveformNavigator audio="/test.mp3" responsive={false} />
			);

			const speaker = container.querySelector('.speaker') as HTMLButtonElement;
			fireEvent.click(speaker);

			await new Promise((r) => setTimeout(r, 50));

			expect(container.querySelector('.vol-popup')).toBeFalsy();

			// Restore
			if (originalClientWidth) {
				Object.defineProperty(
					HTMLElement.prototype,
					'clientWidth',
					originalClientWidth
				);
			} else {
				// @ts-expect-error restoring
				delete HTMLElement.prototype.clientWidth;
			}
		});

		it('volume slider is rendered inside .right regardless of open state', () => {
			const { container } = render(
				<WaveformNavigator audio="/test.mp3" responsive={false} />
			);

			// The input itself should always be in the DOM; CSS hides it on mobile
			const slider = container.querySelector('.vol-range');
			expect(slider).toBeTruthy();
		});
	});
});
