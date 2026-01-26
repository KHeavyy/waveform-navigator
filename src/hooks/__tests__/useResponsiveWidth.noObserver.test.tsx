import { render } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

describe('useResponsiveWidth with no ResizeObserver', () => {
	it('returns fallback width when ResizeObserver is unavailable', async () => {
		const originalRO = (global as any).ResizeObserver;
		(global as any).ResizeObserver = undefined;

		const { useResponsiveWidth } = await import('../useResponsiveWidth');

		function TestComponent() {
			const { width, containerRef } = useResponsiveWidth({
				responsive: true,
				debounceMs: 10,
				fallbackWidth: 333,
			});
			return <div ref={containerRef}>{width}</div>;
		}

		const { container } = render(<TestComponent />);
		expect(container.textContent).toContain('333');

		// restore
		(global as any).ResizeObserver = originalRO;
	});
});
