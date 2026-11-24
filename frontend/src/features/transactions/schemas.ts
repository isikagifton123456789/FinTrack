import { z } from 'zod'

export const transactionSchema = z.object({
  instrument: z.string().trim().min(1, 'Choose or enter an instrument.').max(20, 'Keep the instrument symbol under 21 characters.'),
  type: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive('Quantity must be greater than zero.'),
  unitPrice: z.number().positive('Unit price must be greater than zero.'),
  tradeDate: z.string().min(1, 'Choose a trade date.'),
})

export type TransactionValues = z.infer<typeof transactionSchema>
