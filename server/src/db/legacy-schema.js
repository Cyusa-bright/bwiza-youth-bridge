import bcrypt from 'bcrypt'

function quoteIdentifier(value) {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) throw new Error('Invalid database identifier.')
  return `\`${value}\``
}

async function getColumns(pool, table) {
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  )
  return new Map(rows.map((row) => [row.name, row]))
}

async function ensureColumn(pool, table, columns, name, definition) {
  if (columns.has(name)) return
  await pool.query(`ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${quoteIdentifier(name)} ${definition}`)
  columns.set(name, { name })
}

async function hasUniqueIndex(pool, table, column) {
  const [rows] = await pool.execute(
    `SELECT INDEX_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND NON_UNIQUE = 0`,
    [table, column],
  )
  return rows.length > 0
}

async function ensureUniqueIndex(pool, table, indexName, column) {
  if (await hasUniqueIndex(pool, table, column)) return
  const [[duplicates]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM (
       SELECT ${quoteIdentifier(column)}
       FROM ${quoteIdentifier(table)}
       GROUP BY ${quoteIdentifier(column)}
       HAVING COUNT(*) > 1
     ) duplicate_values`,
  )
  if (Number(duplicates.count)) {
    throw new Error(`Cannot add the ${indexName} index because duplicate ${column} values exist in ${table}.`)
  }
  await pool.query(
    `ALTER TABLE ${quoteIdentifier(table)} ADD UNIQUE INDEX ${quoteIdentifier(indexName)} (${quoteIdentifier(column)})`,
  )
}

function makeSlug(value, fallback) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 160)
  return slug || fallback
}

async function fillMissingSlugs(pool, table, prefix) {
  const [rows] = await pool.query(
    `SELECT id, title, slug FROM ${quoteIdentifier(table)} ORDER BY id`,
  )
  const used = new Set()
  for (const row of rows) {
    if (!row.slug) continue
    if (used.has(row.slug)) {
      throw new Error(`Duplicate slugs exist in ${table}; resolve them before applying the compatibility migration.`)
    }
    used.add(row.slug)
  }

  for (const row of rows) {
    if (row.slug) continue
    const suffix = `-${row.id}`
    let slug = makeSlug(row.title, `${prefix}-${row.id}`)
    if (used.has(slug)) slug = `${slug.slice(0, 160 - suffix.length)}${suffix}`
    while (used.has(slug)) slug = `${slug.slice(0, 160 - suffix.length)}${suffix}`
    await pool.execute(`UPDATE ${quoteIdentifier(table)} SET slug = ? WHERE id = ?`, [slug, row.id])
    used.add(slug)
  }
}

async function ensurePublishedContentColumns(pool, table, prefix) {
  let columns = await getColumns(pool, table)
  await ensureColumn(pool, table, columns, 'slug', 'VARCHAR(160) NULL')
  await ensureColumn(pool, table, columns, 'summary', 'TEXT NULL')
  await ensureColumn(pool, table, columns, 'status', "ENUM('draft','published','archived') NOT NULL DEFAULT 'published'")

  if (columns.has('description')) {
    await pool.query(
      `UPDATE ${quoteIdentifier(table)} SET summary = description WHERE summary IS NULL`,
    )
  }
  await fillMissingSlugs(pool, table, prefix)
  await ensureUniqueIndex(pool, table, `uq_${table}_slug`, 'slug')
}

async function migrateUsers(pool) {
  let columns = await getColumns(pool, 'users')
  const idColumn = columns.get('id')
  if (!idColumn || !/^int(?:\(\d+\))?(?: unsigned)?$/i.test(idColumn.type)) {
    throw new Error('The legacy users.id column is not a supported INT type.')
  }
  const userIdType = /unsigned/i.test(idColumn.type) ? 'INT UNSIGNED' : 'INT'

  await ensureColumn(pool, 'users', columns, 'name', 'VARCHAR(120) NULL')
  await ensureColumn(pool, 'users', columns, 'password_hash', 'VARCHAR(255) NULL')
  await ensureColumn(pool, 'users', columns, 'legacy_password', 'VARCHAR(255) NULL')
  await ensureColumn(pool, 'users', columns, 'avatar_url', 'VARCHAR(2048) NULL')
  await ensureColumn(pool, 'users', columns, 'email_verified_at', 'TIMESTAMP NULL DEFAULT NULL')
  await ensureColumn(pool, 'users', columns, 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1')

  if (columns.has('first_name') && columns.get('first_name').nullable === 'NO') {
    await pool.query('ALTER TABLE users MODIFY COLUMN first_name VARCHAR(255) NULL')
  }
  if (columns.has('password') && columns.get('password').nullable === 'NO') {
    await pool.query('ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL')
  }

  if (columns.has('first_name')) {
    const lastName = columns.has('last_name') ? "NULLIF(last_name, '')" : 'NULL'
    await pool.query(
      `UPDATE users
       SET name = LEFT(TRIM(CONCAT_WS(' ', NULLIF(first_name, ''), ${lastName})), 120)
       WHERE name IS NULL OR name = ''`,
    )
  }
  if (columns.has('status')) {
    await pool.query("UPDATE users SET is_active = CASE WHEN status = 'active' THEN 1 ELSE 0 END")
  }
  if (columns.has('password')) {
    await pool.query(
      `UPDATE users SET password_hash = password
       WHERE password_hash IS NULL AND LEFT(password, 4) IN ('$2a$', '$2b$', '$2y$')`,
    )
    const [legacyUsers] = await pool.query(
      `SELECT id, password FROM users
       WHERE password_hash IS NULL AND legacy_password IS NULL AND password IS NOT NULL AND password <> ''`,
    )
    for (const user of legacyUsers) {
      const passwordHash = await bcrypt.hash(user.password, 12)
      await pool.execute(
        'UPDATE users SET legacy_password = ?, password = NULL WHERE id = ?',
        [passwordHash, user.id],
      )
    }
    await pool.query('UPDATE users SET password = NULL WHERE password_hash IS NOT NULL OR password = \'\'')
  }
  await ensureUniqueIndex(pool, 'users', 'uq_users_email', 'email')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(40) NOT NULL,
      UNIQUE KEY uq_roles_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id ${userIdType} NOT NULL,
      role_id SMALLINT UNSIGNED NOT NULL,
      assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id),
      CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await pool.query("INSERT IGNORE INTO roles (name) VALUES ('member'), ('admin')")
  await pool.query(`
    INSERT IGNORE INTO user_roles (user_id, role_id)
    SELECT u.id, r.id FROM users u CROSS JOIN roles r
    WHERE r.name = 'member'
  `)

  const [adminColumns] = await pool.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins'`,
  )
  const hasAdminsTable = adminColumns.length > 0
  const hasAdminRole = adminColumns.some((column) => column.name === 'role')
  if (hasAdminsTable) {
    await pool.query(`
      INSERT IGNORE INTO user_roles (user_id, role_id)
      SELECT u.id, r.id
      FROM users u
      JOIN admins a ON LOWER(a.email) = LOWER(u.email)
      CROSS JOIN roles r
      WHERE r.name = 'admin' ${hasAdminRole ? "AND a.role IN ('admin', 'super_admin')" : ''}
    `)
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id ${userIdType} NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_password_reset_user (user_id),
      KEY idx_password_reset_expiration (expires_at),
      CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

async function migrateApplications(pool) {
  const columns = await getColumns(pool, 'applications')
  const userIdType = await getColumns(pool, 'users')
  const idType = userIdType.get('id').type
  const appIdType = /^int(?:\(\d+\))?(?: unsigned)?$/i.test(idType)
    ? (/unsigned/i.test(idType) ? 'INT UNSIGNED' : 'INT')
    : null
  if (!appIdType) throw new Error('The legacy users.id column cannot be used for applications.')

  await ensureColumn(pool, 'applications', columns, 'user_id', `${appIdType} NULL`)
  await ensureColumn(pool, 'applications', columns, 'event_id', 'INT NULL')
  if (columns.has('first_name') && columns.get('first_name').nullable === 'NO') {
    await pool.query('ALTER TABLE applications MODIFY COLUMN first_name VARCHAR(100) NULL')
  }
  if (columns.has('email') && columns.get('email').nullable === 'NO') {
    await pool.query('ALTER TABLE applications MODIFY COLUMN email VARCHAR(255) NULL')
  }
  const status = columns.get('status')
  if (status && status.type.toLowerCase().startsWith('enum') &&
      !['submitted', 'reviewing', 'withdrawn'].every((value) => status.type.includes(value))) {
    await pool.query(
      `ALTER TABLE applications
       MODIFY COLUMN status ENUM('pending','accepted','rejected','submitted','reviewing','withdrawn')
       NULL DEFAULT 'submitted'`,
    )
  }
}

async function migrateContactMessages(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      subject VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      status ENUM('new', 'reviewing', 'resolved', 'archived') NOT NULL DEFAULT 'new',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_contact_messages_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const messageColumns = await getColumns(pool, 'messages')
  if (['id', 'name', 'email', 'message', 'created_at', 'updated_at'].every((name) => messageColumns.has(name))) {
    await pool.query(`
      INSERT IGNORE INTO contact_messages
        (id, name, email, subject, message, status, created_at, updated_at)
      SELECT id, name, email, 'Existing website message', message, 'new', created_at, updated_at
      FROM messages
    `)
  }
}

export async function isLegacySchema(pool) {
  const columns = await getColumns(pool, 'users')
  return columns.has('first_name')
}

export async function migrateLegacySchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id VARCHAR(128) NOT NULL PRIMARY KEY,
      expires_at DATETIME NOT NULL,
      session_data MEDIUMTEXT NOT NULL,
      KEY idx_sessions_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await migrateUsers(pool)
  await ensurePublishedContentColumns(pool, 'programs', 'program')
  const eventColumns = await getColumns(pool, 'events')
  await ensureColumn(pool, 'events', eventColumns, 'starts_at', 'DATETIME NULL')
  await ensurePublishedContentColumns(pool, 'events', 'event')
  if (eventColumns.has('date')) {
    await pool.query('UPDATE events SET starts_at = `date` WHERE starts_at IS NULL')
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(160) NOT NULL,
      title VARCHAR(200) NOT NULL,
      summary TEXT NOT NULL,
      status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_projects_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await migrateApplications(pool)
  await migrateContactMessages(pool)
}
