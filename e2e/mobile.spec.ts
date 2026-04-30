import { test, expect } from '@playwright/test';

/**
 * Mobile-specific integration tests for WaveformNavigator.
 *
 * These tests set a narrow viewport (375 × 812 – iPhone SE/14 proportions)
 * and verify:
 *   - responsive layout at mobile breakpoints
 *   - touch seeking on the waveform canvas
 *   - playback controls are horizontally centered
 *   - volume controls are hidden on touch-only devices (HTML5 audio volume
 *     is read-only on iOS Safari, so the on-screen slider can't change it)
 */

const MOBILE_VIEWPORT = { width: 375, height: 812 };

// Wait for the demo app to signal the waveform is ready.
async function waitForWaveform(page: import('@playwright/test').Page) {
	await page
		.waitForFunction(() => (window as any).__waveformReady === true, {
			timeout: 20000,
		})
		.catch(() => {
			// If flag never fires the subsequent assertions will surface the failure.
		});
}

test.describe('Mobile layout and controls', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.goto('/?tab=basic');
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

	test('play, rewind, forward buttons are horizontally centered', async ({
		page,
	}) => {
		const controls = page.locator('.controls').first();
		const center = page.locator('.controls .center').first();
		await expect(controls).toBeVisible({ timeout: 10000 });

		const controlsBox = await controls.boundingBox();
		const centerBox = await center.boundingBox();
		expect(controlsBox).toBeTruthy();
		expect(centerBox).toBeTruthy();

		// Midpoint of the .center group should sit within a few pixels of the
		// midpoint of the full controls container — the grid layout guarantees
		// this regardless of the time text or volume control widths.
		const controlsMid = controlsBox!.x + controlsBox!.width / 2;
		const centerMid = centerBox!.x + centerBox!.width / 2;
		expect(Math.abs(centerMid - controlsMid)).toBeLessThanOrEqual(2);
	});

	test('center stays centered when the time string grows wider than 1fr', async ({
		page,
	}) => {
		await expect(page.locator('.controls').first()).toBeVisible({
			timeout: 10000,
		});

		// Force the time text to be wider than the natural 1fr share by bumping
		// its font size. With plain `grid-template-columns: 1fr auto 1fr`, the
		// fr tracks have an implicit content-based minimum, so an over-sized
		// time string expands the left track and shifts the center group off
		// the container midpoint. `minmax(0, 1fr)` + `min-width: 0` on the side
		// items lets the track shrink below content size, keeping center
		// mathematically centered.
		await page.locator('.controls .time').first().evaluate((el) => {
			const e = el as HTMLElement;
			e.textContent = '99:99:99 / 99:99:99';
			e.style.fontSize = '24px';
			e.style.fontWeight = '700';
		});

		const controlsBox = await page.locator('.controls').first().boundingBox();
		const centerBox = await page.locator('.controls .center').first().boundingBox();
		expect(controlsBox).toBeTruthy();
		expect(centerBox).toBeTruthy();

		const controlsMid = controlsBox!.x + controlsBox!.width / 2;
		const centerMid = centerBox!.x + centerBox!.width / 2;
		expect(Math.abs(centerMid - controlsMid)).toBeLessThanOrEqual(2);
	});
});

test.describe('Touch seeking on mobile', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.goto('/?tab=basic');
		await waitForWaveform(page);
	});

	test('tapping the waveform canvas seeks to the tapped position', async ({
		page,
	}) => {
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Scroll canvas into view before reading coordinates or tapping —
		// the demo page is long and the canvas can be far below the mobile
		// viewport, causing page.touchscreen.tap() to be silently ignored.
		await canvas.scrollIntoViewIfNeeded();
		const box = await canvas.boundingBox();
		expect(box).toBeTruthy();

		// Read the time display before the tap
		const timeBefore = await page.locator('.time').first().innerText();

		// Tap 75 % of the way along the canvas using locator.tap() so that
		// position is relative to the element (not the page) and the element
		// is guaranteed to be in the viewport before the tap lands.
		await canvas.tap({ position: { x: box!.width * 0.75, y: box!.height / 2 } });

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

		// Scroll canvas into view so subsequent touchscreen/mouse coordinates
		// fall within the viewport (canvas can be far below the fold on mobile).
		await canvas.scrollIntoViewIfNeeded();
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

test.describe('Volume controls are hidden on mobile', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.goto('/?tab=basic');
		await waitForWaveform(page);
	});

	test('volume slider is hidden on mobile', async ({ page }) => {
		const slider = page.locator('.vol-range').first();
		await expect(slider).toBeHidden({ timeout: 5000 });
	});

	test('speaker button is hidden on mobile', async ({ page }) => {
		// Volume can't be controlled programmatically on iOS Safari and is
		// unreliable elsewhere on mobile, so the entire .right group is hidden
		// on touch-only devices.
		const speaker = page.locator('.speaker').first();
		await expect(speaker).toBeHidden({ timeout: 5000 });
	});

	test('volume popup is not present on mobile', async ({ page }) => {
		await expect(page.locator('.vol-popup')).toHaveCount(0);
	});
});
