import { render, screen } from '@testing-library/react'
import { vi, it, describe, expect } from 'vitest'
import { WaveformControls } from '../WaveformControls'

describe('WaveformControls color customization', () => {
  const defaultProps = {
    isPlaying: false,
    displayTime: 0,
    duration: 100,
    volume: 0.5,
    onTogglePlay: vi.fn(),
    onSeek: vi.fn(),
    onVolumeChange: vi.fn(),
  }

  it('applies default colors when no color props are provided', () => {
    const { container } = render(<WaveformControls {...defaultProps} />)
    
    const playButton = screen.getByRole('button', { name: /play/i })
    expect(playButton).toHaveStyle({ backgroundColor: '#111827' })
    
    const rewindButton = screen.getByRole('button', { name: /rewind/i })
    expect(rewindButton).toHaveStyle({ backgroundColor: '#fff' })
    
    const forwardButton = screen.getByRole('button', { name: /forward/i })
    expect(forwardButton).toHaveStyle({ backgroundColor: '#fff' })
  })

  it('applies custom play button color', () => {
    render(
      <WaveformControls
        {...defaultProps}
        playButtonColor="#ff0000"
      />
    )
    
    const playButton = screen.getByRole('button', { name: /play/i })
    expect(playButton).toHaveStyle({ backgroundColor: '#ff0000' })
  })

  it('applies custom rewind and forward button colors', () => {
    render(
      <WaveformControls
        {...defaultProps}
        rewindButtonColor="#00ff00"
        forwardButtonColor="#0000ff"
      />
    )
    
    const rewindButton = screen.getByRole('button', { name: /rewind/i })
    expect(rewindButton).toHaveStyle({ backgroundColor: '#00ff00' })
    
    const forwardButton = screen.getByRole('button', { name: /forward/i })
    expect(forwardButton).toHaveStyle({ backgroundColor: '#0000ff' })
  })

  it('applies custom volume slider fill color', () => {
    render(
      <WaveformControls
        {...defaultProps}
        volumeSliderFillColor="#ff00ff"
      />
    )
    
    const volumeSlider = screen.getByRole('slider', { name: /volume/i })
    expect(volumeSlider).toHaveStyle({ '--volume-fill-color': '#ff00ff' })
  })

  it('updates volume percentage CSS variable based on volume', () => {
    const { rerender } = render(
      <WaveformControls
        {...defaultProps}
        volume={0.7}
      />
    )
    
    let volumeSlider = screen.getByRole('slider', { name: /volume/i })
    expect(volumeSlider).toHaveStyle({ '--volume-percent': '70%' })
    
    rerender(
      <WaveformControls
        {...defaultProps}
        volume={0.3}
      />
    )
    
    volumeSlider = screen.getByRole('slider', { name: /volume/i })
    expect(volumeSlider).toHaveStyle({ '--volume-percent': '30%' })
  })

  it('applies all color customizations together', () => {
    render(
      <WaveformControls
        {...defaultProps}
        playButtonColor="#1a1a1a"
        playIconColor="#eeeeee"
        rewindButtonColor="#2a2a2a"
        rewindIconColor="#dddddd"
        forwardButtonColor="#3a3a3a"
        forwardIconColor="#cccccc"
        volumeSliderFillColor="#4a4a4a"
      />
    )
    
    const playButton = screen.getByRole('button', { name: /play/i })
    expect(playButton).toHaveStyle({ backgroundColor: '#1a1a1a' })
    
    const rewindButton = screen.getByRole('button', { name: /rewind/i })
    expect(rewindButton).toHaveStyle({ backgroundColor: '#2a2a2a' })
    
    const forwardButton = screen.getByRole('button', { name: /forward/i })
    expect(forwardButton).toHaveStyle({ backgroundColor: '#3a3a3a' })
    
    const volumeSlider = screen.getByRole('slider', { name: /volume/i })
    expect(volumeSlider).toHaveStyle({ '--volume-fill-color': '#4a4a4a' })
  })
})
