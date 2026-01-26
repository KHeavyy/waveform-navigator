import { describe, it, expect } from 'vitest'
import { formatTime } from '../formatTime'

describe('formatTime', () => {
  it('formats zero seconds', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('formats seconds less than 60', () => {
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(30)).toBe('0:30')
    expect(formatTime(59)).toBe('0:59')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(60)).toBe('1:00')
    expect(formatTime(90)).toBe('1:30')
    expect(formatTime(125)).toBe('2:05')
  })

  it('formats double-digit minutes', () => {
    expect(formatTime(600)).toBe('10:00')
    expect(formatTime(723)).toBe('12:03')
    expect(formatTime(3599)).toBe('59:59')
  })

  it('handles decimal values by flooring', () => {
    expect(formatTime(1.9)).toBe('0:01')
    expect(formatTime(59.9)).toBe('0:59')
    expect(formatTime(90.5)).toBe('1:30')
  })

  it('handles invalid values', () => {
    expect(formatTime(NaN)).toBe('0:00')
    expect(formatTime(Infinity)).toBe('0:00')
    expect(formatTime(-Infinity)).toBe('0:00')
  })

})
