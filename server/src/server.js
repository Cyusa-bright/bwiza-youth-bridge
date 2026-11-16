import { createPool } from './db/pool.js'
import { ensureDefaultAdmin } from './db/seed-default-admin.js'
import { loadConfig } from './config/env.js'
import { createApp } from './app.js'

const config = loadConfig()
const pool = createPool(config.db)
await ensureDefaultAdmin(pool)
const app = createApp({ config, pool })

const server = app.listen(config.port, () => {
  console.log(`BYB API listening on port ${config.port}`)
})

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`)
  server.close(async () => {
    app.locals.sessionStore.close()
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
