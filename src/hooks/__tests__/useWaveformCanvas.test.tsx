import { render } from '@testing-library/react'
import { waitFor } from '@testing-library/react'
import { useWaveformCanvas } from '../useWaveformCanvas'
import { describe, it } from 'vitest'

function TestComponent() {
  const { canvasRef } = useWaveformCanvas({
    width: 100,
    height: 20,
    barWidth: 2,
    gap: 1,
    barColor: '#000',
    progressColor: '#f00',
    backgroundColor: 'transparent',
    playheadColor: '#0f0',
    peaks: new Float32Array([0.5, 0.2, 0.8]),
    currentTime: 0,
    duration: 10,
    isPlaying: false
  })
  return <canvas ref={canvasRef} data-testid="canvas" />
}

describe('useWaveformCanvas', () => {
  it('dispatches waveform-ready after drawing and caching', async () => {
    // Clear any previous flag
    ;(window as any).__waveformReady = false

    render(<TestComponent />)

    await waitFor(() => {
      if (!(window as any).__waveformReady) throw new Error('not ready')
    })
  })
})
