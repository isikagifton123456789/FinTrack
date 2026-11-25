import bcrypt from 'bcryptjs'
import cors from 'cors'
import { createHash, randomBytes } from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import swaggerUi from 'swagger-ui-express'
import { z } from 'zod'
import { pool } from './db.js'
import { HttpError } from './errors.js'
import { assertSellWithinHoldings, calculateHoldings } from './ledger.js'
import { assertMailerConfigured, sendPasswordResetEmail, sendVerificationEmail } from './mailer.js'
import { openApiDocument } from './openapi.js'

const app = express()
const portfolioSchema = z.object({
  name: z.string().trim().min(2).max(64),
  clientName: z.string().trim().min(2).max(64),
  baseCurrency: z.enum(['KES', 'USD']),
})
const transactionSchema = z.object({
  instrument: z.string().trim().min(1).max(20).transform((symbol) => symbol.toUpperCase()),
  type: z.enum(['BUY', 'SELL']),
  quantity: z.number().finite().positive(),
  unitPrice: z.number().finite().positive(),
  tradeDate: z.iso.date(),
})
const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).regex(/[A-Z]/, 'Include an uppercase letter.').regex(/[a-z]/, 'Include a lowercase letter.').regex(/[0-9]/, 'Include a number.'),
})
const loginSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
})
const emailSchema = z.object({ email: z.email().transform((email) => email.toLowerCase()) })
const actionTokenSchema = z.object({ token: z.string().min(32).max(256) })
const passwordResetSchema = actionTokenSchema.extend({
  password: registrationSchema.shape.password,
})
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET is required and must be at least 32 characters.')
}

app.disable('x-powered-by')
app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new HttpError(403, 'CORS_ORIGIN_DENIED', 'This website is not allowed to access the API.'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}))
app.use(express.json({ limit: '32kb' }))
app.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument))
app.get('/api/openapi.json', (_request, response) => response.json(openApiDocument))
app.get('/api/health', asyncRoute(async (_request, response) => {
  await pool.query('SELECT 1')
  response.json({ status: 'ok' })
}))

app.post('/api/auth/register', asyncRoute(async (request, response) => {
  const { name, email, password } = registrationSchema.parse(request.body)
  assertMailerConfigured()
  const passwordHash = await bcrypt.hash(password, 12)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash],
    )
    const user = userFromRow(result.rows[0])
    const token = await createAuthActionToken(client, user.id, 'verify-email', 24 * 60)
    await sendVerificationEmail(user.email, user.name, token)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    if (isUniqueViolation(error)) throw new HttpError(409, 'EMAIL_IN_USE', 'An account already uses this email address.')
    throw error
  } finally {
    client.release()
  }
  response.status(201).json({ message: 'Check your email for a link to verify your account.' })
}))

app.post('/api/auth/login', asyncRoute(async (request, response) => {
  const { email, password } = loginSchema.parse(request.body)
  const result = await pool.query(
    'SELECT id, name, email, password_hash, email_verified_at FROM users WHERE email = $1',
    [email],
  )
  const record = result.rows[0]
  if (!record || !(await bcrypt.compare(password, record.password_hash))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Those details did not match an account. Check your email and password.')
  }
  if (!record.email_verified_at) {
    throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before signing in.')
  }
  const user = userFromRow(record)
  response.json({ user, ...issueTokens(user.id) })
}))

app.post('/api/auth/verify-email', asyncRoute(async (request, response) => {
  const { token } = actionTokenSchema.parse(request.body)
  await consumeAuthActionToken(token, 'verify-email', async (client, userId) => {
    await client.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE id = $1', [userId])
  })
  response.json({ message: 'Email verified. You can now sign in.' })
}))

app.post('/api/auth/resend-verification', asyncRoute(async (request, response) => {
  const { email } = emailSchema.parse(request.body)
  assertMailerConfigured()
  const result = await pool.query('SELECT id, name, email FROM users WHERE email = $1 AND email_verified_at IS NULL', [email])
  if (result.rowCount) {
    const user = userFromRow(result.rows[0])
    await createAndSendAuthActionEmail(user, 'verify-email', 24 * 60, sendVerificationEmail)
  }
  response.json({ message: 'If that account needs verification, we sent a new link to its email address.' })
}))

app.post('/api/auth/forgot-password', asyncRoute(async (request, response) => {
  const { email } = emailSchema.parse(request.body)
  assertMailerConfigured()
  const result = await pool.query('SELECT id, name, email FROM users WHERE email = $1 AND email_verified_at IS NOT NULL', [email])
  if (result.rowCount) {
    const user = userFromRow(result.rows[0])
    await createAndSendAuthActionEmail(user, 'password-reset', 30, sendPasswordResetEmail)
  }
  response.json({ message: 'If an account exists for that email, we sent a password reset link.' })
}))

