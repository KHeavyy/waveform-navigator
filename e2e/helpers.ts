import { Page } from '@playwright/test';

/**
 * Test helpers for WaveformNavigator e2e tests
 */

export class WaveformPage {
	constructor(private page: Page) {}

	async goto() {
		await this.page.goto('/');
	}

	async waitForWaveformLoad(timeout = 10000) {
		const canvas = this.page.locator('canvas').first();
		await canvas.waitFor({ state: 'visible', timeout });
		return canvas;
	}

	async getCanvas() {
		return this.page.locator('canvas').first();
	}

	async getPlayButton() {
		return this.page.getByRole('button', { name: /play/i });
	}

	async getPauseButton() {
		return this.page.getByRole('button', { name: /pause/i });
	}

	async getTimeDisplay() {
		return this.page.locator('text=/\\d+:\\d+/');
	}

	async clickWaveformAt(xPercent: number, yPercent = 0.5) {
		const canvas = await this.getCanvas();
		const boundingBox = await canvas.boundingBox();
		if (!boundingBox) throw new Error('Canvas not found');

		await canvas.click({
			position: {
				x: boundingBox.width * xPercent,
				y: boundingBox.height * yPercent,
			},
		});
	}

	async play() {
		const playButton = await this.getPlayButton();
		await playButton.click();
	}

	async pause() {
		const pauseButton = await this.getPauseButton();
		await pauseButton.click();
	}

	async getDevicePixelRatio() {
		return this.page.evaluate(() => window.devicePixelRatio);
	}

	async getCanvasDimensions() {
		const canvas = await this.getCanvas();
		return canvas.evaluate((el: HTMLCanvasElement) => ({
			width: el.width,
			height: el.height,
			styleWidth: parseInt(el.style.width || '0'),
			styleHeight: parseInt(el.style.height || '0'),
		}));
	}
}
