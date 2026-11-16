import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { Router } from 'express'
import { asyncRoute, HttpError } from '../middleware/errors.js'
import { requireAuth, publicUser } from '../middleware/auth.js'
import {
  normalizeEmail, validateLogin, validateNewPassword, validateProfileName, validateRegistration,
} from '../middleware/validate.js'
import { createCsrfToken, issueCsrfToken } from '../middleware/csrf.js'

const passwordCost = 12
const regularSessionMs = 12 * 60 * 60 * 1000
const rememberedSessionMs = 14 * 24 * 60 * 60 * 1000
const resetLifetimeMinutes = 30
const dummyPasswordHash = bcrypt.hash(randomBytes(32).toString('hex'), passwordCost)

function regenerateSession(req, userId, rememberMe) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error)
      req.session.userId = userId
      req.session.csrfToken = createCsrfToken()
      req.session.cookie.maxAge = rememberMe ? rememberedSessionMs : regularSessionMs
      req.session.save((saveError) => saveError ? reject(saveError) : resolve(req.session.csrfToken))
    })
  })
}

async function findUser(pool, id) {
  const [rows] = await pool.execute(
    `SELECT id, name, email, avatar_url, email_verified_at, created_at
     FROM users WHERE id = ? AND is_active = 1 LIMIT 1`,
    [id],
  )
  return rows[0] || null
}

async function invalidateUserSessions(pool, userId) {
  await pool.execute(
    `DELETE FROM sessions
     WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(session_data, '$.userId')) AS UNSIGNED) = ?`,
    [userId],
  )
}

async function upgradeLegacyPassword(pool, userId, password, passwordHash) {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password'`,
  )
  if (columns.length) {
    await pool.execute(
      'UPDATE users SET password_hash = ?, legacy_password = NULL, password = ? WHERE id = ?',
      [passwordHash, passwordHash, userId],
    )
    return
  }
  await pool.execute(
    'UPDATE users SET password_hash = ?, legacy_password = NULL WHERE id = ?',
    [passwordHash, userId],
  )
}

export function createAuthRouter({ pool, mailer, frontendBaseUrl, authLimiter, recoveryLimiter }) {
  const router = Router()
  const authenticated = requireAuth(pool)

  router.get('/csrf', issueCsrfToken)

  router.post('/register', authLimiter, asyncRoute(async (req, res) => {
    const { name, email, password } = validateRegistration(req.body)
    const passwordHash = await bcrypt.hash(password, passwordCost)
    const connection = await pool.getConnection()
    let userId

    try {
      await connection.beginTransaction()
      const [result] = await connection.execute(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [name, email, passwordHash],
      )
      userId = result.insertId
      await connection.execute(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT ?, id FROM roles WHERE name = 'member'`,
        [userId],
      )
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

    const csrfToken = await regenerateSession(req, userId, false)
    const user = await findUser(pool, userId)
    res.status(201).json({ user: publicUser(user), csrfToken })
  }))

  router.post('/login', authLimiter, asyncRoute(async (req, res) => {
    const { email, password, rememberMe } = validateLogin(req.body)
    const [rows] = await pool.execute(
      `SELECT id, password_hash, legacy_password
       FROM users WHERE email = ? AND is_active = 1 LIMIT 1`,
      [email],
    )
    let validPassword = await bcrypt.compare(password, rows[0]?.password_hash || await dummyPasswordHash)
    const legacyPasswordHash = rows[0]?.legacy_password
    const usedLegacyPassword = !validPassword && typeof legacyPasswordHash === 'string'
      ? await bcrypt.compare(password, legacyPasswordHash)
      : false
    validPassword ||= usedLegacyPassword
    if (!rows.length || !validPassword) {
      throw new HttpError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS')
    }

    if (usedLegacyPassword) {
      const passwordHash = await bcrypt.hash(password, passwordCost)
      await upgradeLegacyPassword(pool, rows[0].id, password, passwordHash)
    }
    const csrfToken = await regenerateSession(req, rows[0].id, rememberMe)
    const user = await findUser(pool, rows[0].id)
    res.json({ user: publicUser(user), csrfToken })
  }))

  router.post('/logout', authenticated, asyncRoute(async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()))
    res.clearCookie('byb.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
    res.status(204).end()
  }))

  router.get('/me', authenticated, (req, res) => res.json({ user: publicUser(req.user) }))

  router.patch('/profile', authenticated, asyncRoute(async (req, res) => {
    const name = validateProfileName(req.body)
    await pool.execute('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id])
    const user = await findUser(pool, req.user.id)
    res.json({ user: publicUser(user) })
  }))

  router.post('/change-password', authenticated, asyncRoute(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {}
    validateNewPassword(newPassword)
    if (typeof currentPassword !== 'string' || !currentPassword) {
      throw new HttpError(400, 'Enter your current password.', 'VALIDATION_ERROR')
    }

    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id])
    if (!await bcrypt.compare(currentPassword, rows[0].password_hash)) {
      throw new HttpError(400, 'Current password is incorrect.', 'CURRENT_PASSWORD_INVALID')
    }
    const hash = await bcrypt.hash(newPassword, passwordCost)
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id])
    await invalidateUserSessions(pool, req.user.id)
    const csrfToken = await regenerateSession(req, req.user.id, false)
    res.json({ message: 'Password updated.', csrfToken })
  }))

  router.post('/forgot-password', recoveryLimiter, asyncRoute(async (req, res) => {
    if (!mailer) throw new HttpError(503, 'Password recovery is not configured.', 'RECOVERY_UNAVAILABLE')
    const email = normalizeEmail(req.body?.email)
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'Enter a valid email address.', 'VALIDATION_ERROR')
    }

    const [rows] = await pool.execute('SELECT id, email FROM users WHERE email = ? AND is_active = 1 LIMIT 1', [email])
    if (rows.length) {
      const token = randomBytes(32).toString('base64url')
      const tokenHash = createHash('sha256').update(token).digest('hex')
      const expiresAt = new Date(Date.now() + resetLifetimeMinutes * 60 * 1000)
      await pool.execute('DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL', [rows[0].id])
      await pool.execute(
        `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
         VALUES (?, ?, ?)`,
        [tokenHash, rows[0].id, expiresAt],
      )
      try {
        await mailer.sendPasswordReset(rows[0].email, token, frontendBaseUrl)
      } catch (error) {
        console.error('Password reset email delivery failed:', error.code || 'MAIL_DELIVERY_FAILED')
      }
    }
    res.status(202).json({ message: 'If an account matches that email, password reset instructions will be sent.' })
  }))

  router.post('/reset-password', recoveryLimiter, asyncRoute(async (req, res) => {
    const { token, newPassword } = req.body || {}
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) {
      throw new HttpError(400, 'This password reset link is invalid or expired.', 'RESET_TOKEN_INVALID')
    }
    validateNewPassword(newPassword)
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const passwordHash = await bcrypt.hash(newPassword, passwordCost)
    const connection = await pool.getConnection()
    let userId
    try {
      await connection.beginTransaction()
      const [rows] = await connection.execute(
        `SELECT user_id FROM password_reset_tokens
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
         LIMIT 1 FOR UPDATE`,
        [tokenHash],
      )
      if (!rows.length) throw new HttpError(400, 'This password reset link is invalid or expired.', 'RESET_TOKEN_INVALID')
      userId = rows[0].user_id
      await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId])
      await connection.execute('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE token_hash = ?', [tokenHash])
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
    await invalidateUserSessions(pool, userId)
    res.json({ message: 'Password reset successfully. Please sign in.' })
  }))

  return router
}
