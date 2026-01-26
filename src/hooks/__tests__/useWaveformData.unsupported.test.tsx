import { render } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

describe('useWaveformData unsupported audio prop', () => {
	it('returns null peaks and does not throw for unsupported audio types', async () => {
		const onPeaksComputed = vi.fn();
		const onError = vi.fn();

		const { useWaveformData } = await import('../useWaveformData');

		function TestComponent() {
			// Pass an unsupported audio prop (number)
			const { peaks } = useWaveformData({
				audio: 123 as any,
				width: 100,
				barWidth: 2,
				gap: 1,
				onPeaksComputed,
				onError,
			} as any);
			return <div>{peaks ? peaks.length : 0}</div>;
		}

		const { container } = render(<TestComponent />);
		expect(container.textContent).toContain('0');
		expect(onPeaksComputed).not.toHaveBeenCalled();
		expect(onError).not.toHaveBeenCalled();
	});
});
