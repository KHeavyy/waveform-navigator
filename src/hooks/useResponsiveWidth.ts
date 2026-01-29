import { useEffect, useRef, useState } from 'react';

interface UseResponsiveWidthProps {
	responsive: boolean;
	debounceMs?: number;
	fallbackWidth?: number;
}

interface UseResponsiveWidthReturn {
	width: number;
	containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook to observe container width changes using ResizeObserver.
 * @param responsive - Whether to enable responsive width observation
 * @param debounceMs - Debounce delay in milliseconds (default: 150ms)
 * @param fallbackWidth - Fallback width when container size is not available (default: 800)
 * @returns Object with width and containerRef
 */
export function useResponsiveWidth({
	responsive,
	debounceMs = 150,
	fallbackWidth = 800,
}: UseResponsiveWidthProps): UseResponsiveWidthReturn {
	const containerRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState<number>(fallbackWidth);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const rafRef = useRef<number | null>(null);
	const currentWidthRef = useRef<number>(fallbackWidth);

	useEffect(() => {
		if (!responsive) {
			return;
		}

		const el = containerRef.current;
		if (!el) {
			return;
		}

		// Check if ResizeObserver is available
		if (typeof ResizeObserver === 'undefined') {
			console.warn(
				'ResizeObserver not available. Responsive width will not work. Consider using the width prop instead.'
			);
			return;
		}

		// Set initial width
		const initialWidth = el.getBoundingClientRect().width;
		if (initialWidth > 0) {
			const flooredWidth = Math.floor(initialWidth);
			currentWidthRef.current = flooredWidth;
			setWidth(flooredWidth);
		}

		const onResize = (entries: ResizeObserverEntry[]) => {
			// Cancel any pending RAF
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}

			// Use RAF to batch DOM reads
			rafRef.current = requestAnimationFrame(() => {
				rafRef.current = null;
				const entry = entries[0];
				if (!entry) {
					return;
				}

				const newWidth = Math.floor(entry.contentRect.width || 0);

				// Only update if width is valid and different from current width
				if (newWidth > 0 && newWidth !== currentWidthRef.current) {
					// Clear any existing debounce timer
					if (debounceTimerRef.current !== null) {
						clearTimeout(debounceTimerRef.current);
						debounceTimerRef.current = null;
					}

					// Debounce the width update
					debounceTimerRef.current = setTimeout(() => {
						debounceTimerRef.current = null;
						currentWidthRef.current = newWidth;
						setWidth(newWidth);
					}, debounceMs);
				}
			});
		};

		const ro = new ResizeObserver(onResize);
		ro.observe(el);

		return () => {
			ro.disconnect();
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			if (debounceTimerRef.current !== null) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
			}
		};
	}, [responsive, debounceMs]);

	return {
		width,
		containerRef,
	};
}
