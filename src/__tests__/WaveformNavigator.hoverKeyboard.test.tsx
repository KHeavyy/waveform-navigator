import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import WaveformNavigator from '../WaveformNavigator'

describe('WaveformNavigator hover and keyboard', () => {
  const origAudio = (global as any).Audio
  const origGetBounding = HTMLCanvasElement.prototype.getBoundingClientRect

  afterEach(() => {
    ;(global as any).Audio = origAudio
    HTMLCanvasElement.prototype.getBoundingClientRect = origGetBounding
  })

  it('shows hover tooltip on mousemove and hides on leave', async () => {
    ;(global as any).Audio = function () {
      const el = document.createElement('audio')
      ;(window as any).__lastAudio = el
      return el
    } as any

    HTMLCanvasElement.prototype.getBoundingClientRect = function () {
      return { left: 0, top: 0, width: 200, height: 50, right: 200, bottom: 50, x: 0, y: 0 }
    } as any

    const { container } = render(<WaveformNavigator audio="/test.mp3" responsive={false} />)

    await waitFor(() => expect((window as any).__lastAudio).toBeTruthy())
    const audioEl = (window as any).__lastAudio as HTMLAudioElement
    Object.defineProperty(audioEl, 'duration', { value: 120, configurable: true })
    audioEl.dispatchEvent(new Event('loadedmetadata'))

    await waitFor(() => {
      const interactive = container.querySelector('.waveform-interactive') as HTMLElement | null
      if (!interactive) throw new Error('interactive not mounted')
    })

    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    fireEvent.mouseMove(canvas, { clientX: 50, clientY: 10 })

    await waitFor(() => expect(container.querySelector('.hover-tooltip')).toBeTruthy())

    fireEvent.mouseLeave(canvas)
    await waitFor(() => expect(container.querySelector('.hover-tooltip')).toBeFalsy())
  })

  it('toggle play on Space key', async () => {
    // Spy on HTMLMediaElement.prototype.play which is mocked in setup
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play')

    ;(global as any).Audio = function () {
      const el = document.createElement('audio')
      ;(window as any).__lastAudio = el
      return el
    } as any

    const { container } = render(<WaveformNavigator audio="/test.mp3" responsive={false} />)

    await waitFor(() => expect((window as any).__lastAudio).toBeTruthy())

    const interactive = container.querySelector('.waveform-interactive') as HTMLElement
    interactive.focus()
    fireEvent.keyDown(interactive, { key: ' ' })

    await waitFor(() => expect(playSpy).toHaveBeenCalled())
    playSpy.mockRestore()
  })
})
