import bcrypt from 'bcrypt'

export const DEFAULT_ADMIN_EMAIL = 'bwizayouthbridge@gmail.com'
export const DEFAULT_ADMIN_PASSWORD = 'Bwizayouthbridge1'
export const DEFAULT_ADMIN_NAME = 'Bwiza Youth Bridge Admin'

async function ensureRoles(pool) {
  await pool.execute("INSERT IGNORE INTO roles (name) VALUES ('member'), ('admin')")
}

async function findRoleId(pool, roleName) {
  const [rows] = await pool.execute('SELECT id FROM roles WHERE name = ? LIMIT 1', [roleName])
  return rows[0]?.id ?? null
}

async function assignRole(pool, userId, roleName) {
  let roleId = await findRoleId(pool, roleName)
  if (!roleId) {
    await ensureRoles(pool)
    roleId = await findRoleId(pool, roleName)
  }
  if (!roleId) return
  await pool.execute(
    'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE assigned_at = assigned_at',
    [userId, roleId],
  )
}

export async function ensureDefaultAdmin(pool) {
  if (!pool || typeof pool.execute !== 'function') return

  try {
    await ensureRoles(pool)
    const [rows] = await pool.execute(
      'SELECT id, password_hash FROM users WHERE email = ? LIMIT 1',
      [DEFAULT_ADMIN_EMAIL],
    )
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12)

    if (rows.length) {
      await pool.execute(
        'UPDATE users SET name = ?, password_hash = ?, is_active = 1 WHERE id = ?',
        [DEFAULT_ADMIN_NAME, passwordHash, rows[0].id],
      )
      await assignRole(pool, rows[0].id, 'member')
      await assignRole(pool, rows[0].id, 'admin')
      return
    }

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, is_active) VALUES (?, ?, ?, 1)',
      [DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_EMAIL, passwordHash],
    )
    await assignRole(pool, result.insertId, 'member')
    await assignRole(pool, result.insertId, 'admin')
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message.includes('doesn\'t exist')) {
      return
    }
    throw error
  }
}