app.post('/api/auth/reset-password', asyncRoute(async (request, response) => {
  const { token, password } = passwordResetSchema.parse(request.body)
  await consumeAuthActionToken(token, 'password-reset', async (client, userId) => {
    const passwordHash = await bcrypt.hash(password, 12)
    await client.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [userId, passwordHash])
    await client.query(
      `UPDATE auth_action_tokens SET consumed_at = NOW()
       WHERE user_id = $1 AND purpose = 'password-reset' AND consumed_at IS NULL`,
      [userId],
    )
  })
  response.json({ message: 'Password updated. You can now sign in.' })
}))

app.post('/api/auth/refresh', asyncRoute(async (request, response) => {
  const refreshToken = z.string().min(1).parse(request.body?.refreshToken)
  const claims = verifyToken(refreshToken, 'refresh')
  const result = await pool.query('SELECT id FROM users WHERE id = $1', [claims.sub])
  if (!result.rowCount) throw new HttpError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.')
  response.json(issueTokens(claims.sub))
}))

app.use('/api', authenticate)

app.get('/api/portfolios', asyncRoute(async (request, response) => {
  const result = await pool.query(
    `SELECT id, name, client_name, base_currency, created_at
     FROM portfolios WHERE owner_id = $1 ORDER BY name ASC`,
    [request.user.id],
  )
  response.json(result.rows.map(portfolioFromRow))
}))

app.post('/api/portfolios', asyncRoute(async (request, response) => {
  const input = portfolioSchema.parse(request.body)
  const result = await pool.query(
    `INSERT INTO portfolios (owner_id, name, client_name, base_currency)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, client_name, base_currency, created_at`,
    [request.user.id, input.name, input.clientName, input.baseCurrency],
  )
  response.status(201).json(portfolioFromRow(result.rows[0]))
}))

app.get('/api/portfolios/:id', asyncRoute(async (request, response) => {
  response.json(await getOwnedPortfolio(request.user.id, request.params.id))
}))

app.put('/api/portfolios/:id', asyncRoute(async (request, response) => {
  const input = portfolioSchema.parse(request.body)
  const result = await pool.query(
    `UPDATE portfolios
     SET name = $3, client_name = $4, base_currency = $5, updated_at = NOW()
     WHERE id = $1 AND owner_id = $2
     RETURNING id, name, client_name, base_currency, created_at`,
    [request.params.id, request.user.id, input.name, input.clientName, input.baseCurrency],
  )
  if (!result.rowCount) throw portfolioNotFound(request.params.id)
  response.json(portfolioFromRow(result.rows[0]))
}))

app.delete('/api/portfolios/:id', asyncRoute(async (request, response) => {
  const result = await pool.query(
    'DELETE FROM portfolios WHERE id = $1 AND owner_id = $2 RETURNING id',
    [request.params.id, request.user.id],
  )
  if (!result.rowCount) throw portfolioNotFound(request.params.id)
  response.status(204).end()
}))

app.get('/api/portfolios/:id/transactions', asyncRoute(async (request, response) => {
  await getOwnedPortfolio(request.user.id, request.params.id)
  const result = await pool.query(
    `SELECT id, portfolio_id, instrument, type, quantity, unit_price, trade_date, created_at
     FROM transactions WHERE portfolio_id = $1
     ORDER BY trade_date DESC, created_at DESC`,
    [request.params.id],
  )
  response.json(result.rows.map(transactionFromRow))
}))

