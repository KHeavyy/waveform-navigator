/**
 * Helper to safely create a Web Worker with fallback.
 * Handles browser compatibility, CSP restrictions, and bundler URL resolution.
 */

export interface WorkerCreationOptions {
	/**
	 * Optional custom worker URL. If not provided, defaults to bundled worker.
	 */
	workerUrl?: string;
	/**
	 * Force main-thread processing (disable worker).
	 */
	forceMainThread?: boolean;
}

/**
 * Attempts to create a Web Worker. Returns null if worker creation fails
 * or is not supported, allowing caller to fall back to main-thread computation.
 */
export function createPeaksWorker(options: WorkerCreationOptions = {}): Worker | null {
	const { workerUrl, forceMainThread } = options;

	// If main-thread is forced, return null immediately
	if (forceMainThread) {
		console.info('[WaveformNavigator] Main-thread mode forced, skipping worker creation');
		return null;
	}

	// Check if Worker is supported
	if (typeof Worker === 'undefined') {
		console.warn('[WaveformNavigator] Web Workers not supported in this environment');
		return null;
	}

	try {
		let worker: Worker;

		if (workerUrl) {
			// Use custom worker URL provided by consumer
			worker = new Worker(workerUrl, { type: 'module' });
		} else {
			// Use bundled worker with relative path from this module's location in dist/
			// In the compiled library: dist/utils/workerCreation.js -> ../peaks.worker.js
			// Modern bundlers (Vite/Webpack 5) will resolve this correctly.
			// If your bundler doesn't support this, provide a custom workerUrl prop.
			const url = new URL('../peaks.worker.js', import.meta.url);
			worker = new Worker(url, { type: 'module' });
		}

		return worker;
	} catch (err) {
		console.warn('[WaveformNavigator] Worker creation failed, falling back to main thread:', err);
		return null;
	}
}
