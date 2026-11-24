import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { pool } from '../src/db.js'

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url))
const client = await pool.connect()

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort()
  for (const name of files) {
    const existing = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name])
    if (existing.rowCount) continue
    const sql = await readFile(path.join(migrationsDirectory, name), 'utf8')
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
      await client.query('COMMIT')
      console.log(`Applied migration ${name}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }
} finally {
  client.release()
  await pool.end()
}
