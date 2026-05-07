import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React, { useRef } from 'react';
import WaveformNavigator from '../WaveformNavigator';
import type { WaveformNavigatorHandle } from '../WaveformNavigator';

describe('WaveformNavigator', () => {
	describe('showControls prop', () => {
		it('renders controls by default', () => {
			const { container } = render(
				<WaveformNavigator audio="/test.mp3" responsive={false} />
			);

			// Check that controls div exists
			const controls = container.querySelector('.controls');
			expect(controls).toBeTruthy();
		});

		it('hides controls when showControls is false', () => {
			const { container } = render(
				<WaveformNavigator
					audio="/test.mp3"
					showControls={false}
					responsive={false}
				/>
			);

			// Check that controls div does not exist
			const controls = container.querySelector('.controls');
			expect(controls).toBeFalsy();
		});

		it('shows controls when showControls is true', () => {
			const { container } = render(
				<WaveformNavigator
					audio="/test.mp3"
					showControls={true}
					responsive={false}
				/>
			);

			// Check that controls div exists
			const controls = container.querySelector('.controls');
			expect(controls).toBeTruthy();
		});
	});

	describe('showTime and showVolume props', () => {
		it('shows time display by default', () => {
			const { container } = render(
				<WaveformNavigator audio="/test.mp3" responsive={false} />
			);
			expect(container.querySelector('.time')).toBeTruthy();
		});

		it('hides time display when showTime is false', () => {
			const { container } = render(
				<WaveformNavigator audio="/test.mp3" responsive={false} showTime={false} />
			);
			expect(container.querySelector('.time')).toBeFalsy();
		});

		it('shows volume control by default', () => {
			const { container } = render(
				<WaveformNavigator audio="/test.mp3" responsive={false} />
			);
			expect(container.querySelector('.right')).toBeTruthy();
		});

		it('hides volume control when showVolume is false', () => {
			const { container } = render(
				<WaveformNavigator
					audio="/test.mp3"
					responsive={false}
					showVolume={false}
				/>
			);
			expect(container.querySelector('.right')).toBeFalsy();
		});

		it('can hide both time and volume independently', () => {
			const { container } = render(
				<WaveformNavigator
					audio="/test.mp3"
					responsive={false}
					showTime={false}
					showVolume={false}
				/>
			);
			expect(container.querySelector('.time')).toBeFalsy();
			expect(container.querySelector('.right')).toBeFalsy();
			// Controls bar itself is still present
			expect(container.querySelector('.controls')).toBeTruthy();
		});
	});

	describe('renderButtons prop', () => {
		it('renders custom buttons in place of default controls', () => {
			const { container } = render(
				<WaveformNavigator
					audio="/test.mp3"
					responsive={false}
					renderButtons={() => <button data-testid="custom-btn">Custom</button>}
				/>
			);
			expect(container.querySelector('[data-testid="custom-btn"]')).toBeTruthy();
			// Default play button should not be present
			expect(container.querySelector('.play')).toBeFalsy();
		});

		it('passes isPlaying and handlers to renderButtons', () => {
			let capturedProps: { isPlaying: boolean; onTogglePlay: () => void } | null =
				null;
			render(
				<WaveformNavigator
					audio="/test.mp3"
					responsive={false}
					renderButtons={(props) => {
						capturedProps = props;
						return <button>Custom</button>;
					}}
				/>
			);
			expect(capturedProps).not.toBeNull();
			expect(typeof capturedProps!.onTogglePlay).toBe('function');
		});

		it('renderButtons has no effect when showControls is false', () => {
			const { container } = render(
				<WaveformNavigator
					audio="/test.mp3"
					responsive={false}
					showControls={false}
					renderButtons={() => <button data-testid="custom-btn">Custom</button>}
				/>
			);
			expect(container.querySelector('[data-testid="custom-btn"]')).toBeFalsy();
		});
	});

	describe('ref forwarding', () => {
		it('exposes play, pause, seek, and resumeAudioContext methods', () => {
			let refHandle: WaveformNavigatorHandle | null = null;

			function TestComponent() {
				const ref = useRef<WaveformNavigatorHandle>(null);

				// Use useLayoutEffect to capture ref synchronously after mount
				React.useLayoutEffect(() => {
					refHandle = ref.current;
				}, []);

				return <WaveformNavigator ref={ref} audio="/test.mp3" responsive={false} />;
			}

			render(<TestComponent />);

			// Check that ref handle has the expected methods
			expect(refHandle).toBeTruthy();
			expect(refHandle!.play).toBeInstanceOf(Function);
			expect(refHandle!.pause).toBeInstanceOf(Function);
			expect(refHandle!.seek).toBeInstanceOf(Function);
			expect(refHandle!.resumeAudioContext).toBeInstanceOf(Function);
		});

		it('can call methods without errors when audio element exists', async () => {
			let refHandle: WaveformNavigatorHandle | null = null;

			function TestComponent() {
				const ref = useRef<WaveformNavigatorHandle>(null);

				// Use useLayoutEffect to capture ref synchronously after mount
				React.useLayoutEffect(() => {
					refHandle = ref.current;
				}, []);

				return <WaveformNavigator ref={ref} audio="/test.mp3" responsive={false} />;
			}

			render(<TestComponent />);

			// These should not throw errors even if audio hasn't loaded
			expect(() => refHandle?.pause()).not.toThrow();
			expect(() => refHandle?.seek(10)).not.toThrow();

			// play() returns a promise and should be callable
			const playPromise = refHandle!.play();
			expect(playPromise).toBeInstanceOf(Promise);

			// resumeAudioContext() also returns a promise
			// It may fail in test environment due to AudioContext mock limitations, which is fine
			const resumePromise = refHandle!.resumeAudioContext();
			expect(resumePromise).toBeInstanceOf(Promise);
		});
	});

	describe('WaveformNavigatorHandle type export', () => {
		it('type is exported and can be imported', () => {
			// This is a type-only test - if it compiles, it passes
			const handle: WaveformNavigatorHandle = {
				play: async () => {},
				pause: () => {},
				seek: (time: number) => {},
				resumeAudioContext: async () => {},
			};

			expect(handle).toBeDefined();
		});
	});
});
