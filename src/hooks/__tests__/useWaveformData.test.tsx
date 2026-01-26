import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Top-level mocks so they apply before the hook module is imported
const fakeInitialPeaks = new Float32Array([0.1, 0.2])
vi.mock('../../utils/peaksComputation', () => ({
  computePeaksFromChannelData: vi.fn(() => ({ peaks: fakeInitialPeaks }))
}))

// Prepare a fake worker object the hook will receive
const worker: any = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null
}

vi.mock('../../utils/workerCreation', () => ({
  createPeaksWorker: vi.fn(() => worker)
}))

// Provide a simple AudioContext decode that returns channel data
;(window as any).AudioContext = class {
  async decodeAudioData(_: ArrayBuffer) {
    return {
      numberOfChannels: 1,
      getChannelData: () => new Float32Array([1, 0.5, 0.2])
    }
  }
  close() {}
}

// Import hook after mocks are declared
import { useWaveformData } from '../useWaveformData'

describe('useWaveformData', () => {
  it('computes peaks and responds to worker progress messages', async () => {
    function TestComponent() {
      const { peaks } = useWaveformData({
        audio: '/test.mp3',
        width: 100,
        barWidth: 2,
        gap: 1
      } as any)

      return <div data-testid="peaks">{peaks ? Array.from(peaks).join(',') : 'null'}</div>
    }

    render(<TestComponent />)

    // Wait for initial main-thread peaks (from computePeaksFromChannelData)
    await waitFor(() => expect(screen.getByTestId('peaks').textContent).toContain('0.1'))

    // Simulate worker sending a progress update
    const progressed = new Float32Array([0.3, 0.4])
    // call the onmessage handler that the hook assigned
    if (typeof worker.onmessage === 'function') {
      worker.onmessage({ data: { type: 'progress', peaksBuffer: progressed.buffer } } as any)
    }

    await waitFor(() => expect(screen.getByTestId('peaks').textContent).toContain('0.3'))
  })
})
