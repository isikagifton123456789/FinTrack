import 'dotenv/config'
import app from './app.js'
import { pool } from './db.js'

const port = Number(process.env.PORT ?? 4000)
const server = app.listen(port, () => {
  console.log(`FinTrack API listening on port ${port}`)
})

async function shutdown(signal) {
  console.log(`${signal} received; closing API server.`)
  server.close(async (error) => {
    if (error) {
      console.error('Failed to close API server cleanly.', error)
      process.exitCode = 1
    }
    await pool.end()
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
