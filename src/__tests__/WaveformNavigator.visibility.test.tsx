import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, expect, it } from 'vitest';

import WaveformNavigator from '../WaveformNavigator';

// ─── helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Create a fresh vi.fn() spy as an own property on the element so it
 * doesn't inherit or accumulate state from the shared prototype mock in setup.ts.
 */
function spyOnPlay(audioEl: HTMLAudioElement) {
	const spy = vi.fn().mockResolvedValue(undefined);
	Object.defineProperty(audioEl, 'play', { value: spy, configurable: true });
	return spy;
}

function setHidden(hidden: boolean) {
	Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
	document.dispatchEvent(new Event('visibilitychange'));
}

function dispatchPageShow(persisted: boolean) {
	const ev = new Event('pageshow') as PageTransitionEvent;
	Object.defineProperty(ev, 'persisted', { value: persisted });
	window.dispatchEvent(ev);
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('WaveformNavigator – visibility / bfcache resume', () => {
	const origAudio = (global as any).Audio;
	const origHidden = Object.getOwnPropertyDescriptor(document, 'hidden');

	beforeEach(() => {
		Object.defineProperty(document, 'hidden', { value: false, configurable: true });
	});

	afterEach(() => {
		(global as any).Audio = origAudio;
		(window as any).__lastAudio = undefined;
		if (origHidden) {
			Object.defineProperty(document, 'hidden', origHidden);
		}
	});

	it('resumes playback when the tab becomes visible after the browser paused it', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);

		// Simulate audio playing
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		// Tab goes hidden while audio is playing
		await act(async () => {
			setHidden(true);
		});

		// Browser pauses the audio (e.g. Safari background-tab policy)
		await act(async () => {
			audioEl.dispatchEvent(new Event('pause'));
		});

		// Tab becomes visible again
		await act(async () => {
			setHidden(false);
		});

		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('does not resume when audio was already paused before the tab was hidden', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);

		// Audio is never played — isPlaying stays false
		await act(async () => {
			setHidden(true);
		});

		await act(async () => {
			setHidden(false);
		});

		expect(playSpy).not.toHaveBeenCalled();
	});

	it('does not call play() when audio is still playing on tab return (desktop browsers)', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);

		// Simulate playing
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		// Tab goes hidden
		await act(async () => {
			setHidden(true);
		});

		// Audio keeps playing in background (Chrome / Firefox) — no pause event.
		// Override el.paused to reflect the element is not paused.
		Object.defineProperty(audioEl, 'paused', {
			get: () => false,
			configurable: true,
		});

		// Tab becomes visible; el.paused is false, so no resume needed
		await act(async () => {
			setHidden(false);
		});

		expect(playSpy).not.toHaveBeenCalled();
	});

	it('restores currentTime when browser resets it to 0 on visibility return', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		spyOnPlay(audioEl);

		// Simulate playing at 42 s
		Object.defineProperty(audioEl, 'currentTime', {
			value: 42,
			writable: true,
			configurable: true,
		});
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		// Tab goes hidden (position saved)
		await act(async () => {
			setHidden(true);
		});

		// Browser pauses and resets position (bfcache-style reset)
		Object.defineProperty(audioEl, 'currentTime', {
			value: 0,
			writable: true,
			configurable: true,
		});
		await act(async () => {
			audioEl.dispatchEvent(new Event('pause'));
		});

		// Tab becomes visible
		await act(async () => {
			setHidden(false);
		});

		expect(audioEl.currentTime).toBe(42);
	});

	it('resumes via pageshow with persisted=true (bfcache restore)', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);

		// Simulate playing
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		// Page goes hidden before being frozen into bfcache
		await act(async () => {
			setHidden(true);
		});

		// Browser pauses audio
		await act(async () => {
			audioEl.dispatchEvent(new Event('pause'));
		});

		// Page restored from bfcache
		await act(async () => {
			dispatchPageShow(true);
		});

		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('does not resume via pageshow when persisted=false (normal navigation)', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);

		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		await act(async () => {
			setHidden(true);
		});

		await act(async () => {
			audioEl.dispatchEvent(new Event('pause'));
		});

		// Normal (non-bfcache) pageshow
		await act(async () => {
			dispatchPageShow(false);
		});

		expect(playSpy).not.toHaveBeenCalled();
	});
});
