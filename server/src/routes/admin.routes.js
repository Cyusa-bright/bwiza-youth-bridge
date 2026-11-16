import { Router } from 'express'
import { asyncRoute, HttpError } from '../middleware/errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validateId } from '../middleware/validate.js'

export function createAdminRouter({ pool }) {
  const router = Router()
  router.get('/access', requireAuth(pool), asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT 1 FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND r.name = 'admin' LIMIT 1`,
      [req.user.id],
    )
    res.json({ isAdmin: rows.length > 0 })
  }))
  router.use(...requireRole(pool, 'admin'))

  router.get('/users', asyncRoute(async (req, res) => {
    const page = Math.min(100000, Math.max(1, Number.parseInt(req.query.page, 10) || 1))
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25))
    const offset = (page - 1) * limit
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at,
              GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ',') AS roles
       FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    )
    res.json({ items: rows, page, limit })
  }))

  router.patch('/users/:id/role', asyncRoute(async (req, res) => {
    const userId = validateId(req.params.id)
    const { role } = req.body || {}
    if (!['member', 'admin'].includes(role)) throw new HttpError(400, 'Role must be member or admin.', 'VALIDATION_ERROR')
    if (String(req.user.id) === userId && role !== 'admin') {
      throw new HttpError(400, 'You cannot remove your own administrator role.', 'SELF_ROLE_CHANGE')
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [users] = await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId])
      if (!users.length) throw new HttpError(404, 'User not found.', 'NOT_FOUND')
      if (role === 'member') {
        await connection.execute(`SELECT id FROM roles WHERE name = 'admin' FOR UPDATE`)
        const [admins] = await connection.execute(
          `SELECT COUNT(*) AS count FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           JOIN users u ON u.id = ur.user_id
           WHERE r.name = 'admin' AND u.is_active = 1`,
        )
        const [current] = await connection.execute(
          `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
           JOIN users u ON u.id = ur.user_id
           WHERE ur.user_id = ? AND r.name = 'admin' AND u.is_active = 1 LIMIT 1`,
          [userId],
        )
        if (current.length && Number(admins[0].count) <= 1) {
          throw new HttpError(409, 'At least one administrator must remain.', 'LAST_ADMIN')
        }
      }
      await connection.execute(
        `INSERT IGNORE INTO user_roles (user_id, role_id)
         SELECT ?, id FROM roles WHERE name = ?`,
        [userId, role],
      )
      if (role === 'member') {
        await connection.execute(
          `DELETE ur FROM user_roles ur JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = ? AND r.name = 'admin'`,
          [userId],
        )
      }
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
    res.json({ id: userId, role })
  }))

  router.get('/contact-messages', asyncRoute(async (req, res) => {
    const page = Math.min(100000, Math.max(1, Number.parseInt(req.query.page, 10) || 1))
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25))
    const offset = (page - 1) * limit
    const [rows] = await pool.execute(
      `SELECT id, name, email, subject, message, status, created_at
       FROM contact_messages ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    )
    res.json({ items: rows, page, limit })
  }))
  return router
}
