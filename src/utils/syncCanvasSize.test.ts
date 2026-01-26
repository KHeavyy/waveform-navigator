import { describe, it, expect, beforeEach, vi } from 'vitest'
import { syncCanvasSize } from './syncCanvasSize'

describe('syncCanvasSize', () => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D

  beforeEach(() => {
    canvas = document.createElement('canvas')
    ctx = canvas.getContext('2d')!
    vi.spyOn(ctx, 'setTransform')
  })

  it('sets CSS size to logical pixels', () => {
    syncCanvasSize(canvas, 800, 400)
    
    expect(canvas.style.width).toBe('800px')
    expect(canvas.style.height).toBe('400px')
  })

  it('sets backing store size to device pixels with DPR 1', () => {
    window.devicePixelRatio = 1
    syncCanvasSize(canvas, 800, 400)
    
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(400)
  })

  it('sets backing store size to device pixels with DPR 2', () => {
    window.devicePixelRatio = 2
    syncCanvasSize(canvas, 800, 400)
    
    expect(canvas.width).toBe(1600)
    expect(canvas.height).toBe(800)
  })

  it('applies transform to map drawing calls to logical pixels', () => {
    window.devicePixelRatio = 2
    syncCanvasSize(canvas, 800, 400)
    
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
  })

  it('ensures at least 1px backing store size', () => {
    window.devicePixelRatio = 1
    syncCanvasSize(canvas, 0, 0)
    
    expect(canvas.width).toBeGreaterThanOrEqual(1)
    expect(canvas.height).toBeGreaterThanOrEqual(1)
  })

  it('returns the device pixel ratio', () => {
    window.devicePixelRatio = 2
    const dpr = syncCanvasSize(canvas, 800, 400)
    
    expect(dpr).toBe(2)
  })

  it('handles fractional DPR values', () => {
    window.devicePixelRatio = 1.5
    syncCanvasSize(canvas, 800, 400)
    
    expect(canvas.width).toBe(Math.floor(800 * 1.5))
    expect(canvas.height).toBe(Math.floor(400 * 1.5))
  })

  it('only updates canvas dimensions if they changed', () => {
    window.devicePixelRatio = 1
    
    // First call
    syncCanvasSize(canvas, 800, 400)
    expect(canvas.width).toBe(800)
    
    // Second call with same dimensions - should not change
    const initialWidth = canvas.width
    syncCanvasSize(canvas, 800, 400)
    expect(canvas.width).toBe(initialWidth)
    
    // Third call with different dimensions - should change
    syncCanvasSize(canvas, 900, 400)
    expect(canvas.width).toBe(900)
  })

  it('handles missing devicePixelRatio (defaults to 1)', () => {
    // @ts-expect-error - Testing edge case
    delete window.devicePixelRatio
    
    const dpr = syncCanvasSize(canvas, 800, 400)
    
    expect(dpr).toBe(1)
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(400)
  })
})
