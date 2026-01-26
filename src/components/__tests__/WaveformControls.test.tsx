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
});
