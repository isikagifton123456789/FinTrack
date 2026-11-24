import { describe, expect, it } from 'vitest'
import { formatCurrency } from './format'

describe('formatCurrency', () => {
  it('uses the portfolio currency code and two aligned decimal places', () => {
    expect(formatCurrency(1250000, 'KES')).toContain('KES')
    expect(formatCurrency(1250000, 'KES')).toContain('1,250,000.00')
    expect(formatCurrency(12450.75, 'USD')).toContain('USD')
    expect(formatCurrency(12450.75, 'USD')).toContain('12,450.75')
  })
})
