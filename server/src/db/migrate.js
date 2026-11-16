import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPool } from './pool.js'
import { ensureDefaultAdmin } from './seed-default-admin.js'
import { loadConfig } from '../config/env.js'
import { isLegacySchema, migrateLegacySchema } from './legacy-schema.js'
import { migrateContentSchema } from './content-schema.js'

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../../database/migrations')
const pool = createPool(loadConfig().db)

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [appliedRows] = await pool.query('SELECT migration_name FROM schema_migrations')
  const applied = new Set(appliedRows.map((row) => row.migration_name))
  const files = (await readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql')).sort()
  const legacySchema = await isLegacySchema(pool)

  if (legacySchema && !applied.has('001_initial_schema.sql')) {
    await pool.execute('INSERT INTO schema_migrations (migration_name) VALUES (?)', ['001_initial_schema.sql'])
    applied.add('001_initial_schema.sql')
    console.log('Recorded the existing site schema as the initial baseline.')
  }

  if (legacySchema && !applied.has('002_legacy_compat.sql')) {
    await migrateLegacySchema(pool)
    await pool.execute('INSERT INTO schema_migrations (migration_name) VALUES (?)', ['002_legacy_compat.sql'])
    applied.add('002_legacy_compat.sql')
    console.log('Applied legacy site compatibility migration.')
  }

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(join(migrationsDirectory, file), 'utf8')
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean)

    for (const statement of statements) {
      await pool.query(statement)
    }

    if (file === '003_content_management.sql') {
      await migrateContentSchema(pool)
    }

    await pool.execute('INSERT INTO schema_migrations (migration_name) VALUES (?)', [file])
    console.log(`Applied migration: ${file}`)
  }

  await ensureDefaultAdmin(pool)
} catch (error) {
  console.error('Database migration failed:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
