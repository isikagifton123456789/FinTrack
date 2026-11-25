import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { once } from 'node:events'
import jwt from 'jsonwebtoken'

process.env.DATABASE_URL ??= 'postgresql://localhost:5432/fintrack_test'
process.env.JWT_SECRET ??= 'test-only-secret-that-is-long-enough-123456'

const [{ default: app }, { pool }, { assertSellWithinHoldings, calculateHoldings }] = await Promise.all([
  import('../src/app.js'),
  import('../src/db.js'),
  import('../src/ledger.js'),
])
const server = app.listen(0)
await once(server, 'listening')
const address = server.address()
assert.ok(address && typeof address !== 'string')
const apiUrl = `http://127.0.0.1:${address.port}`

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  await pool.end()
})

describe('FinTrack API authentication', () => {
  it('rejects unauthenticated portfolio requests with the standard error envelope', async () => {
    const response = await fetch(`${apiUrl}/api/portfolios`)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Sign in to continue.',
        details: {},
      },
    })
  })

  it('rejects a refresh token when an access token is required', async () => {
    const token = jwt.sign({ type: 'refresh' }, process.env.JWT_SECRET, { subject: 'user-id', expiresIn: '1m' })
    const response = await fetch(`${apiUrl}/api/portfolios`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error.code, 'INVALID_TOKEN')
  })

  it('documents the email verification and password recovery endpoints', async () => {
    const response = await fetch(`${apiUrl}/api/openapi.json`)
    const document = await response.json()
    assert.equal(response.status, 200)
    assert.ok(document.paths['/auth/verify-email'])
    assert.ok(document.paths['/auth/forgot-password'])
    assert.ok(document.paths['/auth/reset-password'])
  })

  it('rejects a missing email verification token before accessing the database', async () => {
    const response = await fetch(`${apiUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '' }),
    })
    assert.equal(response.status, 422)
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR')
  })

  it('enforces the password policy before attempting a reset', async () => {
    const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '0123456789012345678901234567890123456789012', password: 'lowercase1' }),
    })
    assert.equal(response.status, 422)
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR')
  })
})

describe('portfolio ledger', () => {
  it('rejects sell quantities greater than holdings using a 422 error', () => {
    assert.throws(
      () => assertSellWithinHoldings(12, 12.01, 'SCOM'),
      (error) => error.status === 422 &&
        error.code === 'INSUFFICIENT_HOLDINGS' &&
        error.details.heldQuantity === 12 &&
        error.details.requestedQuantity === 12.01,
    )
  })

  it('calculates remaining invested value using average cost after a partial sell', () => {
    const holdings = calculateHoldings([
      { instrument: 'SCOM', type: 'BUY', quantity: 100, unitPrice: 20 },
      { instrument: 'SCOM', type: 'BUY', quantity: 100, unitPrice: 30 },
      { instrument: 'SCOM', type: 'SELL', quantity: 50, unitPrice: 28 },
    ], 'KES')
    assert.deepEqual(holdings[0], {
      instrument: 'SCOM',
      quantity: 150,
      averageCost: 25,
      totalInvested: 3750,
      totalValue: 4260,
    })
  })
})
