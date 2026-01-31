import { describe, it, expect } from 'vitest'
import { formatPrice } from './formatPrice'

describe('formatPrice', () => {
  it('should format price correctly', () => {
    // Intl.NumberFormat używa non-breaking space (U+00A0), nie zwykłej spacji
    expect(formatPrice(100000)).toBe('100\u00A0000\u00A0zł')
    expect(formatPrice(50000)).toBe('50\u00A0000\u00A0zł')
    expect(formatPrice(1234567)).toBe('1\u00A0234\u00A0567\u00A0zł')
  })

  it('should handle null and undefined', () => {
    expect(formatPrice(null)).toBe('-')
    expect(formatPrice(undefined)).toBe('-')
  })

  it('should format zero', () => {
    expect(formatPrice(0)).toBe('0\u00A0zł')
  })

  it('should format large numbers', () => {
    expect(formatPrice(1000000)).toBe('1\u00A0000\u00A0000\u00A0zł')
  })
})

