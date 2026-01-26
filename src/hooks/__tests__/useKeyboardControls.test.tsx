import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useKeyboardControls } from '../useKeyboardControls';

function TestComponent(props: any) {
	const { onKeyDown } = useKeyboardControls(props);
	return (
		<div data-testid="root" tabIndex={0} onKeyDown={onKeyDown}>
			keyboard
		</div>
	);
}

describe('useKeyboardControls', () => {
	it('calls seek, seekTo and togglePlay for relevant keys', async () => {
		const seek = vi.fn();
		const seekTo = vi.fn();
		const togglePlay = vi.fn();

		render(
			<TestComponent
				duration={100}
				keyboardSmallStep={1}
				keyboardLargeStep={10}
				disableKeyboardControls={false}
				seek={seek}
				seekTo={seekTo}
				togglePlay={togglePlay}
			/>
		);

		const el = screen.getByTestId('root');

		// Small forward
		fireEvent.keyDown(el, { key: 'ArrowRight' });
		expect(seek).toHaveBeenCalledWith(1);

		// Small backward
		fireEvent.keyDown(el, { key: 'ArrowLeft' });
		expect(seek).toHaveBeenCalledWith(-1);

		// Large forward (PageDown)
		fireEvent.keyDown(el, { key: 'PageDown' });
		expect(seek).toHaveBeenCalledWith(10);

		// Home / End
		fireEvent.keyDown(el, { key: 'Home' });
		expect(seekTo).toHaveBeenCalledWith(0);
		fireEvent.keyDown(el, { key: 'End' });
		expect(seekTo).toHaveBeenCalledWith(100);

		// Toggle play
		fireEvent.keyDown(el, { key: ' ' });
		expect(togglePlay).toHaveBeenCalled();
	});
});
