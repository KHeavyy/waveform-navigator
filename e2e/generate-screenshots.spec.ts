import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * This test suite generates screenshots for the README.md
 * It captures various visual configurations of the waveform component
 */

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
	fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

test.describe('Generate README Screenshots', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Wait for waveform to be ready
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 15000 });
		// Give it a moment to fully render
		await page.waitForTimeout(2000);
	});

	test('screenshot: default theme', async ({ page }) => {
		// Take screenshot of the waveform container
		const waveformContainer = page.locator('.waveform-navigator').first();
		await waveformContainer.screenshot({
			path: path.join(SCREENSHOTS_DIR, 'default-theme.png'),
		});
	});

	test('screenshot: purple theme', async ({ page }) => {
		// Enable custom styles checkbox
		await page.check('text=/Enable Custom Styles/i');
		await page.waitForTimeout(500);

		// Get all color inputs
		const colorInputs = page.locator('input[type="color"]');

		// Set purple theme colors (first 3 are bar, progress, playhead)
		await colorInputs.nth(0).fill('#8b5cf6');
		await colorInputs.nth(1).fill('#6d28d9');
		await colorInputs.nth(2).fill('#a855f7');

		// Wait for waveform to re-render
		await page.waitForTimeout(1500);

		// Take screenshot
		const waveformContainer = page.locator('.waveform-navigator').first();
		await waveformContainer.screenshot({
			path: path.join(SCREENSHOTS_DIR, 'purple-theme.png'),
		});
	});

	test('screenshot: green theme', async ({ page }) => {
		// Enable custom styles
		await page.check('text=/Enable Custom Styles/i');
		await page.waitForTimeout(500);

		// Set green theme colors
		const colorInputs = page.locator('input[type="color"]');
		await colorInputs.nth(0).fill('#22c55e');
		await colorInputs.nth(1).fill('#16a34a');
		await colorInputs.nth(2).fill('#15803d');

		// Wait for waveform to re-render
		await page.waitForTimeout(1500);

		// Take screenshot
		const waveformContainer = page.locator('.waveform-navigator').first();
		await waveformContainer.screenshot({
			path: path.join(SCREENSHOTS_DIR, 'green-theme.png'),
		});
	});

	test('screenshot: orange theme', async ({ page }) => {
		// Enable custom styles
		await page.check('text=/Enable Custom Styles/i');
		await page.waitForTimeout(500);

		// Set orange theme colors
		const colorInputs = page.locator('input[type="color"]');
		await colorInputs.nth(0).fill('#f97316');
		await colorInputs.nth(1).fill('#ea580c');
		await colorInputs.nth(2).fill('#dc2626');

		// Wait for waveform to re-render
		await page.waitForTimeout(1500);

		// Take screenshot
		const waveformContainer = page.locator('.waveform-navigator').first();
		await waveformContainer.screenshot({
			path: path.join(SCREENSHOTS_DIR, 'orange-theme.png'),
		});
	});

	test('screenshot: minimal UI (no controls)', async ({ page }) => {
		// Uncheck the "Show Built-in Controls" checkbox
		await page.uncheck('text=/Show Built-in Controls/i');

		// Wait for controls to be hidden
		await page.waitForTimeout(1000);

		// Take screenshot
		const waveformContainer = page.locator('.waveform-navigator').first();
		await waveformContainer.screenshot({
			path: path.join(SCREENSHOTS_DIR, 'minimal-ui.png'),
		});
	});

	test('screenshot: custom button colors', async ({ page }) => {
		// Enable custom styles
		await page.check('text=/Enable Custom Styles/i');
		await page.waitForTimeout(500);

		// Set custom button and icon colors
		const colorInputs = page.locator('input[type="color"]');
		// Waveform colors
		await colorInputs.nth(0).fill('#ec4899'); // Bar - pink
		await colorInputs.nth(1).fill('#be185d'); // Progress - darker pink
		await colorInputs.nth(2).fill('#f43f5e'); // Playhead - red-pink
		// Button colors
		await colorInputs.nth(3).fill('#ec4899'); // Play button - pink
		await colorInputs.nth(4).fill('#ffffff'); // Play icon - white
		await colorInputs.nth(5).fill('#fce7f3'); // Rewind button - light pink
		await colorInputs.nth(6).fill('#831843'); // Rewind icon - dark pink
		await colorInputs.nth(7).fill('#fce7f3'); // Forward button - light pink
		await colorInputs.nth(8).fill('#831843'); // Forward icon - dark pink

		// Wait for waveform to re-render
		await page.waitForTimeout(1500);

		// Take screenshot
		const waveformContainer = page.locator('.waveform-navigator').first();
		await waveformContainer.screenshot({
			path: path.join(SCREENSHOTS_DIR, 'custom-buttons.png'),
		});
	});

	test('screenshot: playhead and progress demonstration', async ({ page }) => {
		// Enable custom styles for better visibility
		await page.check('text=/Enable Custom Styles/i');
		await page.waitForTimeout(500);

		// Set contrasting colors to show playhead and progress clearly
		const colorInputs = page.locator('input[type="color"]');
		await colorInputs.nth(0).fill('#94a3b8'); // Bar - light gray
		await colorInputs.nth(1).fill('#0ea5e9'); // Progress - bright blue (elapsed/played portion)
		await colorInputs.nth(2).fill('#ef4444'); // Playhead - bright red

		await page.waitForTimeout(1000);

		// Click on the waveform to seek to about 40% to show progress and playhead
		const canvas = page.locator('canvas').first();
		const box = await canvas.boundingBox();
		if (box) {
			await canvas.click({ position: { x: box.width * 0.4, y: box.height / 2 } });
		}

		// Wait for seek to complete
		await page.waitForTimeout(1000);

		// Take screenshot
		const waveformContainer = page.locator('.waveform-navigator').first();
		await waveformContainer.screenshot({
			path: path.join(SCREENSHOTS_DIR, 'playhead-progress.png'),
		});
	});
});
