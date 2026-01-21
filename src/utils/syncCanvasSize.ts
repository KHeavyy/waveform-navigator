/**
 * Syncs canvas display size and backing store with devicePixelRatio for crisp HiDPI rendering.
 * Sets CSS size (logical pixels) and backing store size (device pixels), then applies
 * transform to map drawing calls to logical pixels.
 * @returns The calculated device pixel ratio
 */
export function syncCanvasSize(canvas: HTMLCanvasElement, width: number, height: number): number {
	const dpr = Math.max(1, window.devicePixelRatio || 1);
	
	// CSS size (logical pixels)
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;

	// Backing store size (device pixels)
	const pixelWidth = Math.max(1, Math.floor(width * dpr));
	const pixelHeight = Math.max(1, Math.floor(height * dpr));
	
	if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
		canvas.width = pixelWidth;
		canvas.height = pixelHeight;
	}

	const ctx = canvas.getContext('2d');
	if (ctx) {
		// Map drawing calls to logical pixels
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	
	return dpr;
}
