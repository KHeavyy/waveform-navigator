import { test, expect } from '@playwright/test'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import fs from 'fs'
import path from 'path'

/**
 * Visual regression tests for waveform rendering
 * Captures and compares canvas snapshots at different DPRs
 */

const SNAPSHOT_DIR = path.join(__dirname, '__snapshots__')
const THRESHOLD = 0.1 // 10% difference threshold

// Ensure snapshot directory exists
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
}

test.describe('Visual Regression Tests', () => {
  test('should match waveform snapshot at DPR 1', async ({ page }, testInfo) => {
    // Navigate and wait for waveform to load
    await page.goto('/')
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 10000 })
    
    // Wait for waveform to render
    await page.waitForTimeout(1000)
    
    // Take screenshot of canvas
    const screenshot = await canvas.screenshot()
    
    // Save or compare snapshot
    const snapshotPath = path.join(SNAPSHOT_DIR, `${testInfo.project.name}-waveform.png`)
    
    if (!fs.existsSync(snapshotPath) || process.env.UPDATE_SNAPSHOTS) {
      // Save baseline
      fs.writeFileSync(snapshotPath, screenshot)
      console.log(`Saved baseline snapshot: ${snapshotPath}`)
    } else {
      // Compare with baseline
      const baseline = PNG.sync.read(fs.readFileSync(snapshotPath))
      const current = PNG.sync.read(screenshot)
      
      const { width, height } = baseline
      const diff = new PNG({ width, height })
      
      const numDiffPixels = pixelmatch(
        baseline.data,
        current.data,
        diff.data,
        width,
        height,
        { threshold: THRESHOLD }
      )
      
      const diffPercentage = (numDiffPixels / (width * height)) * 100
      
      if (diffPercentage > THRESHOLD) {
        // Save diff image for review
        const diffPath = path.join(SNAPSHOT_DIR, `${testInfo.project.name}-waveform-diff.png`)
        fs.writeFileSync(diffPath, PNG.sync.write(diff))
        
        // Save current for comparison
        const currentPath = path.join(SNAPSHOT_DIR, `${testInfo.project.name}-waveform-current.png`)
        fs.writeFileSync(currentPath, screenshot)
        
        throw new Error(
          `Visual regression detected: ${diffPercentage.toFixed(2)}% pixels differ. ` +
          `See ${diffPath} for differences.`
        )
      }
    }
  })

  test('should render consistently at different widths', async ({ page }) => {
    await page.goto('/')
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 10000 })
    
    // Capture at default width
    await page.waitForTimeout(1000)
    const screenshot1 = await canvas.screenshot()
    
    // Resize and capture again
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.waitForTimeout(1000)
    const screenshot2 = await canvas.screenshot()
    
    // Both should have content (non-empty images)
    expect(screenshot1.length).toBeGreaterThan(1000)
    expect(screenshot2.length).toBeGreaterThan(1000)
    
    // They should be different (different widths)
    expect(screenshot1).not.toEqual(screenshot2)
  })

  test('should render waveform with correct aspect ratio', async ({ page }) => {
    await page.goto('/')
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 10000 })
    
    const boundingBox = await canvas.boundingBox()
    expect(boundingBox).toBeTruthy()
    
    // Check aspect ratio is reasonable (width > height for waveform)
    const aspectRatio = boundingBox!.width / boundingBox!.height
    expect(aspectRatio).toBeGreaterThan(1)
    expect(aspectRatio).toBeLessThan(20)
  })
})
