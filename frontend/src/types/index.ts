export type Currency = 'KES' | 'USD'
export type TransactionType = 'BUY' | 'SELL'

export interface User {
  id: string
  name: string
  email: string
}

export interface AuthResponse {
  user: User
  token: string
  refreshToken?: string
}

export interface Portfolio {
  id: string
  name: string
  clientName: string
  baseCurrency: Currency
  createdAt: string
}

export interface Transaction {
  id: string
  portfolioId: string
  instrument: string
  type: TransactionType
  quantity: number
  unitPrice: number
  tradeDate: string
  createdAt: string
}

export interface Holding {
  instrument: string
  quantity: number
  averageCost: number
  totalInvested: number
  totalValue: number
}

export interface PortfolioSummary {
  portfolioId: string
  totalInvested: number
  currentValue: number
  unrealisedGainLoss: number
  holdings: Holding[]
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: Record<string, unknown>
  }
}

export interface PortfolioInput {
  name: string
  clientName: string
  baseCurrency: Currency
}

export interface TransactionInput {
  instrument: string
  type: TransactionType
  quantity: number
  unitPrice: number
  tradeDate: string
}
