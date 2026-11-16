import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import bcrypt from 'bcrypt'
import session from 'express-session'
import { createApp } from '../src/app.js'

class MemorySessionStore extends session.Store {
  constructor() {
    super()
    this.sessions = new Map()
  }

  get(sessionId, callback) {
    const stored = this.sessions.get(sessionId)
    callback(null, stored ? JSON.parse(JSON.stringify(stored)) : null)
  }

  set(sessionId, value, callback = () => {}) {
    this.sessions.set(sessionId, JSON.parse(JSON.stringify(value)))
    callback()
  }

  touch(sessionId, value, callback = () => {}) {
    this.set(sessionId, value, callback)
  }

  destroy(sessionId, callback = () => {}) {
    this.sessions.delete(sessionId)
    callback()
  }
}

function createConfig() {
  return {
    nodeEnv: 'test',
    sessionSecret: 'test-session-secret-that-is-long-enough',
    frontendOrigin: 'http://localhost:5173',
    frontendBaseUrl: 'http://localhost:5173',
    mail: {},
  }
}

async function startServer(app) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    }),
  }
}

function cookieFrom(response) {
  const setCookie = response.headers.get('set-cookie')
  assert.ok(setCookie, 'response should set the session cookie')
  return setCookie.split(';', 1)[0]
}

test('CORS permits DELETE requests from the configured frontend origin', async (t) => {
  const app = createApp({
    config: createConfig(),
    pool: {},
    sessionStore: new MemorySessionStore(),
  })
  const server = await startServer(app)
  t.after(server.close)

  const response = await fetch(`${server.baseUrl}/api/v1/admin/programs/1`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'DELETE',
      'Access-Control-Request-Headers': 'content-type,x-csrf-token',
    },
  })
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  assert.match(response.headers.get('access-control-allow-methods') || '', /\bDELETE\b/)
})

function createUserPool(user) {
  return {
    async query(query) {
      if (query.includes('information_schema.COLUMNS')) {
        return [[{ name: 'password' }]]
      }
      return [[{ ready: 1 }]]
    },
    async execute(query, parameters) {
      if (query.includes('SELECT id, password_hash, legacy_password')) {
        return [[user && user.email === parameters[0] && user.is_active ? {
          id: user.id,
          password_hash: user.password_hash,
          legacy_password: user.legacy_password,
        } : null].filter(Boolean)]
      }
      if (query.includes('UPDATE users SET password_hash = ?, legacy_password = NULL, password = ?')) {
        user.password_hash = parameters[0]
        user.legacy_password = null
        user.password = parameters[1]
        return [{ affectedRows: 1 }]
      }
      if (query.includes('FROM users u WHERE u.id = ?')) {
        return [[user && user.id === parameters[0] && user.is_active ? user : null].filter(Boolean)]
      }
      if (query.includes('FROM users WHERE id = ? AND is_active = 1')) {
        return [[user && user.id === parameters[0] && user.is_active ? user : null].filter(Boolean)]
      }
      throw new Error(`Unexpected database query in API integration test: ${query}`)
    },
  }
}

test('authentication routes establish and enforce a server-side session', async (t) => {
  const password = 'a secure password for integration tests'
  const user = {
    id: 'user-123',
    name: 'Test Member',
    email: 'member@example.org',
    password_hash: await bcrypt.hash(password, 4),
    avatar_url: null,
    email_verified_at: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    is_active: 1,
  }
  const app = createApp({
    config: createConfig(),
    pool: createUserPool(user),
    sessionStore: new MemorySessionStore(),
  })
  const server = await startServer(app)
  t.after(server.close)

  const csrfResponse = await fetch(`${server.baseUrl}/api/v1/auth/csrf`)
  assert.equal(csrfResponse.status, 200)
  const csrfCookie = cookieFrom(csrfResponse)
  const { csrfToken } = await csrfResponse.json()
  assert.equal(typeof csrfToken, 'string')

  const unauthenticated = await fetch(`${server.baseUrl}/api/v1/auth/me`, {
    headers: { Cookie: csrfCookie },
  })
  assert.equal(unauthenticated.status, 401)

  const blockedLogout = await fetch(`${server.baseUrl}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { Cookie: csrfCookie },
  })
  assert.equal(blockedLogout.status, 403)

  const loginResponse = await fetch(`${server.baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      Cookie: csrfCookie,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ email: user.email, password }),
  })
  assert.equal(loginResponse.status, 200)
  const loginCookie = cookieFrom(loginResponse)
  assert.notEqual(loginCookie, csrfCookie, 'login should rotate the session identifier')
  const loginBody = await loginResponse.json()
  assert.equal(loginBody.user.id, user.id)
  assert.equal(Object.hasOwn(loginBody.user, 'password_hash'), false)

  const authenticated = await fetch(`${server.baseUrl}/api/v1/auth/me`, {
    headers: { Cookie: loginCookie },
  })
  assert.equal(authenticated.status, 200)
  assert.equal((await authenticated.json()).user.email, user.email)

  const logoutResponse = await fetch(`${server.baseUrl}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      Cookie: loginCookie,
      'X-CSRF-Token': loginBody.csrfToken,
    },
  })
  assert.equal(logoutResponse.status, 204)

  const loggedOut = await fetch(`${server.baseUrl}/api/v1/auth/me`, {
    headers: { Cookie: loginCookie },
  })
  assert.equal(loggedOut.status, 401)
})

test('legacy password hashes are promoted after a successful login', async (t) => {
  const password = 'legacy-password-16'
  const user = {
    id: 'legacy-user-123',
    name: 'Legacy Member',
    email: 'legacy@example.org',
    password_hash: null,
    legacy_password: await bcrypt.hash(password, 4),
    password: null,
    avatar_url: null,
    email_verified_at: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    is_active: 1,
  }
  const app = createApp({
    config: createConfig(),
    pool: createUserPool(user),
    sessionStore: new MemorySessionStore(),
  })
  const server = await startServer(app)
  t.after(server.close)

  const csrfResponse = await fetch(`${server.baseUrl}/api/v1/auth/csrf`)
  const csrfCookie = cookieFrom(csrfResponse)
  const { csrfToken } = await csrfResponse.json()
  const loginResponse = await fetch(`${server.baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      Cookie: csrfCookie,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ email: user.email, password }),
  })

  assert.equal(loginResponse.status, 200)
  assert.match(user.password_hash, /^\$2[aby]\$/)
  assert.equal(await bcrypt.compare(password, user.password_hash), true)
  assert.equal(user.legacy_password, null)
  assert.equal(user.password, user.password_hash)
})

