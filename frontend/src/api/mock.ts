import { ApiError } from '../lib/errors'
import type {
  AuthResponse,
  Holding,
  Portfolio,
  PortfolioInput,
  PortfolioSummary,
  Transaction,
  TransactionInput,
  User,
} from '../types'

interface Database {
  credentials: { user: User; password: string }[]
  portfolios: Portfolio[]
  transactions: Transaction[]
}

const storageKey = 'fintrack.mock.v1'
const DEMO_USER: User = { id: 'user-demo', name: 'Amina Njeri', email: 'analyst@finnet.demo' }
const instruments = ['SCOM', 'KCB', 'EQTY', 'T-BILL-91'] as const
const marketPrices: Record<string, number> = { SCOM: 28.4, KCB: 47.2, EQTY: 61.5, 'T-BILL-91': 98.7 }
const purchasePrices: Record<string, number> = { SCOM: 25.2, KCB: 43.8, EQTY: 56.9, 'T-BILL-91': 96.4 }
const kesPerUsd = 129

function createSeed(): Database {
  const portfolios: Portfolio[] = [
    { id: 'portfolio-wanjiku', name: 'Wanjiku Family Trust', clientName: 'Grace Wanjiku', baseCurrency: 'KES', createdAt: '2024-06-18' },
    { id: 'portfolio-otieno', name: 'Otieno Growth Fund', clientName: 'Peter Otieno', baseCurrency: 'USD', createdAt: '2024-09-04' },
    { id: 'portfolio-mwangi', name: 'Mwangi Retirement Plan', clientName: 'Daniel Mwangi', baseCurrency: 'KES', createdAt: '2025-01-12' },
  ]
  const transactions: Transaction[] = []
  portfolios.forEach((portfolio, portfolioIndex) => {
    const currencyRate = portfolio.baseCurrency === 'USD' ? 1 / kesPerUsd : 1
    instruments.forEach((instrument, instrumentIndex) => {
      const base = (portfolioIndex + 1) * (instrumentIndex + 2) * (instrument === 'T-BILL-91' ? 120 : 37)
      const monthsAgo = (portfolioIndex * 3 + instrumentIndex * 2 + 1) % 11 + 1
      const date = new Date()
      date.setMonth(date.getMonth() - monthsAgo)
      const buyQty = base + (instrumentIndex + 1) * 13
      transactions.push({
        id: `seed-buy-${portfolioIndex}-${instrumentIndex}`,
        portfolioId: portfolio.id,
        instrument,
        type: 'BUY',
        quantity: buyQty,
        unitPrice: purchasePrices[instrument] * currencyRate,
        tradeDate: date.toISOString().slice(0, 10),
        createdAt: date.toISOString(),
      })
      if (instrumentIndex !== 3) {
        const sellDate = new Date(date)
        sellDate.setMonth(sellDate.getMonth() + 1)
        transactions.push({
          id: `seed-sell-${portfolioIndex}-${instrumentIndex}`,
          portfolioId: portfolio.id,
          instrument,
          type: 'SELL',
          quantity: Math.max(2, Math.floor(buyQty * 0.16)),
          unitPrice: purchasePrices[instrument] * currencyRate * 1.08,
          tradeDate: sellDate.toISOString().slice(0, 10),
          createdAt: sellDate.toISOString(),
        })
      }
    })
  })
  return { credentials: [{ user: DEMO_USER, password: 'demo1234' }], portfolios, transactions }
}

function readDatabase(): Database {
  const stored = window.localStorage.getItem(storageKey)
  if (!stored) {
    const seed = createSeed()
    window.localStorage.setItem(storageKey, JSON.stringify(seed))
    return seed
  }
  return JSON.parse(stored) as Database
}

function writeDatabase(database: Database): void {
  window.localStorage.setItem(storageKey, JSON.stringify(database))
}

async function latency(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 300 + Math.floor(Math.random() * 401)))
  if (Math.random() < 0.025) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'The service is briefly unavailable. Please try again.', {})
}

function requirePortfolio(database: Database, id: string): Portfolio {
  const portfolio = database.portfolios.find((item) => item.id === id)
  if (!portfolio) throw new ApiError(404, 'PORTFOLIO_NOT_FOUND', 'This portfolio could not be found.', { portfolioId: id })
  return portfolio
}

function getHoldings(database: Database, portfolioId: string): Holding[] {
  const transactions = database.transactions.filter((item) => item.portfolioId === portfolioId)
  const currencyRate = database.portfolios.find((item) => item.id === portfolioId)?.baseCurrency === 'USD' ? 1 / kesPerUsd : 1
  const holdings = new Map<string, { quantity: number; cost: number }>()
  for (const transaction of [...transactions].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))) {
    const holding = holdings.get(transaction.instrument) ?? { quantity: 0, cost: 0 }
    if (transaction.type === 'BUY') {
      holding.cost += transaction.quantity * transaction.unitPrice
      holding.quantity += transaction.quantity
    } else {
      const averageCost = holding.quantity > 0 ? holding.cost / holding.quantity : 0
      holding.cost -= averageCost * transaction.quantity
      holding.quantity -= transaction.quantity
    }
    holdings.set(transaction.instrument, holding)
  }
  return [...holdings.entries()]
    .filter(([, value]) => value.quantity > 0.000001)
    .map(([instrument, value]) => {
      const averageCost = value.cost / value.quantity
      return {
        instrument,
        quantity: value.quantity,
        averageCost,
        totalInvested: value.cost,
        totalValue: value.quantity * ((marketPrices[instrument] ?? averageCost / currencyRate) * currencyRate),
      }
    })
}

