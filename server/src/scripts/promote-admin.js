import { createPool } from '../db/pool.js'
import { loadConfig } from '../config/env.js'

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run promote-admin -- user@example.org')
  process.exit(1)
}

const pool = createPool(loadConfig().db)
const connection = await pool.getConnection()
try {
  await connection.beginTransaction()
  const [users] = await connection.execute('SELECT id FROM users WHERE email = ? FOR UPDATE', [email])
  if (!users.length) throw new Error('No account was found for that email.')
  await connection.execute(
    `INSERT IGNORE INTO user_roles (user_id, role_id)
     SELECT ?, id FROM roles WHERE name = 'admin'`,
    [users[0].id],
  )
  await connection.commit()
  console.log('Administrator role assigned.')
} catch (error) {
  await connection.rollback()
  console.error(`Administrator role was not changed: ${error.message}`)
  process.exitCode = 1
} finally {
  connection.release()
  await pool.end()
}
