import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for integration and visual regression tests
 */
export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.spec.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'list',

	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},

	projects: [
		{
			name: 'chromium-dpr1',
			use: {
				...devices['Desktop Chrome'],
				deviceScaleFactor: 1,
				viewport: { width: 1280, height: 720 },
			},
		},
		{
			name: 'chromium-dpr2',
			use: {
				...devices['Desktop Chrome'],
				deviceScaleFactor: 2,
				viewport: { width: 1280, height: 720 },
			},
		},
	],

	// Start dev server before tests
	webServer: {
		command: 'cd demo && npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		stdout: 'ignore',
		stderr: 'pipe',
		timeout: 120 * 1000,
	},
});
