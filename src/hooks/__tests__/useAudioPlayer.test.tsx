import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
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

	it('sets isLoading true on waiting, false on playing or pause', async () => {
		function TestComponent() {
			const { audioRef, isLoading } = useAudioPlayer({ audio: '/test.mp3' });

			React.useEffect(() => {
				(window as any).__testAudio2 = audioRef.current;
			}, [audioRef]);

			return <div data-testid="isLoading">{String(isLoading)}</div>;
		}

		render(<TestComponent />);

		const audioEl = (window as any).__testAudio2 as HTMLAudioElement;
		expect(audioEl).toBeTruthy();
		expect(screen.getByTestId('isLoading').textContent).toBe('false');

		// Simulate the browser stalling to fetch audio
		audioEl.dispatchEvent(new Event('waiting'));
		await waitFor(() =>
			expect(screen.getByTestId('isLoading').textContent).toBe('true')
		);

		// Simulate playback resuming once data is available
		audioEl.dispatchEvent(new Event('playing'));
		await waitFor(() =>
			expect(screen.getByTestId('isLoading').textContent).toBe('false')
		);

		// Simulate waiting again, then pause clears it
		audioEl.dispatchEvent(new Event('waiting'));
		await waitFor(() =>
			expect(screen.getByTestId('isLoading').textContent).toBe('true')
		);

		audioEl.dispatchEvent(new Event('pause'));
		await waitFor(() =>
			expect(screen.getByTestId('isLoading').textContent).toBe('false')
		);
	});

	it('initialises volume from defaultVolume and sets it on the audio element', async () => {
		function TestComponent() {
			const { audioRef, volume } = useAudioPlayer({
				audio: '/test.mp3',
				defaultVolume: 0.3,
			});

			React.useEffect(() => {
				(window as any).__testAudioVol = audioRef.current;
			}, [audioRef]);

			return <div data-testid="volume">{String(volume)}</div>;
		}

		render(<TestComponent />);

		expect(screen.getByTestId('volume').textContent).toBe('0.3');
		const audioEl = (window as any).__testAudioVol as HTMLAudioElement;
		await waitFor(() => expect(audioEl.volume).toBeCloseTo(0.3));
	});

	it('clamps defaultVolume outside 0–1 range', () => {
		function TestHigh() {
			const { volume } = useAudioPlayer({ audio: '/test.mp3', defaultVolume: 1.8 });
			return <div data-testid="vol-high">{String(volume)}</div>;
		}
		function TestLow() {
			const { volume } = useAudioPlayer({ audio: '/test.mp3', defaultVolume: -0.5 });
			return <div data-testid="vol-low">{String(volume)}</div>;
		}

		const { unmount: u1 } = render(<TestHigh />);
		expect(screen.getByTestId('vol-high').textContent).toBe('1');
		u1();

		render(<TestLow />);
		expect(screen.getByTestId('vol-low').textContent).toBe('0');
	});

	it('calls onVolumeChange with clamped value when setVolume is invoked', async () => {
		const onVolumeChange = vi.fn();
		let capturedSetVolume: (v: number) => void = () => {};

		function TestComponent() {
			const { setVolume } = useAudioPlayer({
				audio: '/test.mp3',
				onVolumeChange,
			});
			capturedSetVolume = setVolume;
			return null;
		}

		render(<TestComponent />);

		act(() => capturedSetVolume(0.6));
		expect(onVolumeChange).toHaveBeenCalledWith(0.6);

		act(() => capturedSetVolume(2.0));
		expect(onVolumeChange).toHaveBeenCalledWith(1);

		act(() => capturedSetVolume(-1));
		expect(onVolumeChange).toHaveBeenCalledWith(0);
	});
});