function getQuantityAsOf(database: Database, portfolioId: string, instrument: string, tradeDate: string): number {
  return database.transactions
    .filter((item) => item.portfolioId === portfolioId && item.instrument === instrument && item.tradeDate <= tradeDate)
    .reduce((quantity, item) => quantity + (item.type === 'BUY' ? item.quantity : -item.quantity), 0)
}

function summary(database: Database, portfolioId: string): PortfolioSummary {
  requirePortfolio(database, portfolioId)
  const holdings = getHoldings(database, portfolioId)
  const totalInvested = holdings.reduce((total, holding) => total + holding.totalInvested, 0)
  const currentValue = holdings.reduce((total, holding) => total + holding.totalValue, 0)
  return { portfolioId, totalInvested, currentValue, unrealisedGainLoss: currentValue - totalInvested, holdings }
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function assertSellWithinHoldings(heldQuantity: number, requestedQuantity: number, instrument: string): void {
  if (requestedQuantity > heldQuantity) {
    throw new ApiError(422, 'INSUFFICIENT_HOLDINGS', `You hold ${heldQuantity} ${instrument}; reduce the sell quantity or add a buy first.`, {
      instrument,
      heldQuantity,
      requestedQuantity,
    })
  }
}

export async function mockLogin(email: string, password: string): Promise<AuthResponse> {
  await latency()
  const credentials = readDatabase().credentials.find((item) => item.user.email.toLowerCase() === email.toLowerCase() && item.password === password)
  if (!credentials) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Those details did not match an account. Check your email and password.', {})
  }
  return { user: credentials.user, token: 'demo-session-token' }
}

export async function mockRegister(name: string, email: string, password: string): Promise<AuthResponse> {
  await latency()
  const database = readDatabase()
  if (database.credentials.some((item) => item.user.email.toLowerCase() === email.toLowerCase())) {
    throw new ApiError(409, 'EMAIL_IN_USE', 'An account already uses this email address.', {})
  }
  const user = { id: createId(), name, email }
  database.credentials.push({ user, password })
  writeDatabase(database)
  return { user, token: createId() }
}

export async function mockGetPortfolios(): Promise<Portfolio[]> {
  await latency()
  return readDatabase().portfolios
}

export async function mockCreatePortfolio(input: PortfolioInput): Promise<Portfolio> {
  await latency()
  const database = readDatabase()
  const portfolio = { ...input, id: createId(), createdAt: new Date().toISOString() }
  database.portfolios.unshift(portfolio)
  writeDatabase(database)
  return portfolio
}

export async function mockGetPortfolio(id: string): Promise<Portfolio> {
  await latency()
  return requirePortfolio(readDatabase(), id)
}

export async function mockUpdatePortfolio(id: string, input: PortfolioInput): Promise<Portfolio> {
  await latency()
  const database = readDatabase()
  const portfolio = requirePortfolio(database, id)
  Object.assign(portfolio, input)
  writeDatabase(database)
  return portfolio
}

export async function mockDeletePortfolio(id: string): Promise<void> {
  await latency()
  const database = readDatabase()
  requirePortfolio(database, id)
  database.portfolios = database.portfolios.filter((portfolio) => portfolio.id !== id)
  database.transactions = database.transactions.filter((transaction) => transaction.portfolioId !== id)
  writeDatabase(database)
}

export async function mockGetTransactions(portfolioId: string): Promise<Transaction[]> {
  await latency()
  const database = readDatabase()
  requirePortfolio(database, portfolioId)
  return database.transactions.filter((transaction) => transaction.portfolioId === portfolioId)
}

export async function mockCreateTransaction(portfolioId: string, input: TransactionInput): Promise<Transaction> {
  await latency()
  const database = readDatabase()
  requirePortfolio(database, portfolioId)
  const instrument = input.instrument.trim().toUpperCase()
  if (!instrument) throw new ApiError(422, 'INVALID_INSTRUMENT', 'Enter an instrument symbol.', {})
  if (input.type === 'SELL') {
    const held = getQuantityAsOf(database, portfolioId, instrument, input.tradeDate)
    assertSellWithinHoldings(held, input.quantity, instrument)
  }
  const transaction: Transaction = {
    ...input,
    instrument,
    id: createId(),
    portfolioId,
    createdAt: new Date().toISOString(),
  }
  database.transactions.push(transaction)
  writeDatabase(database)
  return transaction
}

export async function mockDeleteTransaction(id: string): Promise<void> {
  await latency()
  const database = readDatabase()
  const transaction = database.transactions.find((item) => item.id === id)
  if (!transaction) throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'This transaction could not be found.', { transactionId: id })
  database.transactions = database.transactions.filter((item) => item.id !== id)
  writeDatabase(database)
}

export async function mockGetSummary(portfolioId: string): Promise<PortfolioSummary> {
  await latency()
  return summary(readDatabase(), portfolioId)
}

export const knownInstruments = instruments
