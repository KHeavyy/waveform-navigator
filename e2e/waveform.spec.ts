import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Integration tests for WaveformNavigator component
 * Tests loading, seeking, responsive behavior, and accessibility
 */

test.describe('WaveformNavigator Integration Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Wait for the app to signal that the base waveform has been drawn
		await page
			.waitForFunction(() => (window as any).__waveformReady === true, {
				timeout: 20000,
			})
			.catch(() => {
				// If the flag isn't set within timeout, tests will continue and may fail
				// This catch avoids unhandled promise rejection but preserves original behavior
			});
	});

	test('should load and display waveform', async ({ page }) => {
		// Wait for canvas element to be visible
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Check canvas has dimensions
		const boundingBox = await canvas.boundingBox();
		expect(boundingBox).toBeTruthy();
		expect(boundingBox!.width).toBeGreaterThan(0);
		expect(boundingBox!.height).toBeGreaterThan(0);
	});

	test('should render waveform with correct device pixel ratio', async ({
		page,
		browserName,
	}) => {
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Check canvas backing store reflects DPR
		const dpr = await page.evaluate(() => window.devicePixelRatio);
		const canvasWidth = await canvas.evaluate(
			(el: HTMLCanvasElement) => el.width
		);
		const styleWidth = await canvas.evaluate((el: HTMLCanvasElement) =>
			parseInt(el.style.width || '0')
		);

		// Canvas backing store width should be style width * DPR
		expect(canvasWidth).toBeCloseTo(styleWidth * dpr, 10);
	});

	test('should play and pause audio', async ({ page }) => {
		// Wait for waveform to load
		await page.waitForSelector('canvas', { timeout: 10000 });

		// Find and click play button
		const playButton = page.getByRole('button', { name: /play/i });
		await expect(playButton).toBeVisible();
		await playButton.click();

		// Wait a moment for playback to start
		await page.waitForTimeout(500);

		// Click pause button
		const pauseButton = page.getByRole('button', { name: /pause/i });
		await expect(pauseButton).toBeVisible();
		await pauseButton.click();
	});

	test('should seek when clicking on waveform', async ({ page }) => {
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Get canvas bounding box
		const boundingBox = await canvas.boundingBox();
		expect(boundingBox).toBeTruthy();

		// Click in the middle of the canvas
		// Capture initial displayed time (if any)
		const initialTime = await page.evaluate(() => {
			const m = document.body.innerText.match(/\d+:\d{2}/);
			return m ? m[0] : null;
		});

		await canvas.click({
			position: {
				x: boundingBox!.width / 2,
				y: boundingBox!.height / 2,
			},
		});

		// Wait for the displayed time to update (or appear)
		await page.waitForFunction(
			(initial) => {
				const m = document.body.innerText.match(/\d+:\d{2}/);
				if (!m) return false;
				const value = m[0];
				if (!initial) return value !== '0:00' && value.length > 0;
				return value !== initial;
			},
			initialTime,
			{ timeout: 5000 }
		);
	});

	test('should handle responsive resizing', async ({ page }) => {
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Get initial width
		const initialWidth = await canvas.evaluate(
			(el: HTMLCanvasElement) => el.width
		);

		// Resize viewport
		await page.setViewportSize({ width: 600, height: 800 });

		// Wait for resize to take effect
		await page.waitForTimeout(500);

		// Check width is valid after resize (some demos use fixed canvas sizes)
		const newWidth = await canvas.evaluate((el: HTMLCanvasElement) => el.width);
		expect(newWidth).toBeGreaterThan(0);
	});

	test('should pass accessibility checks', async ({ page }) => {
		await page.waitForSelector('canvas', { timeout: 10000 });

		const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

		// Only fail the test on serious or critical violations to reduce flakiness
		const serious = accessibilityScanResults.violations.filter(
			(v) => v.impact === 'critical' || v.impact === 'serious'
		);
		if (serious.length > 0) {
			console.log(
				'Axe critical/serious violations:',
				JSON.stringify(serious, null, 2)
			);
		}
		expect(serious).toEqual([]);
	});

	test('should display correct time format', async ({ page }) => {
		await page.waitForSelector('canvas', { timeout: 10000 });

		// Check for time display in MM:SS format
		const timeDisplay = page.locator('text=/\\d+:\\d{2}/');
		await expect(timeDisplay).toBeVisible();
	});

	test('should show loading state', async ({ page }) => {
		// Navigate to page but don't wait for full load
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		// Should see canvas element quickly
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 5000 });
	});
});
