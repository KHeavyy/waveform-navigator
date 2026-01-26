import { render, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'

// Mock computePeaksFromChannelData to return deterministic peaks
vi.mock('../../utils/peaksComputation', () => ({
  computePeaksFromChannelData: vi.fn(() => ({ peaks: new Float32Array([0.4, 0.6]) }))
}))

vi.mock('../../utils/workerCreation', () => ({ createPeaksWorker: vi.fn(() => null) }))

describe('useWaveformData file input', () => {
  it('accepts a File and computes peaks', async () => {
    // Mock AudioContext decode to return channel data
    ;(window as any).AudioContext = class {
      async decodeAudioData(_: ArrayBuffer) {
        return {
          numberOfChannels: 1,
          getChannelData: () => new Float32Array([1, 0.5, 0.2])
        }
      }
      close() {}
    }

    const onPeaksComputed = vi.fn()

    const { useWaveformData } = await import('../useWaveformData')

    function TestComponent() {
      const file = new File([new ArrayBuffer(8)], 'test.mp3', { type: 'audio/mpeg' })
      ;(file as any).arrayBuffer = async () => new ArrayBuffer(8)
      const { peaks } = useWaveformData({ audio: file, width: 100, barWidth: 2, gap: 1, onPeaksComputed } as any)
      return <div>{peaks ? peaks.length : 0}</div>
    }

    render(<TestComponent />)

    await waitFor(() => expect(onPeaksComputed).toHaveBeenCalled())
  })
})
