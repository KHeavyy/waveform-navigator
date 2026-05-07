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
	Object.defineProperty(document, 'hidden', {
		value: hidden,
		configurable: true,
	});
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
		Object.defineProperty(document, 'hidden', {
			value: false,
			configurable: true,
		});
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
		// Override el.paused and el.readyState to reflect healthy playback.
		Object.defineProperty(audioEl, 'paused', {
			get: () => false,
			configurable: true,
		});
		Object.defineProperty(audioEl, 'readyState', {
			get: () => HTMLMediaElement.HAVE_ENOUGH_DATA, // 4 — fully healthy
			configurable: true,
		});

		// Tab becomes visible; el is not stalled, so no resume needed
		await act(async () => {
			setHidden(false);
		});

		expect(playSpy).not.toHaveBeenCalled();
	});

	it('does not force recovery when currentTime advanced while hidden without timeupdate events', async () => {
		vi.useFakeTimers();
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		vi.useRealTimers();
		const audioEl = await waitForAudio();
		vi.useFakeTimers();
		const playSpy = spyOnPlay(audioEl);

		Object.defineProperty(audioEl, 'currentTime', {
			value: 10,
			writable: true,
			configurable: true,
		});
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		await act(async () => {
			setHidden(true);
		});

		Object.defineProperty(audioEl, 'paused', {
			get: () => false,
			configurable: true,
		});
		Object.defineProperty(audioEl, 'readyState', {
			get: () => HTMLMediaElement.HAVE_ENOUGH_DATA,
			configurable: true,
		});
		Object.defineProperty(audioEl, 'currentTime', {
			value: 14,
			writable: true,
			configurable: true,
		});

		await act(async () => {
			vi.advanceTimersByTime(5000);
		});

		await act(async () => {
			setHidden(false);
		});

		expect(playSpy).not.toHaveBeenCalled();
		vi.useRealTimers();
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

	it('recovers when stalled but not paused on visibility return', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);

		// Simulate audio playing
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		// Tab goes hidden while playing
		await act(async () => {
			setHidden(true);
		});

		// Browser did NOT pause the audio (e.g. Chrome on Android), but it is
		// stalled — paused=false yet readyState drops below HAVE_FUTURE_DATA (3).
		Object.defineProperty(audioEl, 'paused', {
			get: () => false,
			configurable: true,
		});
		Object.defineProperty(audioEl, 'readyState', {
			get: () => HTMLMediaElement.HAVE_CURRENT_DATA, // 2 — stalled
			configurable: true,
		});

		// Tab becomes visible — isStalled() should be true → recovery fires
		await act(async () => {
			setHidden(false);
		});

		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('respects MAX_RECOVERY_ATTEMPTS cap and does not loop indefinitely', async () => {
		vi.useFakeTimers();

		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		// waitForAudio uses waitFor which relies on real timers, so we briefly
		// restore them for setup, then re-enable fake timers for the assertion.
		vi.useRealTimers();
		const audioEl = await waitForAudio();
		vi.useFakeTimers();

		const playSpy = spyOnPlay(audioEl);

		// Simulate playing
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		// Tab hidden
		await act(async () => {
			setHidden(true);
		});

		// Keep element in a persistently stalled state (paused=true) so every
		// escalation attempt still sees a stall and would fire another play()
		// if there were no retry cap.
		// el.paused defaults to true on a fresh audio element.

		// Tab visible — first recovery attempt
		await act(async () => {
			setHidden(false);
		});

		// Advance through both escalation intervals to trigger attempts 2 and 3
		await act(async () => {
			vi.advanceTimersByTime(1500); // attempt 2
		});
		await act(async () => {
			vi.advanceTimersByTime(1500); // attempt 3
		});

		// One more interval — must NOT trigger a 4th attempt
		await act(async () => {
			vi.advanceTimersByTime(1500);
		});

		// At most MAX_RECOVERY_ATTEMPTS (3) play() calls; never more
		expect(playSpy.mock.calls.length).toBeLessThanOrEqual(3);

		vi.useRealTimers();
	});

	it('stops scheduled recovery retries when user pauses during recovery', async () => {
		vi.useFakeTimers();
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		vi.useRealTimers();
		const audioEl = await waitForAudio();
		vi.useFakeTimers();
		const playSpy = spyOnPlay(audioEl);

		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		await act(async () => {
			setHidden(true);
		});

		await act(async () => {
			setHidden(false);
		});

		expect(playSpy).toHaveBeenCalledTimes(1);

		await act(async () => {
			audioEl.dispatchEvent(new Event('pause'));
		});

		await act(async () => {
			vi.advanceTimersByTime(5000);
		});

		expect(playSpy).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it('does not trigger recovery when playback was not active before hidden', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);

		// Audio is never played — wasPlayingBeforeHidden stays false

		// Even though element is "stalled" (paused by default), no recovery fires
		await act(async () => {
			setHidden(true);
		});

		await act(async () => {
			setHidden(false);
		});

		expect(playSpy).not.toHaveBeenCalled();
	});
});
