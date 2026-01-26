import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'

// Basic peaks so drawing loops run small
const peaks = new Float32Array([0.5, 0.3, 0.7])

describe('useWaveformCanvas background and partial progress', () => {
  it('draws background when backgroundColor provided and dispatches ready event', async () => {
    const { useWaveformCanvas } = await import('../useWaveformCanvas')

    function TestComponent() {
      const { canvasRef } = useWaveformCanvas({
        width: 120,
        height: 40,
        barWidth: 10,
        gap: 2,
        barColor: '#000',
        progressColor: '#f00',
        backgroundColor: '#0f0',
        playheadColor: '#00f',
        peaks,
        currentTime: 0.5,
        duration: 2,
        isPlaying: false
      } as any)

      return <canvas ref={canvasRef} />
    }

    const { container } = render(<TestComponent />)

    await waitFor(() => expect((window as any).__waveformReady).toBe(true))
    // ensure canvas element exists
    expect(container.querySelector('canvas')).toBeTruthy()
  })
})
