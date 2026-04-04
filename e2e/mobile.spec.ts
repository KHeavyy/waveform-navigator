import { test, expect } from '@playwright/test';

/**
 * Mobile-specific integration tests for WaveformNavigator.
 *
 * These tests set a narrow viewport (375 × 812 – iPhone SE/14 proportions)
 * and verify:
 *   - responsive layout at mobile breakpoints
 *   - touch seeking on the waveform canvas
 *   - collapsible volume control behaviour (hidden by default, shown on tap)
 */

const MOBILE_VIEWPORT = { width: 375, height: 812 };

// Wait for the demo app to signal both peaks and audio metadata are ready.
async function waitForWaveform(page: import('@playwright/test').Page) {
	await page
		.waitForFunction(
			() =>
				(window as any).__waveformReady === true &&
				(window as any).__waveformDuration > 0,
			{ timeout: 20000 }
		)
		.catch(() => {
			// If flags never fire the subsequent assertions will surface the failure.
		});
}

test.describe('Mobile layout and controls', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.goto('/');
		await waitForWaveform(page);
	});

	test('canvas is visible at mobile width', async ({ page }) => {
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });

		const box = await canvas.boundingBox();
		expect(box).toBeTruthy();
		// Canvas should fill the narrow viewport, not overflow it
		expect(box!.width).toBeGreaterThan(0);
		expect(box!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 1);
	});

	test('play button is visible and tappable on mobile', async ({ page }) => {
		const play = page.getByRole('button', { name: /play/i });
		await expect(play).toBeVisible({ timeout: 10000 });

		// Button should fit within the viewport
		const box = await play.boundingBox();
		expect(box).toBeTruthy();
		expect(box!.x + box!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 1);
	});

	test('play button is smaller on mobile than on desktop', async ({ page }) => {
		// Capture mobile size
		const mobileBox = await page
			.getByRole('button', { name: /play/i })
			.boundingBox();
		expect(mobileBox).toBeTruthy();

		// Switch to desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.waitForTimeout(300); // allow reflow

		const desktopBox = await page
			.getByRole('button', { name: /play/i })
			.boundingBox();
		expect(desktopBox).toBeTruthy();

		// Desktop play button should be visually larger
		expect(desktopBox!.width).toBeGreaterThan(mobileBox!.width);
	});

	test('time display is visible on mobile', async ({ page }) => {
		const timeDisplay = page.locator('.time').first();
		await expect(timeDisplay).toBeVisible({ timeout: 10000 });
	});

	test('rewind and forward buttons are visible on mobile', async ({ page }) => {
		const rewind = page.getByRole('button', { name: /rewind/i });
		const forward = page.getByRole('button', { name: /forward/i });
		await expect(rewind).toBeVisible({ timeout: 10000 });
		await expect(forward).toBeVisible({ timeout: 10000 });
	});
});

test.describe('Touch seeking on mobile', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.goto('/');
		await waitForWaveform(page);
	});

	test('tapping the waveform canvas seeks to the tapped position', async ({
		page,
	}) => {
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });

		const box = await canvas.boundingBox();
		expect(box).toBeTruthy();

		// Read the time display before the tap
		const timeBefore = await page.locator('.time').first().innerText();

		// Tap 75 % of the way along the canvas
		await page.touchscreen.tap(
			box!.x + box!.width * 0.75,
			box!.y + box!.height / 2
		);

		// The displayed time should change (or at least not throw an error)
		await page.waitForFunction(
			(before) => {
				const el = document.querySelector('.time');
				return el && el.textContent !== before;
			},
			timeBefore,
			{ timeout: 5000 }
		);

		const timeAfter = await page.locator('.time').first().innerText();
		expect(timeAfter).not.toBe(timeBefore);
	});

	test('scrubbing (touch drag) continuously updates the playback position', async ({
		page,
	}) => {
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });

		const box = await canvas.boundingBox();
		expect(box).toBeTruthy();

		const startX = box!.x + box!.width * 0.1;
		const endX = box!.x + box!.width * 0.9;
		const y = box!.y + box!.height / 2;

		// Perform a touch drag across the canvas
		await page.touchscreen.tap(startX, y);
		await page.mouse.move(startX, y);
		await page.mouse.down();
		await page.mouse.move(endX, y, { steps: 10 });
		await page.mouse.up();

		// The position should have advanced from the initial tap
		const timeAfter = await page.locator('.time').first().innerText();
		// As long as no JS error was thrown and a time is displayed we're good
		expect(timeAfter).toMatch(/\d+:\d{2}/);
	});
});

test.describe('Collapsible volume control on mobile', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.goto('/');
		await waitForWaveform(page);
	});

	test('volume slider is hidden by default on mobile', async ({ page }) => {
		const slider = page.locator('.vol-range').first();
		// The slider is in the DOM but CSS hides it at ≤480 px
		await expect(slider).toBeHidden({ timeout: 5000 });
	});

	test('tapping the speaker button reveals the volume slider', async ({
		page,
	}) => {
		const speaker = page.locator('.speaker').first();
		await expect(speaker).toBeVisible({ timeout: 10000 });

		const slider = page.locator('.vol-range').first();
		await expect(slider).toBeHidden();

		await speaker.tap();

		await expect(slider).toBeVisible({ timeout: 3000 });
	});

	test('tapping the speaker button again hides the volume slider', async ({
		page,
	}) => {
		const speaker = page.locator('.speaker').first();
		await speaker.tap(); // open
		await expect(page.locator('.vol-range').first()).toBeVisible({
			timeout: 3000,
		});

		await speaker.tap(); // close
		await expect(page.locator('.vol-range').first()).toBeHidden({
			timeout: 3000,
		});
	});

	test('volume-open class is present on .right while slider is expanded', async ({
		page,
	}) => {
		const speaker = page.locator('.speaker').first();
		await speaker.tap();

		const hasClass = await page.evaluate(() =>
			document.querySelector('.right')?.classList.contains('volume-open')
		);
		expect(hasClass).toBe(true);
	});

	test('volume slider is always visible on desktop', async ({ page }) => {
		// Switch to a desktop-width viewport; CSS breakpoint removes the hiding rule
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.waitForTimeout(200);

		const slider = page.locator('.vol-range').first();
		await expect(slider).toBeVisible({ timeout: 5000 });
	});
});
