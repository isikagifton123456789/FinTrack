import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'

const demoEmail = (process.env.DEMO_EMAIL ?? 'analyst@finnet.demo').toLowerCase()
const demoPassword = process.env.DEMO_PASSWORD
if (!demoPassword || demoPassword.length < 8) {
  throw new Error('Set DEMO_PASSWORD to at least 8 characters in backend/.env before running the seed script.')
}

const portfolios = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Wanjiku Family Trust', clientName: 'Grace Wanjiku', baseCurrency: 'KES' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Otieno Growth Fund', clientName: 'Peter Otieno', baseCurrency: 'USD' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Mwangi Retirement Plan', clientName: 'Daniel Mwangi', baseCurrency: 'KES' },
]
const symbols = ['SCOM', 'KCB', 'EQTY', 'T-BILL-91']
const unitPricesKes = { SCOM: 25.2, KCB: 43.8, EQTY: 56.9, 'T-BILL-91': 96.4 }
const kesPerUsd = 129

try {
  await pool.query('BEGIN')
  const passwordHash = await bcrypt.hash(demoPassword, 12)
  const userResult = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ('Amina Njeri', $1, $2)
     ON CONFLICT ((LOWER(email))) DO UPDATE
       SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, updated_at = NOW()
     RETURNING id`,
    [demoEmail, passwordHash],
  )
  const ownerId = userResult.rows[0].id
  for (const portfolio of portfolios) {
    await pool.query(
      `INSERT INTO portfolios (id, owner_id, name, client_name, base_currency)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         name = EXCLUDED.name,
         client_name = EXCLUDED.client_name,
         base_currency = EXCLUDED.base_currency,
         updated_at = NOW()`,
      [portfolio.id, ownerId, portfolio.name, portfolio.clientName, portfolio.baseCurrency],
    )
  }
  const today = new Date()
  for (const [portfolioIndex, portfolio] of portfolios.entries()) {
    const priceRate = portfolio.baseCurrency === 'USD' ? 1 / kesPerUsd : 1
    for (const [instrumentIndex, instrument] of symbols.entries()) {
      const base = (portfolioIndex + 1) * (instrumentIndex + 2) * (instrument === 'T-BILL-91' ? 120 : 37)
      const monthsAgo = (portfolioIndex * 3 + instrumentIndex * 2 + 1) % 11 + 1
      const buyDate = new Date(today)
      buyDate.setMonth(buyDate.getMonth() - monthsAgo)
      const quantity = base + (instrumentIndex + 1) * 13
      await insertSeedTransaction({
        portfolioId: portfolio.id,
        instrument,
        type: 'BUY',
        quantity,
        unitPrice: unitPricesKes[instrument] * priceRate,
        tradeDate: buyDate,
        seedKey: `${portfolio.id}-${instrument}-buy`,
      })
      if (instrumentIndex < 3) {
        const sellDate = new Date(buyDate)
        sellDate.setMonth(sellDate.getMonth() + 1)
        await insertSeedTransaction({
          portfolioId: portfolio.id,
          instrument,
          type: 'SELL',
          quantity: Math.max(2, Math.floor(quantity * 0.16)),
          unitPrice: unitPricesKes[instrument] * priceRate * 1.08,
          tradeDate: sellDate,
          seedKey: `${portfolio.id}-${instrument}-sell`,
        })
      }
    }
  }
  await pool.query('COMMIT')
  console.log(`Seeded demo analyst ${demoEmail}.`)
} catch (error) {
  await pool.query('ROLLBACK')
  throw error
} finally {
  await pool.end()
}

async function insertSeedTransaction(transaction) {
  await pool.query(
    `INSERT INTO transactions (portfolio_id, instrument, type, quantity, unit_price, trade_date, seed_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (seed_key) DO UPDATE SET
       quantity = EXCLUDED.quantity,
       unit_price = EXCLUDED.unit_price,
       trade_date = EXCLUDED.trade_date`,
    [
      transaction.portfolioId,
      transaction.instrument,
      transaction.type,
      transaction.quantity,
      transaction.unitPrice,
      transaction.tradeDate.toISOString().slice(0, 10),
      transaction.seedKey,
    ],
  )
}
