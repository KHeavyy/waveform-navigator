import { render, screen, fireEvent } from '@testing-library/react';
import { vi, it, describe, expect } from 'vitest';
import { WaveformControls } from '../WaveformControls';

describe('WaveformControls', () => {
	it('displays formatted times and toggles play aria-label', () => {
		const onTogglePlay = vi.fn();
		const onSeek = vi.fn();
		const onVolumeChange = vi.fn();

		const { rerender } = render(
			<WaveformControls
				isPlaying={false}
				displayTime={12}
				duration={65}
				volume={0.5}
				onTogglePlay={onTogglePlay}
				onSeek={onSeek}
				onVolumeChange={onVolumeChange}
				seekTo={vi.fn()}
			/>
		);

		// Time formatted (mm:ss / mm:ss)
		expect(screen.getByText(/0:12/)).toBeTruthy();
		expect(screen.getByText(/1:05/)).toBeTruthy();

		// Play button should show 'play' aria-label when not playing
		const playBtn = screen.getByRole('button', { name: /play/i });
		expect(playBtn).toBeTruthy();

		// Click play toggles
		fireEvent.click(playBtn);
		expect(onTogglePlay).toHaveBeenCalled();

		// Rerender as playing -> aria-label should be 'pause'
		rerender(
			<WaveformControls
				isPlaying={true}
				displayTime={12}
				duration={65}
				volume={0.5}
				onTogglePlay={onTogglePlay}
				onSeek={onSeek}
				onVolumeChange={onVolumeChange}
				seekTo={vi.fn()}
			/>
		);

		const pauseBtn = screen.getByRole('button', { name: /pause/i });
		expect(pauseBtn).toBeTruthy();
	});

	it('calls seek and volume handlers', () => {
		const onTogglePlay = vi.fn();
		const onSeek = vi.fn();
		const onVolumeChange = vi.fn();

		render(
			<WaveformControls
				isPlaying={false}
				displayTime={0}
				duration={10}
				volume={0.25}
				onTogglePlay={onTogglePlay}
				onSeek={onSeek}
				onVolumeChange={onVolumeChange}
				seekTo={vi.fn()}
			/>
		);

		const rewind = screen.getByRole('button', { name: /rewind/i });
		const forward = screen.getByRole('button', { name: /forward/i });

		fireEvent.click(rewind);
		expect(onSeek).toHaveBeenCalledWith(-10);

		fireEvent.click(forward);
		expect(onSeek).toHaveBeenCalledWith(10);

		const vol = screen.getByRole('slider', {
			name: /volume/i,
		}) as HTMLInputElement;
		fireEvent.change(vol, { target: { value: '0.8' } });
		expect(onVolumeChange).toHaveBeenCalledWith(0.8);
	});

	it('shows spinner wrapper class when isLoading is true', () => {
		const { container, rerender } = render(
			<WaveformControls
				isPlaying={false}
				isLoading={false}
				displayTime={0}
				duration={10}
				volume={1}
				onTogglePlay={vi.fn()}
				onSeek={vi.fn()}
				onVolumeChange={vi.fn()}
				seekTo={vi.fn()}
			/>
		);

		const wrapper = container.querySelector('.play-wrapper');
		expect(wrapper).toBeTruthy();
		expect(wrapper?.classList.contains('play-wrapper--loading')).toBe(false);

		rerender(
			<WaveformControls
				isPlaying={false}
				isLoading={true}
				displayTime={0}
				duration={10}
				volume={1}
				onTogglePlay={vi.fn()}
				onSeek={vi.fn()}
				onVolumeChange={vi.fn()}
				seekTo={vi.fn()}
			/>
		);

		expect(wrapper?.classList.contains('play-wrapper--loading')).toBe(true);
	});

	it('hides time display when showTime is false', () => {
		const { container } = render(
			<WaveformControls
				isPlaying={false}
				displayTime={30}
				duration={120}
				volume={0.5}
				onTogglePlay={vi.fn()}
				onSeek={vi.fn()}
				onVolumeChange={vi.fn()}
				seekTo={vi.fn()}
				showTime={false}
			/>
		);
		expect(container.querySelector('.time')).toBeFalsy();
	});

	it('shows time display by default', () => {
		const { container } = render(
			<WaveformControls
				isPlaying={false}
				displayTime={30}
				duration={120}
				volume={0.5}
				onTogglePlay={vi.fn()}
				onSeek={vi.fn()}
				onVolumeChange={vi.fn()}
				seekTo={vi.fn()}
			/>
		);
		expect(container.querySelector('.time')).toBeTruthy();
	});

	it('hides volume section when showVolume is false', () => {
		const { container } = render(
			<WaveformControls
				isPlaying={false}
				displayTime={0}
				duration={10}
				volume={0.5}
				onTogglePlay={vi.fn()}
				onSeek={vi.fn()}
				onVolumeChange={vi.fn()}
				seekTo={vi.fn()}
				showVolume={false}
			/>
		);
		expect(container.querySelector('.right')).toBeTruthy();
		expect(container.querySelector('.speaker')).toBeFalsy();
		expect(container.querySelector('.vol-range')).toBeFalsy();
	});

	it('shows volume section by default', () => {
		const { container } = render(
			<WaveformControls
				isPlaying={false}
				displayTime={0}
				duration={10}
				volume={0.5}
				onTogglePlay={vi.fn()}
				onSeek={vi.fn()}
				onVolumeChange={vi.fn()}
				seekTo={vi.fn()}
			/>
		);
		expect(container.querySelector('.right')).toBeTruthy();
	});

	it('renders custom buttons via renderButtons and hides default play button', () => {
		const { container } = render(
			<WaveformControls
				isPlaying={false}
				displayTime={0}
				duration={10}
				volume={0.5}
				onTogglePlay={vi.fn()}
				onSeek={vi.fn()}
				onVolumeChange={vi.fn()}
				seekTo={vi.fn()}
				renderButtons={() => <button data-testid="custom-play">My Play</button>}
			/>
		);
		expect(container.querySelector('[data-testid="custom-play"]')).toBeTruthy();
		expect(container.querySelector('.play')).toBeFalsy();
	});

	it('passes correct props to renderButtons', () => {
		let capturedIsPlaying: boolean | undefined;
		let capturedIsLoading: boolean | undefined;

		render(
			<WaveformControls
				isPlaying={true}
				isLoading={true}
				displayTime={0}
				duration={10}
				volume={0.5}
				onTogglePlay={vi.fn()}
				onSeek={vi.fn()}
				onVolumeChange={vi.fn()}
				seekTo={vi.fn()}
				renderButtons={({ isPlaying, isLoading }) => {
					capturedIsPlaying = isPlaying;
					capturedIsLoading = isLoading;
					return <button>Custom</button>;
				}}
			/>
		);

		expect(capturedIsPlaying).toBe(true);
		expect(capturedIsLoading).toBe(true);
	});
});
