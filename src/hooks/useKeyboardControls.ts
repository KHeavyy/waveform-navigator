import { useCallback } from 'react';

export interface UseKeyboardControlsProps {
	duration: number;
	keyboardSmallStep: number;
	keyboardLargeStep?: number;
	disableKeyboardControls: boolean;
	seek: (delta: number) => void;
	seekTo: (time: number) => void;
	togglePlay: () => void;
}

export function useKeyboardControls({
	duration,
	keyboardSmallStep,
	keyboardLargeStep,
	disableKeyboardControls,
	seek,
	seekTo,
	togglePlay,
}: UseKeyboardControlsProps) {
	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			if (disableKeyboardControls) {
				return;
			}

			// Calculate large step as 10% of duration if not provided
			const largeStep = keyboardLargeStep ?? duration * 0.1;

			let handled = false;

			switch (e.key) {
				case 'ArrowLeft':
				case 'ArrowDown':
					// Small seek backward (ArrowDown for ARIA slider pattern compliance)
					seek(-keyboardSmallStep);
					handled = true;
					break;
				case 'ArrowRight':
				case 'ArrowUp':
					// Small seek forward (ArrowUp for ARIA slider pattern compliance)
					seek(keyboardSmallStep);
					handled = true;
					break;
				case 'PageUp':
					// Large seek backward
					seek(-largeStep);
					handled = true;
					break;
				case 'PageDown':
					// Large seek forward
					seek(largeStep);
					handled = true;
					break;
				case 'Home':
					// Jump to start
					seekTo(0);
					handled = true;
					break;
				case 'End':
					// Jump to end
					seekTo(duration);
					handled = true;
					break;
				case ' ':
				case 'Enter':
					// Toggle play/pause
					togglePlay();
					handled = true;
					break;
			}

			if (handled) {
				e.preventDefault();
			}
		},
		[
			disableKeyboardControls,
			duration,
			keyboardSmallStep,
			keyboardLargeStep,
			seek,
			seekTo,
			togglePlay,
		]
	);

	return { onKeyDown };
}
