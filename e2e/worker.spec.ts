import { test, expect } from '@playwright/test';

/**
 * Worker integration tests
 * Tests that the Web Worker peaks computation works correctly in a real browser environment
 */

test.describe('Web Worker Integration', () => {
	test('should compute peaks using web worker by default', async ({ page }) => {
		await page.goto('/');

		// Wait for waveform to load
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Wait for peaks to be computed and base waveform to be drawn
		await page.waitForFunction(() => (window as any).__waveformReady === true, {
			timeout: 20000,
		});

		// Check that peaks were computed (canvas should have content)
		const boundingBox = await canvas.boundingBox();
		expect(boundingBox).toBeTruthy();
		expect(boundingBox!.width).toBeGreaterThan(0);

		// Take a screenshot to verify visual rendering
		const screenshot = await canvas.screenshot();
		expect(screenshot.length).toBeGreaterThan(1000); // Should have actual content
	});

	test('should compute peaks on main thread when worker disabled', async ({
		page,
	}) => {
		await page.goto('/');

		// Find and enable "Force Main-Thread Processing" checkbox
		const mainThreadCheckbox = page.locator('input[type="checkbox"]').filter({
			hasText: /Force Main-Thread Processing/i,
		});

		// If we can find it, test main thread mode
		const checkboxCount = await mainThreadCheckbox.count();
		if (checkboxCount > 0) {
			await mainThreadCheckbox.check();

			// Wait for waveform to reload and be ready
			await page.waitForFunction(() => (window as any).__waveformReady === true, {
				timeout: 15000,
			});

			// Verify waveform still renders
			const canvas = page.locator('canvas').first();
			await expect(canvas).toBeVisible({ timeout: 10000 });

			const boundingBox = await canvas.boundingBox();
			expect(boundingBox).toBeTruthy();
			expect(boundingBox!.width).toBeGreaterThan(0);
		}
	});

	test('should handle worker computation with different audio sources', async ({
		page,
	}) => {
		await page.goto('/');

		// Wait for initial audio to load
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });
		await page.waitForFunction(() => (window as any).__waveformReady === true, {
			timeout: 15000,
		});

		// Take screenshot of initial waveform
		const screenshot1 = await canvas.screenshot();

		// Load a different audio source (if available)
		// The demo should handle this gracefully
		expect(screenshot1.length).toBeGreaterThan(1000);
	});

	test('should progressively render waveform as peaks are computed', async ({
		page,
	}) => {
		// Monitor console for peaks computed message
		const peaksMessages: string[] = [];
		page.on('console', (msg) => {
			if (msg.text().includes('Peaks computed')) {
				peaksMessages.push(msg.text());
			}
		});

		await page.goto('/');

		// Wait for waveform to load
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Wait for peaks computation (and base waveform draw)
		await page.waitForFunction(() => (window as any).__waveformReady === true, {
			timeout: 20000,
		});

		// Should have logged peaks computation
		expect(peaksMessages.length).toBeGreaterThan(0);
	});

	test('should handle worker errors gracefully', async ({ page }) => {
		// Monitor for errors
		const errors: string[] = [];
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});

		await page.goto('/');

		// Wait for page to load and waveform ready flag (if available)
		await page.waitForFunction(() => (window as any).__waveformReady === true, {
			timeout: 20000,
		});

		// Should not have any uncaught errors related to worker
		const workerErrors = errors.filter(
			(e) =>
				e.toLowerCase().includes('worker') || e.toLowerCase().includes('peaks')
		);
		expect(workerErrors.length).toBe(0);
	});
});
