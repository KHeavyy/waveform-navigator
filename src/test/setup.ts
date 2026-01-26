import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test case (e.g., clearing jsdom)
afterEach(() => {
  cleanup()
})

// Mock window.devicePixelRatio for canvas tests
Object.defineProperty(window, 'devicePixelRatio', {
  writable: true,
  configurable: true,
  value: 1
})

// Mock AudioContext for audio-related tests. Use a real constructor (class)
// so `new AudioContext()` works correctly in tests.
class MockAudioContext {
  destination: any = {}
  decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => {
    // Return a minimal decoded audio-like object
    return {
      numberOfChannels: 1,
      getChannelData: (_: number) => new Float32Array(0)
    }
  })
  createBufferSource() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    }
  }
}

global.AudioContext = MockAudioContext as any

// Mock HTMLMediaElement methods
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined)
})

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn()
})

Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  configurable: true,
  value: vi.fn()
})

// Mock HTMLCanvasElement methods
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  arc: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 }))
}) as any

HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock')

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
})) as any

// Mock `fetch` used by `useWaveformData` to load audio in tests. Tests
// use relative URLs like `/test.mp3`; in Node's undici this would throw
// an Invalid URL error. Return a fake Response with an empty ArrayBuffer
// so the hook can continue (the audio decoding is mocked elsewhere).
global.fetch = vi.fn(async (input: RequestInfo) => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => new ArrayBuffer(0)
  } as any
}) as any
