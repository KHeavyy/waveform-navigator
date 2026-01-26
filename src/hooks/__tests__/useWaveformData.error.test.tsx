import { render, waitFor } from '@testing-library/react'
import { vi, describe, afterEach, it, expect } from 'vitest'

// Ensure we mock fetch to return an error before importing the hook
const originalFetch = global.fetch

describe('useWaveformData error handling', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('calls onError when fetch returns non-ok', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404, statusText: 'Not Found' } as any)) as any

    const onError = vi.fn()

    const { useWaveformData } = await import('../useWaveformData')

    function TestComponent() {
      useWaveformData({
        audio: '/missing.mp3',
        width: 100,
        barWidth: 2,
        gap: 1,
        onError
      } as any)

      return <div />
    }

    render(<TestComponent />)

    await waitFor(() => expect(onError).toHaveBeenCalled())
  })
})