test('API health, input validation, and not-found responses work over HTTP', async (t) => {
  const app = createApp({
    config: createConfig(),
    pool: createUserPool(null),
    sessionStore: new MemorySessionStore(),
  })
  const server = await startServer(app)
  t.after(server.close)

  const health = await fetch(`${server.baseUrl}/api/v1/health`)
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { status: 'ok' })

  const csrfResponse = await fetch(`${server.baseUrl}/api/v1/auth/csrf`)
  const cookie = cookieFrom(csrfResponse)
  const { csrfToken } = await csrfResponse.json()
  const invalidContact = await fetch(`${server.baseUrl}/api/v1/contact-messages`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ name: '', email: 'not-an-email', subject: '', message: '' }),
  })
  assert.equal(invalidContact.status, 400)
  assert.equal((await invalidContact.json()).error.code, 'VALIDATION_ERROR')

  const missingRoute = await fetch(`${server.baseUrl}/api/v1/not-a-route`)
  assert.equal(missingRoute.status, 404)
  assert.equal((await missingRoute.json()).error.code, 'NOT_FOUND')
})

test('database health check reports unavailable dependencies without leaking details', async (t) => {
  const pool = {
    async query() {
      throw Object.assign(new Error('private connection details'), { code: 'ECONNREFUSED' })
    },
    async execute() {
      return [[]]
    },
  }
  const app = createApp({
    config: createConfig(),
    pool,
    sessionStore: new MemorySessionStore(),
  })
  const server = await startServer(app)
  t.after(server.close)

  const response = await fetch(`${server.baseUrl}/api/v1/health`)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    status: 'error',
    error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is unavailable.' },
  })
})

test('database schema errors are not exposed in API responses', async (t) => {
  const pool = {
    async query() {
      return [[{ ready: 1 }]]
    },
    async execute() {
      throw Object.assign(new Error("Table 'byb.sessions' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' })
    },
  }
  const app = createApp({
    config: createConfig(),
    pool,
    sessionStore: new MemorySessionStore(),
  })
  const server = await startServer(app)
  t.after(server.close)

  const csrfResponse = await fetch(`${server.baseUrl}/api/v1/auth/csrf`)
  const cookie = cookieFrom(csrfResponse)
  const { csrfToken } = await csrfResponse.json()
  const response = await fetch(`${server.baseUrl}/api/v1/contact-messages`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({
      name: 'Test Member',
      email: 'member@example.org',
      subject: 'A valid topic',
      message: 'This is a valid test contact message.',
    }),
  })

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), {
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  })
})

test('database authentication failures return a service-unavailable response', async (t) => {
  const pool = {
    async query() {
      return [[{ ready: 1 }]]
    },
    async execute() {
      throw Object.assign(new Error('Sensitive connection failure detail'), { code: 'ER_ACCESS_DENIED_ERROR' })
    },
  }
  const app = createApp({
    config: createConfig(),
    pool,
    sessionStore: new MemorySessionStore(),
  })
  const server = await startServer(app)
  t.after(server.close)

  const csrfResponse = await fetch(`${server.baseUrl}/api/v1/auth/csrf`)
  const cookie = cookieFrom(csrfResponse)
  const { csrfToken } = await csrfResponse.json()
  const response = await fetch(`${server.baseUrl}/api/v1/contact-messages`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({
      name: 'Test Member',
      email: 'member@example.org',
      subject: 'A valid topic',
      message: 'This is a valid test contact message.',
    }),
  })

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is temporarily unavailable.' },
  })
})
