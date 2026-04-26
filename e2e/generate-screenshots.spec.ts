import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * This test suite generates screenshots for the README.md
 * It captures various visual configurations of the waveform component.
 *
 * Each screenshot test navigates to the appropriate demo tab first.
 */

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
	fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/** Wait for the waveform canvas to appear and peaks to be ready. */
async function waitForWaveform(page: import('@playwright/test').Page) {
	const canvas = page.locator('canvas').first();
	await expect(canvas).toBeVisible({ timeout: 15000 });
	await page
		.waitForFunction(() => (window as any).__waveformReady === true, {
			timeout: 15000,
		})
		.catch(() => {});
}

test.describe('Generate README Screenshots', () => {
	test('screenshot: default theme with playhead', async ({ page }) => {
		// Basic tab — default colours, no custom styles needed
		await page.goto('/?tab=basic');
		await waitForWaveform(page);
		await page.waitForTimeout(500);

		// Seek to ~40% to show progress and playhead
		const canvas = page.locator('canvas').first();
		const box = await canvas.boundingBox();
		if (box) {
			await canvas.click({ position: { x: box.width * 0.4, y: box.height / 2 } });
		}
		await page.waitForTimeout(800);

		const waveformContainer = page.locator('.waveform-navigator').first();
		await waveformContainer.screenshot({
			path: path.join(SCREENSHOTS_DIR, 'default-theme.png'),
		});
	});

	test('screenshot: all custom colors', async ({ page }) => {
		// Styles tab — colour pickers are always visible here
		await page.goto('/?tab=styles');
		await waitForWaveform(page);

		// Set all customisable colours to a pink palette
		const colorInputs = page.locator('input[type="color"]');
		await colorInputs.nth(0).fill('#ec4899'); // Bar
		await colorInputs.nth(1).fill('#be185d'); // Progress
		await colorInputs.nth(2).fill('#f43f5e'); // Background (or playhead depending on order)
		await colorInputs.nth(3).fill('#f43f5e'); // Playhead
		await colorInputs.nth(4).fill('#ec4899'); // Play button
		await colorInputs.nth(5).fill('#ffffff'); // Play icon
		await colorInputs.nth(6).fill('#fce7f3'); // Rewind button
		await colorInputs.nth(7).fill('#831843'); // Rewind icon
		await colorInputs.nth(8).fill('#fce7f3'); // Forward button
		await colorInputs.nth(9).fill('#831843'); // Forward icon
		await colorInputs.nth(10).fill('#ec4899'); // Volume slider fill
		await colorInputs.nth(11).fill('#831843'); // Volume icon

		await page.waitForTimeout(1000);

		// Seek to ~40%
		const canvas = page.locator('canvas').first();
		const box = await canvas.boundingBox();
		if (box) {
			await canvas.click({ position: { x: box.width * 0.4, y: box.height / 2 } });
		}
		await page.waitForTimeout(800);

		const waveformContainer = page.locator('.waveform-navigator').first();
		await waveformContainer.screenshot({
			path: path.join(SCREENSHOTS_DIR, 'custom-colors.png'),
		});
	});

	test('screenshot: minimal UI (no controls)', async ({ page }) => {
		// Controlled tab — has the "Show built-in controls" toggle
		await page.goto('/?tab=controlled');
		await waitForWaveform(page);

		// Uncheck the "Show built-in controls" checkbox
		const checkbox = page.getByLabel('Show built-in controls');
		await checkbox.uncheck();
		await page.waitForTimeout(800);

		const waveformContainer = page.locator('.waveform-navigator').first();
		await waveformContainer.screenshot({
			path: path.join(SCREENSHOTS_DIR, 'minimal-ui.png'),
		});
	});
});
