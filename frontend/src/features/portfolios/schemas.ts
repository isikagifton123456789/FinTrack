import { z } from 'zod'

export const portfolioSchema = z.object({
  name: z.string().trim().min(2, 'Enter a portfolio name.').max(64, 'Keep the name under 65 characters.'),
  clientName: z.string().trim().min(2, 'Enter the client name.').max(64, 'Keep the name under 65 characters.'),
  baseCurrency: z.enum(['KES', 'USD']),
})

export type PortfolioValues = z.infer<typeof portfolioSchema>
