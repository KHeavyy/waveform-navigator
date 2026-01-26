import { render, screen, waitFor } from '@testing-library/react'
import { useResponsiveWidth } from '../useResponsiveWidth'
import { describe, it, expect } from 'vitest'

describe('useResponsiveWidth ResizeObserver', () => {
  it('updates width when ResizeObserver callback is triggered', async () => {
    let lastCallback: ResizeObserverCallback | null = null

    // Provide a mock ResizeObserver that captures the callback
    // and returns an instance with observe/disconnect methods
    // so tests can trigger it directly.
    // @ts-ignore
    global.ResizeObserver = class {
      cb: ResizeObserverCallback
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb
        lastCallback = cb
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    } as any

    function TestComponent() {
      const { width, containerRef } = useResponsiveWidth({ responsive: true, debounceMs: 10, fallbackWidth: 100 })
      return <div ref={containerRef} data-testid="container">{width}</div>
    }

    render(<TestComponent />)

    // Trigger the resize observer callback with a new width
    expect(lastCallback).toBeTruthy()
    lastCallback!([{ contentRect: { width: 333 } } as any], {} as any)

    // Debounce is active — wait for the debounced update
    await waitFor(() => expect(screen.getByTestId('container').textContent).toBe('333'))
  })
})
