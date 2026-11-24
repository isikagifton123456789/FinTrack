import type { Currency } from '../types'

export function formatCurrency(value: number, currency: Currency): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 4 }).format(value)
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function signedCurrency(value: number, currency: Currency): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatCurrency(Math.abs(value), currency)}`
}
