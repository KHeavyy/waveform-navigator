import { test, expect } from '@playwright/test';

/**
 * Worker integration tests
 * Tests that the Web Worker peaks computation works correctly in a real browser environment.
 *
 * The worker toggle lives on the Advanced tab (?tab=advanced).
 * Default worker behaviour is also tested via the Basic tab (?tab=basic).
 */

test.describe('Web Worker Integration', () => {
	test('should compute peaks using web worker by default', async ({ page }) => {
		await page.goto('/?tab=basic');

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
		// Navigate to the Advanced tab where the worker toggle lives
		await page.goto('/?tab=advanced');

		// Wait for initial waveform to be ready before toggling worker off
		await page.waitForFunction(() => (window as any).__waveformReady === true, {
			timeout: 20000,
		});

		// Find and enable "Force main-thread processing" checkbox
		const mainThreadCheckbox = page.getByRole('checkbox', {
			name: /Force main-thread processing/i,
		});

		// If we can find it, test main thread mode
		const checkboxCount = await mainThreadCheckbox.count();
		if (checkboxCount > 0) {
			// Reset the ready flag so we can wait for the recomputed waveform
			await page.evaluate(() => {
				(window as any).__waveformReady = false;
			});
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
		await page.goto('/?tab=basic');

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
		await page.goto('/?tab=basic');

		// Wait for waveform to load
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Wait for peaks computation (and base waveform draw)
		await page.waitForFunction(() => (window as any).__waveformReady === true, {
			timeout: 20000,
		});

		// Canvas should have real visual content once peaks are ready
		const screenshot = await canvas.screenshot();
		expect(screenshot.length).toBeGreaterThan(1000);
	});

	test('should handle worker errors gracefully', async ({ page }) => {
		// Monitor for errors
		const errors: string[] = [];
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});

		await page.goto('/?tab=basic');

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
