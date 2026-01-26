import { render, screen, fireEvent } from '@testing-library/react'
import { vi, it, describe, expect } from 'vitest'
import { WaveformControls } from '../WaveformControls'

describe('WaveformControls volume icon functionality', () => {
  const defaultProps = {
    isPlaying: false,
    displayTime: 0,
    duration: 100,
    volume: 0.5,
    onTogglePlay: vi.fn(),
    onSeek: vi.fn(),
    onVolumeChange: vi.fn(),
  }

  it('renders mute icon when volume is 0', () => {
    const { container } = render(
      <WaveformControls {...defaultProps} volume={0} />
    )
    
    const volumeButton = screen.getByRole('button', { name: /unmute/i })
    expect(volumeButton).toBeTruthy()
  })

  it('renders unmute aria-label when volume is greater than 0', () => {
    const { container } = render(
      <WaveformControls {...defaultProps} volume={0.5} />
    )
    
    const volumeButton = screen.getByRole('button', { name: /mute/i })
    expect(volumeButton).toBeTruthy()
  })

  it('toggles to mute when volume icon is clicked with volume > 0', () => {
    const onVolumeChange = vi.fn()
    render(
      <WaveformControls
        {...defaultProps}
        volume={0.7}
        onVolumeChange={onVolumeChange}
      />
    )
    
    const volumeButton = screen.getByRole('button', { name: /mute/i })
    fireEvent.click(volumeButton)
    
    expect(onVolumeChange).toHaveBeenCalledWith(0)
  })

  it('restores previous volume when unmute icon is clicked', () => {
    const onVolumeChange = vi.fn()
    const { rerender } = render(
      <WaveformControls
        {...defaultProps}
        volume={0.8}
        onVolumeChange={onVolumeChange}
      />
    )
    
    // Click to mute
    const muteButton = screen.getByRole('button', { name: /mute/i })
    fireEvent.click(muteButton)
    expect(onVolumeChange).toHaveBeenCalledWith(0)
    
    // Rerender with volume 0 (simulating the mute)
    rerender(
      <WaveformControls
        {...defaultProps}
        volume={0}
        onVolumeChange={onVolumeChange}
      />
    )
    
    // Click to unmute
    const unmuteButton = screen.getByRole('button', { name: /unmute/i })
    fireEvent.click(unmuteButton)
    
    // Should restore to previous volume (0.8)
    expect(onVolumeChange).toHaveBeenCalledWith(0.8)
  })

  it('restores to 0.5 when unmuting if previous volume was 0', () => {
    const onVolumeChange = vi.fn()
    render(
      <WaveformControls
        {...defaultProps}
        volume={0}
        onVolumeChange={onVolumeChange}
      />
    )
    
    const unmuteButton = screen.getByRole('button', { name: /unmute/i })
    fireEvent.click(unmuteButton)
    
    // Should restore to default 0.5 since there was no previous volume
    expect(onVolumeChange).toHaveBeenCalledWith(0.5)
  })

  it('updates previous volume reference when volume changes', () => {
    const onVolumeChange = vi.fn()
    const { rerender } = render(
      <WaveformControls
        {...defaultProps}
        volume={0.3}
        onVolumeChange={onVolumeChange}
      />
    )
    
    // Change volume to 0.9
    rerender(
      <WaveformControls
        {...defaultProps}
        volume={0.9}
        onVolumeChange={onVolumeChange}
      />
    )
    
    // Mute
    const muteButton = screen.getByRole('button', { name: /mute/i })
    fireEvent.click(muteButton)
    expect(onVolumeChange).toHaveBeenCalledWith(0)
    
    // Rerender as muted
    rerender(
      <WaveformControls
        {...defaultProps}
        volume={0}
        onVolumeChange={onVolumeChange}
      />
    )
    
    // Unmute should restore to 0.9 (most recent non-zero volume)
    const unmuteButton = screen.getByRole('button', { name: /unmute/i })
    fireEvent.click(unmuteButton)
    expect(onVolumeChange).toHaveBeenCalledWith(0.9)
  })

  it('renders volume icon as a button with correct accessibility', () => {
    render(<WaveformControls {...defaultProps} volume={0.5} />)
    
    const volumeButton = screen.getByRole('button', { name: /mute/i })
    expect(volumeButton).toBeTruthy()
    expect(volumeButton.tagName).toBe('BUTTON')
  })
})
