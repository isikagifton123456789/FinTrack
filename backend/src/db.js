import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Add it to backend/.env for local development or your hosting provider environment.')
}

const ssl = process.env.DATABASE_SSL === 'true'
  ? { rejectUnauthorized: false }
  : false

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

pool.on('error', (error) => {
  console.error('Unexpected idle PostgreSQL client error', error)
})
