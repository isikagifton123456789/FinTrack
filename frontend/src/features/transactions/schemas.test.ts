import { describe, expect, it, vi } from 'vitest'
import { mockCreateTransaction } from '../../api/mock'
import { transactionSchema } from './schemas'

describe('transaction validation', () => {
  it('rejects a sell above the held quantity with the standard 422 error body', async () => {
    window.localStorage.clear()
    vi.useFakeTimers()
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    try {
      const request = mockCreateTransaction('portfolio-wanjiku', {
        instrument: 'SCOM',
        type: 'SELL',
        quantity: 1_000_000,
        unitPrice: 28.4,
        tradeDate: new Date().toISOString().slice(0, 10),
      })
      const rejection = expect(request).rejects.toMatchObject({
        status: 422,
        body: { error: { code: 'INSUFFICIENT_HOLDINGS', details: { instrument: 'SCOM', requestedQuantity: 1_000_000 } } },
      })
      await vi.advanceTimersByTimeAsync(700)
      await rejection
    } finally {
      vi.useRealTimers()
      random.mockRestore()
      window.localStorage.clear()
    }
  })

  it('rejects non-positive quantities at the form schema boundary', () => {
    expect(transactionSchema.safeParse({
      instrument: 'SCOM',
      type: 'SELL',
      quantity: 0,
      unitPrice: 28.4,
      tradeDate: '2026-03-01',
    }).success).toBe(false)
  })
})
