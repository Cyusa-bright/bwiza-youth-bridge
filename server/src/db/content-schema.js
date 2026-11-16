async function getColumns(pool, table) {
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME AS name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  )
  return new Set(rows.map((row) => row.name))
}

async function ensureColumn(pool, table, columns, name, definition) {
  if (columns.has(name)) return
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`)
  columns.add(name)
}

async function ensureImageCapacity(pool, table) {
  const [rows] = await pool.execute(
    `SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'image'`,
    [table],
  )
  const type = rows[0]?.type || ''
  const size = Number(type.match(/\((\d+)\)/)?.[1] || 0)
  if (size > 0 && size < 2048) {
    await pool.query(`ALTER TABLE \`${table}\` MODIFY COLUMN image VARCHAR(2048) NULL`)
  }
}

export async function migrateContentSchema(pool) {
  for (const table of ['programs', 'projects', 'events']) {
    const columns = await getColumns(pool, table)
    await ensureColumn(pool, table, columns, 'category', 'VARCHAR(100) NULL')
    await ensureColumn(pool, table, columns, 'image', 'VARCHAR(2048) NULL')
    await ensureColumn(pool, table, columns, 'details', 'TEXT NULL')
    await ensureImageCapacity(pool, table)
    if (columns.has('description') && columns.has('summary')) {
      await pool.query(
        `UPDATE \`${table}\` SET summary = description
         WHERE (summary IS NULL OR summary = '') AND description IS NOT NULL AND description <> ''`,
      )
    }
    if (table === 'events') {
      await ensureColumn(pool, table, columns, 'ends_at', 'DATETIME NULL')
      await ensureColumn(pool, table, columns, 'date', 'DATETIME NULL')
      if (columns.has('starts_at')) {
        await pool.query('UPDATE events SET starts_at = `date` WHERE starts_at IS NULL AND `date` IS NOT NULL')
        await pool.query('UPDATE events SET `date` = starts_at WHERE `date` IS NULL AND starts_at IS NOT NULL')
      }
    }
  }

  const teamColumns = await getColumns(pool, 'team')
  await ensureImageCapacity(pool, 'team')
  await ensureColumn(pool, 'team', teamColumns, 'bio', 'TEXT NULL')
  await ensureColumn(pool, 'team', teamColumns, 'slug', 'VARCHAR(160) NULL')
  await ensureColumn(pool, 'team', teamColumns, 'status', "ENUM('draft','published','archived') NOT NULL DEFAULT 'published'")
  await ensureColumn(pool, 'team', teamColumns, 'sort_order', 'INT NOT NULL DEFAULT 0')

  const [eventStatus] = await pool.execute(
    `SELECT COLUMN_TYPE AS type
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'status'`,
  )
  if (eventStatus[0]?.type.startsWith('enum') && !eventStatus[0].type.includes("'cancelled'")) {
    await pool.query(
      "ALTER TABLE events MODIFY COLUMN status ENUM('draft','published','cancelled','archived') NOT NULL DEFAULT 'draft'",
    )
  }
}
