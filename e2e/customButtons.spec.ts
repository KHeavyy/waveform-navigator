import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Custom Buttons tab.
 * Verifies renderButtons, showTime, and showVolume props.
 */
test.describe('Custom Buttons tab', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/?tab=custombuttons');
		await page
			.waitForFunction(() => (window as any).__waveformReady === true, {
				timeout: 20000,
			})
			.catch(() => {});
	});

	test('loads the tab and shows the waveform canvas', async ({ page }) => {
		const canvas = page.locator('canvas').first();
		await expect(canvas).toBeVisible({ timeout: 10000 });
		const box = await canvas.boundingBox();
		expect(box?.width).toBeGreaterThan(0);
		expect(box?.height).toBeGreaterThan(0);
	});

	test('renderButtons slot renders custom button group', async ({ page }) => {
		// Our custom buttons wrapper has data-testid="custom-buttons"
		const customButtons = page.locator('[data-testid="custom-buttons"]');
		await expect(customButtons).toBeVisible({ timeout: 10000 });
	});

	test('default play button class is absent when renderButtons is used', async ({
		page,
	}) => {
		// The built-in play button uses class "play"; it should not exist
		const defaultPlayBtn = page.locator('.play');
		await expect(defaultPlayBtn).toHaveCount(0);
	});

	test('custom play/pause button toggles aria-label', async ({ page }) => {
		const customPlayBtn = page.locator('[data-testid="custom-play-btn"]');
		await expect(customPlayBtn).toBeVisible({ timeout: 10000 });

		// Initial state: aria-label should be "play"
		await expect(customPlayBtn).toHaveAttribute('aria-label', 'play');

		// Click to play
		await customPlayBtn.click();
		await page.waitForTimeout(300);

		// After clicking, aria-label should be "pause"
		await expect(customPlayBtn).toHaveAttribute('aria-label', 'pause');

		// Click again to pause
		await customPlayBtn.click();
		await page.waitForTimeout(300);

		await expect(customPlayBtn).toHaveAttribute('aria-label', 'play');
	});

	test('extra "Next track" custom button is rendered', async ({ page }) => {
		const nextBtn = page.locator('[data-testid="next-track-btn"]');
		await expect(nextBtn).toBeVisible({ timeout: 10000 });
	});

	test('time display is visible by default', async ({ page }) => {
		const timeDisplay = page.locator('.time');
		await expect(timeDisplay).toBeVisible({ timeout: 10000 });
	});

	test('unchecking showTime hides the time display', async ({ page }) => {
		const toggle = page.locator('[data-testid="toggle-show-time"]');
		await toggle.uncheck();
		const timeDisplay = page.locator('.time');
		await expect(timeDisplay).toHaveCount(0);
	});

	test('re-checking showTime restores the time display', async ({ page }) => {
		const toggle = page.locator('[data-testid="toggle-show-time"]');
		await toggle.uncheck();
		await expect(page.locator('.time')).toHaveCount(0);
		await toggle.check();
		await expect(page.locator('.time')).toBeVisible();
	});

	test('volume section is visible by default', async ({ page }) => {
		const volumeSection = page.locator('.right');
		await expect(volumeSection).toBeVisible({ timeout: 10000 });
	});

	test('unchecking showVolume hides the volume section', async ({ page }) => {
		const toggle = page.locator('[data-testid="toggle-show-volume"]');
		await toggle.uncheck();
		const volumeSection = page.locator('.right');
		await expect(volumeSection).toHaveCount(1);
		await expect(volumeSection).toBeHidden();
		await expect(page.locator('.speaker')).toHaveCount(0);
		await expect(page.locator('.vol-range')).toHaveCount(0);
	});

	test('re-checking showVolume restores the volume section', async ({
		page,
	}) => {
		const toggle = page.locator('[data-testid="toggle-show-volume"]');
		await toggle.uncheck();
		await expect(page.locator('.speaker')).toHaveCount(0);
		await toggle.check();
		await expect(page.locator('.right')).toBeVisible();
		await expect(page.locator('.speaker')).toBeVisible();
	});

	test('custom center controls stay centered when showTime is toggled', async ({
		page,
	}) => {
		const center = page.locator('.controls .center');
		const right = page.locator('.controls .right');

		const centerBefore = await center.boundingBox();
		const rightBefore = await right.boundingBox();
		expect(centerBefore).toBeTruthy();
		expect(rightBefore).toBeTruthy();

		const showTimeToggle = page.locator('[data-testid="toggle-show-time"]');
		await showTimeToggle.uncheck();

		const centerAfter = await center.boundingBox();
		const rightAfter = await right.boundingBox();
		expect(centerAfter).toBeTruthy();
		expect(rightAfter).toBeTruthy();

		expect(Math.abs(centerAfter!.x - centerBefore!.x)).toBeLessThan(2);
		expect(Math.abs(rightAfter!.x - rightBefore!.x)).toBeLessThan(2);
	});

	test('custom center controls stay centered when showVolume is toggled', async ({
		page,
	}) => {
		const center = page.locator('.controls .center');

		const centerBefore = await center.boundingBox();
		expect(centerBefore).toBeTruthy();

		const showVolumeToggle = page.locator('[data-testid="toggle-show-volume"]');
		await showVolumeToggle.uncheck();

		const centerAfter = await center.boundingBox();
		expect(centerAfter).toBeTruthy();

		expect(Math.abs(centerAfter!.x - centerBefore!.x)).toBeLessThan(2);
	});
});
