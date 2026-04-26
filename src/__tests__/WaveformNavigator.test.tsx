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
