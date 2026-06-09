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

function definePaused(audioEl: HTMLAudioElement, paused: boolean) {
	Object.defineProperty(audioEl, 'paused', {
		get: () => paused,
		configurable: true,
	});
}

function defineCurrentTime(audioEl: HTMLAudioElement, time: number) {
	Object.defineProperty(audioEl, 'currentTime', {
		value: time,
		writable: true,
		configurable: true,
	});
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

		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		await act(async () => {
			setHidden(true);
		});

		// Browser pauses the audio (e.g. Safari background-tab policy)
		await act(async () => {
			audioEl.dispatchEvent(new Event('pause'));
		});

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

		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		await act(async () => {
			setHidden(true);
		});

		// Audio keeps playing in background (Chrome / Firefox) — no pause event.
		definePaused(audioEl, false);

		await act(async () => {
			setHidden(false);
		});

		expect(playSpy).not.toHaveBeenCalled();
	});

	it('does not force recovery when currentTime advanced while hidden without timeupdate events', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);

		defineCurrentTime(audioEl, 10);
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		await act(async () => {
			setHidden(true);
		});

		// Element kept playing while hidden (desktop browsers don't pause).
		definePaused(audioEl, false);
		defineCurrentTime(audioEl, 14);

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

		defineCurrentTime(audioEl, 42);
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		await act(async () => {
			setHidden(true);
		});

		// Browser pauses and resets position (bfcache-style reset)
		defineCurrentTime(audioEl, 0);
		await act(async () => {
			audioEl.dispatchEvent(new Event('pause'));
		});

		await act(async () => {
			setHidden(false);
		});

		expect(audioEl.currentTime).toBe(42);
	});

	it('also restores currentTime when browser resets it to a tiny non-zero value', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		spyOnPlay(audioEl);

		defineCurrentTime(audioEl, 30);
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		await act(async () => {
			setHidden(true);
		});

		// Some browsers drop currentTime to a small non-zero value during eviction.
		defineCurrentTime(audioEl, 0.05);
		await act(async () => {
			audioEl.dispatchEvent(new Event('pause'));
		});

		await act(async () => {
			setHidden(false);
		});

		expect(audioEl.currentTime).toBe(30);
	});

	it('resumes via pageshow with persisted=true (bfcache restore)', async () => {
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

		await act(async () => {
			dispatchPageShow(false);
		});

		expect(playSpy).not.toHaveBeenCalled();
	});

	it('does not trigger recovery when playback was not active before hidden', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);

		await act(async () => {
			setHidden(true);
		});

		await act(async () => {
			setHidden(false);
		});

		expect(playSpy).not.toHaveBeenCalled();
	});

	// ─── new behaviour: reconcile UI to element on every return ─────────────────

	it('syncs isPlaying=false on visibility return when element is paused', async () => {
		mockAudio();

		const onPause = vi.fn();
		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				onPause={onPause}
			/>
		);

		const audioEl = await waitForAudio();
		spyOnPlay(audioEl);

		// Drive React into "playing" state.
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		expect(container.querySelector('button.play')?.getAttribute('aria-label')).toBe(
			'pause'
		);

		await act(async () => {
			setHidden(true);
		});

		// Simulate the pathological case: browser paused without firing pause,
		// and the late pause event also clears wasPlayingBeforeHidden BEFORE
		// visibility returns (race we previously failed to handle).
		definePaused(audioEl, true);
		defineCurrentTime(audioEl, 0);
		// Clear intent so resumeIfNeeded won't fire — this isolates the sync.
		await act(async () => {
			Object.defineProperty(document, 'hidden', {
				value: false,
				configurable: true,
			});
			audioEl.dispatchEvent(new Event('pause'));
		});

		// Now dispatch visibilitychange to trigger sync; element is paused, so
		// the button must reflect that even though no resume runs.
		await act(async () => {
			document.dispatchEvent(new Event('visibilitychange'));
		});

		expect(
			container.querySelector('button.play')?.getAttribute('aria-label')
		).toBe('play');
	});

	it('reloads source and resumes when first play() rejects on visibility return', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();

		// First play() rejects; reload then succeeds.
		const playSpy = vi
			.fn()
			.mockRejectedValueOnce(new Error('NotAllowedError'))
			.mockResolvedValue(undefined);
		Object.defineProperty(audioEl, 'play', {
			value: playSpy,
			configurable: true,
		});

		// load() triggers our canplay listener.
		const loadSpy = vi.fn(() => {
			queueMicrotask(() => audioEl.dispatchEvent(new Event('canplay')));
		});
		Object.defineProperty(audioEl, 'load', {
			value: loadSpy,
			configurable: true,
		});
		Object.defineProperty(audioEl, 'currentSrc', {
			get: () => '/test.mp3',
			configurable: true,
		});

		defineCurrentTime(audioEl, 20);
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		await act(async () => {
			setHidden(true);
		});

		definePaused(audioEl, true);
		defineCurrentTime(audioEl, 0);

		await act(async () => {
			setHidden(false);
		});

		// Let the reload pipeline drain.
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(loadSpy).toHaveBeenCalled();
		expect(playSpy).toHaveBeenCalledTimes(2);
	});

	it('shows paused UI when reload also fails', async () => {
		mockAudio();

		const { container } = render(
			<WaveformNavigator audio="/test.mp3" responsive={false} />
		);

		const audioEl = await waitForAudio();

		const playSpy = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
		Object.defineProperty(audioEl, 'play', {
			value: playSpy,
			configurable: true,
		});

		// load() triggers an error to make the reload path fail.
		Object.defineProperty(audioEl, 'load', {
			value: vi.fn(() => {
				queueMicrotask(() => audioEl.dispatchEvent(new Event('error')));
			}),
			configurable: true,
		});
		Object.defineProperty(audioEl, 'currentSrc', {
			get: () => '/test.mp3',
			configurable: true,
		});

		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		await act(async () => {
			setHidden(true);
		});

		definePaused(audioEl, true);

		await act(async () => {
			setHidden(false);
		});

		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		// After both attempts fail, UI must reflect the paused element state.
		expect(
			container.querySelector('button.play')?.getAttribute('aria-label')
		).toBe('play');
	});

	it('resets isPlaying when the audio element fires error', async () => {
		mockAudio();

		const { container } = render(
			<WaveformNavigator audio="/test.mp3" responsive={false} />
		);

		const audioEl = await waitForAudio();
		spyOnPlay(audioEl);

		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		expect(container.querySelector('button.play')?.getAttribute('aria-label')).toBe(
			'pause'
		);

		// Simulate a media error fired after play with no preceding pause event.
		Object.defineProperty(audioEl, 'error', {
			get: () => ({ code: 3 }), // MEDIA_ERR_DECODE
			configurable: true,
		});
		await act(async () => {
			audioEl.dispatchEvent(new Event('error'));
		});

		expect(
			container.querySelector('button.play')?.getAttribute('aria-label')
		).toBe('play');
	});

	it('resets isPlaying when the audio element fires emptied', async () => {
		mockAudio();

		const { container } = render(
			<WaveformNavigator audio="/test.mp3" responsive={false} />
		);

		const audioEl = await waitForAudio();
		spyOnPlay(audioEl);

		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		expect(container.querySelector('button.play')?.getAttribute('aria-label')).toBe(
			'pause'
		);

		await act(async () => {
			audioEl.dispatchEvent(new Event('emptied'));
		});

		expect(
			container.querySelector('button.play')?.getAttribute('aria-label')
		).toBe('play');
	});

	it('resets isPlaying when togglePlay rejects', async () => {
		mockAudio();

		const { container } = render(
			<WaveformNavigator audio="/test.mp3" responsive={false} />
		);

		const audioEl = await waitForAudio();
		Object.defineProperty(audioEl, 'play', {
			value: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
			configurable: true,
		});

		// Force the "playing" state without going through play() so togglePlay's
		// catch branch is the only thing that can flip it back.
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});
		// Now make el.paused report true so togglePlay invokes play() again.
		definePaused(audioEl, true);

		const button = container.querySelector('button.play') as HTMLButtonElement;
		await act(async () => {
			button.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(
			container.querySelector('button.play')?.getAttribute('aria-label')
		).toBe('play');
	});

	it('cancels in-flight reload when the audio source changes mid-resume', async () => {
		mockAudio();

		const { rerender } = render(
			<WaveformNavigator audio="/test.mp3" responsive={false} />
		);

		const audioEl = await waitForAudio();

		// play() always rejects so the reload path is entered. Reload (load())
		// is deferred so we can swap the audio source while it's pending.
		const playSpy = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
		Object.defineProperty(audioEl, 'play', {
			value: playSpy,
			configurable: true,
		});

		let resolveCanPlay: (() => void) | null = null;
		const loadSpy = vi.fn(() => {
			// Delay firing canplay until the source change has aborted the resume;
			// when we eventually fire it, the resume must be a no-op.
			resolveCanPlay = () => audioEl.dispatchEvent(new Event('canplay'));
		});
		Object.defineProperty(audioEl, 'load', {
			value: loadSpy,
			configurable: true,
		});
		Object.defineProperty(audioEl, 'currentSrc', {
			get: () => '/test.mp3',
			configurable: true,
		});

		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		await act(async () => {
			setHidden(true);
		});

		definePaused(audioEl, true);

		await act(async () => {
			setHidden(false);
			await Promise.resolve();
			await Promise.resolve();
		});

		// First play() rejected, reload started.
		expect(loadSpy).toHaveBeenCalledTimes(1);
		expect(playSpy).toHaveBeenCalledTimes(1);

		// Now swap the audio source — this must abort the in-flight resume.
		await act(async () => {
			rerender(<WaveformNavigator audio="/other.mp3" responsive={false} />);
		});

		// Even if canplay fires now, the aborted resume must not call play() again.
		await act(async () => {
			resolveCanPlay?.();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('emits onLoadingChange(false) when syncing on visibility return', async () => {
		mockAudio();

		const onLoadingChange = vi.fn();
		render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				onLoadingChange={onLoadingChange}
			/>
		);

		const audioEl = await waitForAudio();
		spyOnPlay(audioEl);

		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		await act(async () => {
			setHidden(true);
		});

		// Element keeps playing while hidden — no resume needed, only a sync.
		definePaused(audioEl, false);
		onLoadingChange.mockClear();

		await act(async () => {
			setHidden(false);
		});

		expect(onLoadingChange).toHaveBeenCalledWith(false);
	});

	it('resets currentTime to 0 when the audio element fires emptied', async () => {
		mockAudio();

		const onTimeUpdate = vi.fn();
		const { container } = render(
			<WaveformNavigator
				audio="/test.mp3"
				responsive={false}
				onTimeUpdate={onTimeUpdate}
			/>
		);

		const audioEl = await waitForAudio();
		spyOnPlay(audioEl);

		// Advance to 30s.
		defineCurrentTime(audioEl, 30);
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		// Browser evicts the media → emptied fires (currentTime resets to 0).
		defineCurrentTime(audioEl, 0);
		await act(async () => {
			audioEl.dispatchEvent(new Event('emptied'));
		});

		// Time display must show 0:00 / … — i.e. the React currentTime is 0.
		const timeText = container.querySelector('.time')?.textContent ?? '';
		expect(timeText.startsWith('0:00')).toBe(true);
	});

	// ─── streamed source dropped while the tab is in the background ─────────────
	//
	// Real-world failure this guards against: audio is streaming, the tab is
	// hidden, after 30–60s the browser/server drops the media connection. The
	// element surfaces a fatal `error` (paused stays false per spec) and/or
	// `emptied` (position reset to 0). Previously this killed the resume intent,
	// snapped the waveform back to the start, and left the play button dead
	// until a full page refresh.

	function defineError(audioEl: HTMLAudioElement, code: number | null) {
		Object.defineProperty(audioEl, 'error', {
			get: () => (code === null ? null : { code }),
			configurable: true,
		});
	}

	function mockReload(audioEl: HTMLAudioElement) {
		const loadSpy = vi.fn(() => {
			queueMicrotask(() => audioEl.dispatchEvent(new Event('canplay')));
		});
		Object.defineProperty(audioEl, 'load', {
			value: loadSpy,
			configurable: true,
		});
		Object.defineProperty(audioEl, 'currentSrc', {
			get: () => '/test.mp3',
			configurable: true,
		});
		return loadSpy;
	}

	it('reloads and resumes from the latest position when a streamed source errors while hidden', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);
		const loadSpy = mockReload(audioEl);

		defineCurrentTime(audioEl, 30);
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		await act(async () => {
			setHidden(true);
		});

		// Audio keeps playing in the background — timeupdate still fires.
		defineCurrentTime(audioEl, 65);
		await act(async () => {
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		// The streamed connection dies: fatal media error. Per spec, paused
		// remains false and the resource is reset (emptied + timeupdate at 0).
		defineError(audioEl, 2); // MEDIA_ERR_NETWORK
		definePaused(audioEl, false);
		defineCurrentTime(audioEl, 0);
		await act(async () => {
			audioEl.dispatchEvent(new Event('error'));
			audioEl.dispatchEvent(new Event('emptied'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		await act(async () => {
			setHidden(false);
		});

		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		// Recovery must reload the source, seek to where playback had reached
		// while hidden (65s, not the hide-time 30s), and resume.
		expect(loadSpy).toHaveBeenCalledTimes(1);
		expect(audioEl.currentTime).toBe(65);
		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('restores the position playback reached while hidden, not the position when hidden', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);

		defineCurrentTime(audioEl, 10);
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		await act(async () => {
			setHidden(true);
		});

		// Audio continues in the background before the browser pauses and
		// resets it.
		defineCurrentTime(audioEl, 40);
		await act(async () => {
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		definePaused(audioEl, true);
		defineCurrentTime(audioEl, 0);
		await act(async () => {
			audioEl.dispatchEvent(new Event('pause'));
		});

		await act(async () => {
			setHidden(false);
		});

		expect(audioEl.currentTime).toBe(40);
		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('keeps displaying the last played position when media is evicted while hidden', async () => {
		mockAudio();

		const { container } = render(
			<WaveformNavigator audio="/test.mp3" responsive={false} />
		);

		const audioEl = await waitForAudio();
		spyOnPlay(audioEl);

		defineCurrentTime(audioEl, 90);
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		await act(async () => {
			setHidden(true);
		});

		// Eviction: resource reset to 0 (emptied followed by timeupdate at 0).
		definePaused(audioEl, true);
		defineCurrentTime(audioEl, 0);
		await act(async () => {
			audioEl.dispatchEvent(new Event('emptied'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		// The waveform must not jump back to the start while a resume is pending.
		const timeText = container.querySelector('.time')?.textContent ?? '';
		expect(timeText.startsWith('1:30')).toBe(true);
	});

	it('clicking play after a fatal media error reloads the source instead of doing nothing', async () => {
		mockAudio();

		const { container } = render(
			<WaveformNavigator audio="/test.mp3" responsive={false} />
		);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);
		const loadSpy = mockReload(audioEl);

		defineCurrentTime(audioEl, 30);
		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
			audioEl.dispatchEvent(new Event('timeupdate'));
		});

		// Fatal error while visible — paused stays false, so the old code would
		// have routed the click to pause() (a no-op on a dead element).
		defineError(audioEl, 2);
		definePaused(audioEl, false);
		await act(async () => {
			audioEl.dispatchEvent(new Event('error'));
		});

		expect(
			container.querySelector('button.play')?.getAttribute('aria-label')
		).toBe('play');

		const button = container.querySelector('button.play') as HTMLButtonElement;
		await act(async () => {
			button.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(loadSpy).toHaveBeenCalledTimes(1);
		expect(audioEl.currentTime).toBe(30);
		expect(playSpy).toHaveBeenCalledTimes(1);
	});

	it('resumes via window focus when visibilitychange is not fired (window switch)', async () => {
		mockAudio();

		render(<WaveformNavigator audio="/test.mp3" responsive={false} />);

		const audioEl = await waitForAudio();
		const playSpy = spyOnPlay(audioEl);

		await act(async () => {
			audioEl.dispatchEvent(new Event('play'));
		});

		// Simulate switching to another window: blur only, no visibilitychange.
		await act(async () => {
			window.dispatchEvent(new Event('blur'));
		});

		// Browser paused the audio while the window was in the background.
		definePaused(audioEl, true);
		await act(async () => {
			audioEl.dispatchEvent(new Event('pause'));
		});

		// Return to window — only focus fires.
		await act(async () => {
			window.dispatchEvent(new Event('focus'));
		});

		expect(playSpy).toHaveBeenCalledTimes(1);
	});
});
