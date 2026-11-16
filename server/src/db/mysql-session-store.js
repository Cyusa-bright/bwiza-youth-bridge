import session from 'express-session'

const defaultLifetime = 12 * 60 * 60 * 1000

export class MySQLSessionStore extends session.Store {
  constructor(pool) {
    super()
    this.pool = pool
    this.cleanupTimer = setInterval(() => {
      this.pool.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()').catch((error) => {
        console.error('Session cleanup failed:', error.message)
      })
    }, 60 * 60 * 1000)
    this.cleanupTimer.unref()
  }

  get(sessionId, callback) {
    this.pool.execute(
      'SELECT session_data FROM sessions WHERE session_id = ? AND expires_at > UTC_TIMESTAMP()',
      [sessionId],
    ).then(([rows]) => {
      try {
        callback(null, rows.length ? JSON.parse(rows[0].session_data) : null)
      } catch (error) {
        callback(error)
      }
    }).catch(callback)
  }

  set(sessionId, value, callback = () => {}) {
    const expiresAt = value.cookie?.expires
      ? new Date(value.cookie.expires)
      : new Date(Date.now() + defaultLifetime)
    this.pool.execute(
      `INSERT INTO sessions (session_id, expires_at, session_data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), session_data = VALUES(session_data)`,
      [sessionId, expiresAt, JSON.stringify(value)],
    ).then(() => callback()).catch(callback)
  }

  touch(sessionId, value, callback = () => {}) {
    const expiresAt = value.cookie?.expires
      ? new Date(value.cookie.expires)
      : new Date(Date.now() + defaultLifetime)
    this.pool.execute(
      'UPDATE sessions SET expires_at = ? WHERE session_id = ?',
      [expiresAt, sessionId],
    ).then(() => callback()).catch(callback)
  }

  destroy(sessionId, callback = () => {}) {
    this.pool.execute('DELETE FROM sessions WHERE session_id = ?', [sessionId])
      .then(() => callback()).catch(callback)
  }

  close() {
    clearInterval(this.cleanupTimer)
  }
}