app.post('/api/portfolios/:id/transactions', asyncRoute(async (request, response) => {
  const input = transactionSchema.parse(request.body)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const portfolio = await client.query(
      'SELECT id FROM portfolios WHERE id = $1 AND owner_id = $2 FOR UPDATE',
      [request.params.id, request.user.id],
    )
    if (!portfolio.rowCount) throw portfolioNotFound(request.params.id)
    if (input.type === 'SELL') {
      const quantityResult = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'BUY' THEN quantity ELSE -quantity END), 0)::float8 AS held
         FROM transactions
         WHERE portfolio_id = $1 AND instrument = $2 AND trade_date <= $3`,
        [request.params.id, input.instrument, input.tradeDate],
      )
      const heldQuantity = quantityResult.rows[0].held
      assertSellWithinHoldings(heldQuantity, input.quantity, input.instrument)
    }
    const result = await client.query(
      `INSERT INTO transactions (portfolio_id, instrument, type, quantity, unit_price, trade_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, portfolio_id, instrument, type, quantity, unit_price, trade_date, created_at`,
      [request.params.id, input.instrument, input.type, input.quantity, input.unitPrice, input.tradeDate],
    )
    await client.query('COMMIT')
    response.status(201).json(transactionFromRow(result.rows[0]))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

app.delete('/api/transactions/:id', asyncRoute(async (request, response) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const transaction = await client.query(
      `SELECT t.id, t.portfolio_id
       FROM transactions t JOIN portfolios p ON p.id = t.portfolio_id
       WHERE t.id = $1 AND p.owner_id = $2`,
      [request.params.id, request.user.id],
    )
    if (!transaction.rowCount) throw new HttpError(404, 'TRANSACTION_NOT_FOUND', 'This transaction could not be found.')
    await client.query('SELECT id FROM portfolios WHERE id = $1 FOR UPDATE', [transaction.rows[0].portfolio_id])
    await client.query('DELETE FROM transactions WHERE id = $1', [request.params.id])
    await client.query('COMMIT')
    response.status(204).end()
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

app.get('/api/portfolios/:id/summary', asyncRoute(async (request, response) => {
  const portfolio = await getOwnedPortfolio(request.user.id, request.params.id)
  const result = await pool.query(
    `SELECT id, portfolio_id, instrument, type, quantity, unit_price, trade_date, created_at
     FROM transactions WHERE portfolio_id = $1 ORDER BY trade_date ASC, created_at ASC`,
    [portfolio.id],
  )
  const holdings = calculateHoldings(result.rows.map(transactionFromRow), portfolio.baseCurrency)
  const totalInvested = holdings.reduce((sum, holding) => sum + holding.totalInvested, 0)
  const currentValue = holdings.reduce((sum, holding) => sum + holding.totalValue, 0)
  response.json({
    portfolioId: portfolio.id,
    totalInvested,
    currentValue,
    unrealisedGainLoss: currentValue - totalInvested,
    holdings,
  })
}))

app.use('/api', (_request, response) => {
  response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'This API endpoint could not be found.', details: {} },
  })
})

app.use((error, _request, response, _next) => {
  if (error instanceof z.ZodError) {
    response.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the submitted information and try again.',
        details: { issues: error.issues.map(({ path, message }) => ({ path: path.join('.'), message })) },
      },
    })
    return
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    })
    return
  }
  console.error('FinTrack API error', error)
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', details: {} },
  })
})

export default app

function authenticate(request, _response, next) {
  const authorization = request.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    next(new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.'))
    return
  }
  try {
    const claims = verifyToken(authorization.slice('Bearer '.length), 'access')
    request.user = { id: claims.sub }
    next()
  } catch (error) {
    next(error)
  }
}

function verifyToken(token, expectedType) {
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    if (typeof claims === 'string' || claims.type !== expectedType || typeof claims.sub !== 'string') {
      throw new HttpError(401, 'INVALID_TOKEN', 'Your session is invalid. Sign in again.')
    }
    return claims
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.')
  }
}

function issueTokens(userId) {
  return {
    token: jwt.sign({ type: 'access' }, process.env.JWT_SECRET, {
      subject: userId,
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
      algorithm: 'HS256',
    }),
    refreshToken: jwt.sign({ type: 'refresh' }, process.env.JWT_SECRET, {
      subject: userId,
      expiresIn: process.env.JWT_REFRESH_TTL ?? '7d',
      algorithm: 'HS256',
    }),
  }
}

async function createAuthActionToken(client, userId, purpose, ttlMinutes) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await client.query(
    `UPDATE auth_action_tokens SET consumed_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [userId, purpose],
  )
  await client.query(
    `INSERT INTO auth_action_tokens (token_hash, user_id, purpose, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 minute'))`,
    [tokenHash, userId, purpose, ttlMinutes],
  )
  return token
}

async function createAndSendAuthActionEmail(user, purpose, ttlMinutes, sendEmail) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const token = await createAuthActionToken(client, user.id, purpose, ttlMinutes)
    await sendEmail(user.email, user.name, token)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function consumeAuthActionToken(token, purpose, applyAction) {
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `SELECT user_id FROM auth_action_tokens
       WHERE token_hash = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash, purpose],
    )
    if (!result.rowCount) throw new HttpError(400, 'INVALID_OR_EXPIRED_TOKEN', 'This link is invalid or has expired. Request a new one.')
    const userId = result.rows[0].user_id
    await applyAction(client, userId)
    await client.query('UPDATE auth_action_tokens SET consumed_at = NOW() WHERE token_hash = $1', [tokenHash])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function getOwnedPortfolio(ownerId, portfolioId) {
  const result = await pool.query(
    `SELECT id, name, client_name, base_currency, created_at
     FROM portfolios WHERE id = $1 AND owner_id = $2`,
    [portfolioId, ownerId],
  )
  if (!result.rowCount) throw portfolioNotFound(portfolioId)
  return portfolioFromRow(result.rows[0])
}

function portfolioFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name,
    baseCurrency: row.base_currency,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function transactionFromRow(row) {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    instrument: row.instrument,
    type: row.type,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    tradeDate: dateString(row.trade_date),
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function dateString(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function userFromRow(row) {
  return { id: row.id, name: row.name, email: row.email }
}

function portfolioNotFound(id) {
  return new HttpError(404, 'PORTFOLIO_NOT_FOUND', 'This portfolio could not be found.', { portfolioId: id })
}

function isUniqueViolation(error) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}
