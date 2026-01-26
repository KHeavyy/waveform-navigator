import { render, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'

// Mock computePeaksFromChannelData so we can count calls
vi.mock('../../utils/peaksComputation', () => ({
  computePeaksFromChannelData: vi.fn(() => ({ peaks: new Float32Array([0.2, 0.4]) }))
}))

describe('useWaveformData recompute on dimension change', () => {
  it('recomputes peaks when width changes significantly', async () => {
    ;(window as any).AudioContext = class {
      async decodeAudioData(_: ArrayBuffer) {
        return {
          numberOfChannels: 1,
          getChannelData: () => new Float32Array([0.1, 0.5, 0.3])
        }
      }
      close() {}
    }

    const onPeaksComputed = vi.fn()

    const { useWaveformData } = await import('../useWaveformData')

    function TestComponent({ w }: { w: number }) {
      const file = new File([new ArrayBuffer(8)], 'test.wav', { type: 'audio/wav' })
      ;(file as any).arrayBuffer = async () => new ArrayBuffer(8)
      useWaveformData({ audio: file, width: w, barWidth: 2, gap: 1, onPeaksComputed } as any)
      return <div />
    }

    const { rerender } = render(<TestComponent w={100} />)

    // wait for initial computation
    await waitFor(() => expect(onPeaksComputed).toHaveBeenCalled())

    onPeaksComputed.mockClear()

    // Rerender with a width change > 1 to trigger recompute effect
    rerender(<TestComponent w={130} />)

    await waitFor(() => expect(onPeaksComputed).toHaveBeenCalled())
  })
})
