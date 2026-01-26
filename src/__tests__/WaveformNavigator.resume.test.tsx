import React, { useRef } from 'react';
import { render } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import WaveformNavigator from '../WaveformNavigator';

describe('WaveformNavigator resumeAudioContext', () => {
	it('creates and resumes a suspended AudioContext', async () => {
		const resume = vi.fn(async () => {});
		const close = vi.fn(async () => {});

		// Mock AudioContext class
		(window as any).AudioContext = class {
			state = 'suspended';
			resume = resume;
			close = close;
		};

		let handle: any = null;

		function TestComponent() {
			const ref = useRef(null);
			React.useLayoutEffect(() => {
				handle = ref.current;
			}, []);
			return <WaveformNavigator ref={ref} audio="/test.mp3" responsive={false} />;
		}

		render(<TestComponent />);

		// Call resumeAudioContext and ensure resume and close are invoked
		await handle.resumeAudioContext();
		expect(resume).toHaveBeenCalled();
		expect(close).toHaveBeenCalled();
	});
});
