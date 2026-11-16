import { HttpError, asyncRoute } from './errors.js'

export function requireAuth(pool) {
  return asyncRoute(async (req, res, next) => {
    const userId = req.session?.userId
    if (!userId) throw new HttpError(401, 'Please sign in to continue.', 'AUTHENTICATION_REQUIRED')

    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.avatar_url, u.email_verified_at, u.created_at
       FROM users u WHERE u.id = ? AND u.is_active = 1 LIMIT 1`,
      [userId],
    )
    if (!rows.length) {
      req.session.destroy(() => {})
      throw new HttpError(401, 'Please sign in to continue.', 'AUTHENTICATION_REQUIRED')
    }

    req.user = rows[0]
    return next()
  })
}

export function requireRole(pool, role) {
  const authenticated = requireAuth(pool)
  return [
    authenticated,
    asyncRoute(async (req, res, next) => {
      const [rows] = await pool.execute(
        `SELECT 1 FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = ? AND r.name = ? LIMIT 1`,
        [req.user.id, role],
      )
      if (!rows.length) throw new HttpError(403, 'You do not have permission to access this resource.', 'FORBIDDEN')
      return next()
    }),
  ]
}

export function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url || null,
    emailVerified: Boolean(row.email_verified_at),
    createdAt: row.created_at,
  }
}
