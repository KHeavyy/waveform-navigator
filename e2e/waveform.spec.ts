import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Integration tests for WaveformNavigator component
 * Tests loading, seeking, responsive behavior, and accessibility
 */

test.describe('WaveformNavigator Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load and display waveform', async ({ page }) => {
    // Wait for canvas element to be visible
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 10000 })
    
    // Check canvas has dimensions
    const boundingBox = await canvas.boundingBox()
    expect(boundingBox).toBeTruthy()
    expect(boundingBox!.width).toBeGreaterThan(0)
    expect(boundingBox!.height).toBeGreaterThan(0)
  })

  test('should render waveform with correct device pixel ratio', async ({ page, browserName }) => {
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 10000 })
    
    // Check canvas backing store reflects DPR
    const dpr = await page.evaluate(() => window.devicePixelRatio)
    const canvasWidth = await canvas.evaluate((el: HTMLCanvasElement) => el.width)
    const styleWidth = await canvas.evaluate((el: HTMLCanvasElement) => 
      parseInt(el.style.width || '0')
    )
    
    // Canvas backing store width should be style width * DPR
    expect(canvasWidth).toBeCloseTo(styleWidth * dpr, 10)
  })

  test('should play and pause audio', async ({ page }) => {
    // Wait for waveform to load
    await page.waitForSelector('canvas', { timeout: 10000 })
    
    // Find and click play button
    const playButton = page.getByRole('button', { name: /play/i })
    await expect(playButton).toBeVisible()
    await playButton.click()
    
    // Wait a moment for playback to start
    await page.waitForTimeout(500)
    
    // Click pause button
    const pauseButton = page.getByRole('button', { name: /pause/i })
    await expect(pauseButton).toBeVisible()
    await pauseButton.click()
  })

  test('should seek when clicking on waveform', async ({ page }) => {
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 10000 })
    
    // Get canvas bounding box
    const boundingBox = await canvas.boundingBox()
    expect(boundingBox).toBeTruthy()
    
    // Click in the middle of the canvas
    await canvas.click({
      position: {
        x: boundingBox!.width / 2,
        y: boundingBox!.height / 2
      }
    })
    
    // Verify time display updated
    const timeDisplay = page.locator('text=/\\d+:\\d+/')
    await expect(timeDisplay).toBeVisible()
  })

  test('should handle responsive resizing', async ({ page }) => {
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 10000 })
    
    // Get initial width
    const initialWidth = await canvas.evaluate((el: HTMLCanvasElement) => el.width)
    
    // Resize viewport
    await page.setViewportSize({ width: 600, height: 800 })
    
    // Wait for resize to take effect
    await page.waitForTimeout(500)
    
    // Check width changed
    const newWidth = await canvas.evaluate((el: HTMLCanvasElement) => el.width)
    expect(newWidth).not.toBe(initialWidth)
  })

  test('should pass accessibility checks', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 })
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should display correct time format', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 })
    
    // Check for time display in MM:SS format
    const timeDisplay = page.locator('text=/\\d+:\\d{2}/')
    await expect(timeDisplay).toBeVisible()
  })

  test('should show loading state', async ({ page }) => {
    // Navigate to page but don't wait for full load
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    
    // Should see canvas element quickly
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 5000 })
  })
})
