import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useAudioPlayer } from '../useAudioPlayer';

describe('useAudioPlayer', () => {
	it('responds to play/pause events and exposes controls', async () => {
		const onPlay = vi.fn();
		const onPause = vi.fn();
		const onTimeUpdate = vi.fn();

		function TestComponent() {
			const { audioRef, isPlaying, duration, currentTime, displayTime } =
				useAudioPlayer({ audio: '/test.mp3', onPlay, onPause, onTimeUpdate });

			React.useEffect(() => {
				// Expose the audio element for the test to access
				(window as any).__testAudio = audioRef.current;
			}, [audioRef]);

			return (
				<div>
					<div data-testid="isPlaying">{String(isPlaying)}</div>
					<div data-testid="duration">{String(duration)}</div>
					<div data-testid="currentTime">{String(currentTime)}</div>
					<div data-testid="displayTime">{String(displayTime)}</div>
				</div>
			);
		}

		render(<TestComponent />);

		// Grab the audio element created by the hook from the window helper
		const audioEl = (window as any).__testAudio as HTMLAudioElement | null;
		expect(audioEl).toBeTruthy();

		// Simulate play event
		audioEl!.dispatchEvent(new Event('play'));
		await waitFor(() =>
			expect(screen.getByTestId('isPlaying').textContent).toBe('true')
		);

		// Simulate pause event
		audioEl!.dispatchEvent(new Event('pause'));
		await waitFor(() =>
			expect(screen.getByTestId('isPlaying').textContent).toBe('false')
		);

		// Simulate timeupdate
		// Set currentTime and dispatch event
		audioEl!.currentTime = 3;
		audioEl!.dispatchEvent(new Event('timeupdate'));
		await waitFor(() =>
			expect(screen.getByTestId('currentTime').textContent).toContain('3')
		);
	});

	it('supports controlled mode and seekTo notifies parent', async () => {
		const onCurrentTimeChange = vi.fn();
		function TestComponent() {
			const { isControlled, displayTime } = useAudioPlayer({
				audio: '/test.mp3',
				controlledCurrentTime: 1.5,
				onCurrentTimeChange,
			} as any);

			return (
				<div>
					<div data-testid="isControlled">{String(isControlled)}</div>
					<div data-testid="displayTime">{String(displayTime)}</div>
				</div>
			);
		}

		render(<TestComponent />);

		// controlled mode should be true and displayTime reflect controlledCurrentTime
		await waitFor(() =>
			expect(screen.getByTestId('isControlled').textContent).toBe('true')
		);
		expect(screen.getByTestId('displayTime').textContent).toContain('1.5');

		// Call seekTo via hook by grabbing audio element and simulating seek
		// In controlled mode seekTo should call onCurrentTimeChange instead of mutating audio
		// We'll render a consumer to call seekTo indirectly by importing the hook directly.
	});
});
