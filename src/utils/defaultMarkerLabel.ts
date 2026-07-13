/**
 * Geometry for the default M1 / M2 / … label badge.
 * Kept in sync between canvas drawing and default hit-testing.
 */
export const DEFAULT_MARKER_LABEL_Y = 8;
export const DEFAULT_MARKER_LABEL_HEIGHT = 20;
export const DEFAULT_MARKER_LABEL_PAD_X = 8;
export const DEFAULT_MARKER_LABEL_FONT = '12px sans-serif';

/**
 * Approximate `measureText` width for `12px sans-serif` "M{n}" plus horizontal padding.
 * Used when a canvas context is unavailable (hit-testing).
 */
export function estimateDefaultMarkerLabelWidth(index: number): number {
	const label = `M${index + 1}`;
	// ~7.2px per glyph at 12px sans-serif covers typical Latin widths for "M" + digits
	return label.length * 7.2 + DEFAULT_MARKER_LABEL_PAD_X;
}

export function getDefaultMarkerLabelRect(
	markerX: number,
	index: number,
	canvasWidth: number,
	labelWidth = estimateDefaultMarkerLabelWidth(index)
): { x: number; y: number; width: number; height: number } {
	const width = labelWidth;
	const height = DEFAULT_MARKER_LABEL_HEIGHT;
	const x = Math.max(0, Math.min(canvasWidth - width, markerX - width / 2));
	const y = DEFAULT_MARKER_LABEL_Y;
	return { x, y, width, height };
}

/**
 * Default interactive hit region: the label badge only (not the full-height stem),
 * so clicks on the waveform around clustered markers can still seek.
 *
 * `hitPadding` expands the rect slightly (from `markerHitRadius`) for easier targeting.
 */
export function hitTestDefaultMarkerLabel(args: {
	x: number;
	y: number;
	markerX: number;
	index: number;
	canvasWidth: number;
	hitPadding?: number;
}): boolean {
	const {
		x,
		y,
		markerX,
		index,
		canvasWidth,
		hitPadding = 0,
	} = args;
	const rect = getDefaultMarkerLabelRect(markerX, index, canvasWidth);
	return (
		x >= rect.x - hitPadding &&
		x <= rect.x + rect.width + hitPadding &&
		y >= rect.y - hitPadding &&
		y <= rect.y + rect.height + hitPadding
	);
}
