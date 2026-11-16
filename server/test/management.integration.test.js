import assert from 'node:assert/strict'
import { once } from 'node:events'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import bcrypt from 'bcrypt'
import sharp from 'sharp'
import session from 'express-session'
import { createApp } from '../src/app.js'
import { uploadDirectory } from '../src/routes/management.routes.js'

class MemorySessionStore extends session.Store {
  constructor() {
    super()
    this.sessions = new Map()
  }

  get(id, callback) {
    const stored = this.sessions.get(id)
    callback(null, stored ? JSON.parse(JSON.stringify(stored)) : null)
  }

  set(id, value, callback = () => {}) {
    this.sessions.set(id, JSON.parse(JSON.stringify(value)))
    callback()
  }

  touch(id, value, callback) {
    this.set(id, value, callback)
  }

  destroy(id, callback = () => {}) {
    this.sessions.delete(id)
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
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    }),
  }
}

function makeManagementPool(user) {
  const tables = {
    programs: [],
    projects: [],
    events: [],
    team: [],
    website_content: [],
  }
  const counters = Object.fromEntries(Object.keys(tables).map((table) => [table, 0]))

  function select(statement, parameters = []) {
    const table = statement.match(/\bFROM\s+([a-z_]+)/i)?.[1]
    if (statement.includes('FROM users u')) return user && String(parameters[0]) === String(user.id) ? [{ ...user }] : []
    if (statement.includes('FROM users WHERE id')) return user && String(parameters[0]) === String(user.id) ? [{ ...user }] : []
    if (statement.includes('FROM user_roles')) return [{ allowed: 1 }]
    if (statement.includes('information_schema')) return []
    if (table) {
      const rows = tables[table] || []
      if (/WHERE id = \?/i.test(statement)) return rows.filter((row) => String(row.id) === String(parameters[0]))
      if (/WHERE content_key = \?/i.test(statement)) return rows.filter((row) => row.content_key === parameters[0])
      if (/WHERE status = 'published'/i.test(statement)) return rows.filter((row) => row.status === 'published')
      return [...rows]
    }
    return [{ ready: 1 }]
  }

  return {
    tables,
    async query(statement, parameters = []) {
      return [select(statement, parameters)]
    },
    async execute(statement, parameters = []) {
      if (statement.includes('SELECT id, password_hash, legacy_password')) {
        return [[user && parameters[0] === user.email ? {
          id: user.id, password_hash: user.password_hash, legacy_password: null,
        } : null].filter(Boolean)]
      }
      if (statement.startsWith('SELECT 1 FROM user_roles')) return [[{ allowed: 1 }]]
      if (statement.startsWith('SELECT') && statement.includes('FROM users')) {
        return [select(statement, parameters)]
      }
      if (statement.startsWith('SELECT')) return [select(statement, parameters)]
      if (statement.startsWith('INSERT INTO')) {
        const table = statement.match(/INSERT INTO ([a-z_]+)/i)?.[1]
        const columns = statement.match(/\(([^)]+)\)/)?.[1].split(',').map((column) => column.trim())
        const row = Object.fromEntries(columns.map((column, index) => [column, parameters[index]]))
        row.id = ++counters[table]
        row.created_at = new Date()
        row.updated_at = new Date()
        tables[table].push(row)
        return [{ insertId: row.id, affectedRows: 1 }]
      }
      if (statement.startsWith('UPDATE website_content')) {
        const row = tables.website_content.find((item) => item.content_key === parameters[1])
        if (!row) return [{ affectedRows: 0 }]
        row.content_value = parameters[0]
        row.updated_at = new Date()
        return [{ affectedRows: 1 }]
      }
      if (statement.startsWith('UPDATE')) {
        const table = statement.match(/UPDATE ([a-z_]+)/i)?.[1]
        const columns = statement.match(/SET (.+) WHERE id = \?/i)?.[1]
          .split(',').map((assignment) => assignment.split('=')[0].trim())
        const id = parameters[parameters.length - 1]
        const row = tables[table].find((item) => String(item.id) === String(id))
        if (!row) return [{ affectedRows: 0 }]
        columns.forEach((column, index) => { row[column] = parameters[index] })
        row.updated_at = new Date()
        return [{ affectedRows: 1 }]
      }
      if (statement.startsWith('DELETE FROM website_content')) {
        const index = tables.website_content.findIndex((row) => row.content_key === parameters[0])
        if (index < 0) return [{ affectedRows: 0 }]
        tables.website_content.splice(index, 1)
        return [{ affectedRows: 1 }]
      }
      if (statement.startsWith('DELETE FROM')) {
        const table = statement.match(/DELETE FROM ([a-z_]+)/i)?.[1]
        const index = tables[table].findIndex((row) => String(row.id) === String(parameters[0]))
        if (index < 0) return [{ affectedRows: 0 }]
        tables[table].splice(index, 1)
        return [{ affectedRows: 1 }]
      }
      throw new Error(`Unexpected management test SQL: ${statement}`)
    },
  }
}

function cookieFrom(response) {
  const cookie = response.headers.get('set-cookie')
  assert.ok(cookie, 'response should set a session cookie')
  return cookie.split(';', 1)[0]
}

async function createAdminSession(server, email, password) {
  const csrfResponse = await fetch(`${server.baseUrl}/api/v1/auth/csrf`)
  const cookie = cookieFrom(csrfResponse)
  const { csrfToken } = await csrfResponse.json()
  const login = await fetch(`${server.baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ email, password }),
  })
  assert.equal(login.status, 200)
  const body = await login.json()
  return { cookie: cookieFrom(login), csrfToken: body.csrfToken }
}

test('admin CRUD APIs manage programs, projects, events, and team members', async (t) => {
  const password = 'secure management test password'
  const user = {
    id: 'admin-user-12',
    name: 'Test Admin',
    email: 'admin@example.org',
    password_hash: await bcrypt.hash(password, 4),
    legacy_password: null,
    avatar_url: null,
    email_verified_at: null,
    created_at: new Date(),
    is_active: 1,
  }
  const pool = makeManagementPool(user)
  const server = await startServer(createApp({
    config: createConfig(),
    pool,
    sessionStore: new MemorySessionStore(),
  }))
  t.after(server.close)
  const auth = await createAdminSession(server, user.email, password)

  const records = [
    ['programs', { title: 'Test Program', category: 'Learning', summary: 'A test program description.', points: ['Mentorship'], status: 'published' }],
    ['projects', { title: 'Test Project', category: 'Community', summary: 'A test project description.', status: 'published' }],
    ['events', { title: 'Test Event', category: 'Learning', summary: 'A test event description.', starts_at: '2026-12-01T10:00:00Z', location: 'Kigali', status: 'published' }],
    ['team', { name: 'Test Team Member', role: 'Coordinator', bio: 'A test biography.', status: 'published' }],
  ]

  for (const [resource, payload] of records) {
    const createdResponse = await fetch(`${server.baseUrl}/api/v1/admin/${resource}`, {
      method: 'POST',
      headers: { Cookie: auth.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': auth.csrfToken },
      body: JSON.stringify(payload),
    })
    assert.equal(createdResponse.status, 201, `${resource} create`)
    const created = (await createdResponse.json()).item
    assert.ok(created.id)
    assert.ok(created.slug)

    const listResponse = await fetch(`${server.baseUrl}/api/v1/${resource}`)
    assert.equal(listResponse.status, 200, `${resource} public list`)
    assert.ok((await listResponse.json()).items.some((item) => item.id === created.id), `${resource} should be publicly readable`)

    const readResponse = await fetch(`${server.baseUrl}/api/v1/admin/${resource}/${created.id}`, {
      headers: { Cookie: auth.cookie },
    })
    assert.equal(readResponse.status, 200, `${resource} admin read`)

    const updateResponse = await fetch(`${server.baseUrl}/api/v1/admin/${resource}/${created.id}`, {
      method: 'PATCH',
      headers: { Cookie: auth.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': auth.csrfToken },
      body: JSON.stringify(resource === 'team' ? { bio: 'Updated test biography.' } : { summary: 'Updated test description.' }),
    })
    assert.equal(updateResponse.status, 200, `${resource} update`)
    const updated = (await updateResponse.json()).item
    assert.equal(resource === 'team' ? updated.bio : updated.summary, resource === 'team' ? 'Updated test biography.' : 'Updated test description.')

    const deleteResponse = await fetch(`${server.baseUrl}/api/v1/admin/${resource}/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrfToken },
    })
    assert.equal(deleteResponse.status, 204, `${resource} delete`)
  }

  const invalid = await fetch(`${server.baseUrl}/api/v1/admin/programs`, {
    method: 'POST',
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': auth.csrfToken },
    body: JSON.stringify({ title: 'X', summary: '', image: 'javascript:alert(1)' }),
  })
  assert.equal(invalid.status, 400)

  const credentialUrl = await fetch(`${server.baseUrl}/api/v1/admin/programs`, {
    method: 'POST',
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': auth.csrfToken },
    body: JSON.stringify({
      title: 'Credential URL test',
      summary: 'A valid description for image URL validation.',
      image: 'https://user:password@example.org/image.jpg',
    }),
  })
  assert.equal(credentialUrl.status, 400)
})

test('website content supports admin CRUD and public reads', async (t) => {
  const password = 'secure website content test password'
  const user = {
    id: 'content-admin',
    name: 'Content Admin',
    email: 'content-admin@example.org',
    password_hash: await bcrypt.hash(password, 4),
    legacy_password: null,
    avatar_url: null,
    email_verified_at: null,
    created_at: new Date(),
    is_active: 1,
  }
  const pool = makeManagementPool(user)
  const server = await startServer(createApp({
    config: createConfig(),
    pool,
    sessionStore: new MemorySessionStore(),
  }))
  t.after(server.close)
  const auth = await createAdminSession(server, user.email, password)
  const create = await fetch(`${server.baseUrl}/api/v1/admin/site-content`, {
    method: 'POST',
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': auth.csrfToken },
    body: JSON.stringify({ key: 'home', value: { heroTitle: 'Editable homepage title' } }),
  })
  assert.equal(create.status, 201)
  const publicRead = await fetch(`${server.baseUrl}/api/v1/site-content`)
  assert.deepEqual((await publicRead.json()).items[0].value, { heroTitle: 'Editable homepage title' })

  const update = await fetch(`${server.baseUrl}/api/v1/admin/site-content/home`, {
    method: 'PATCH',
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': auth.csrfToken },
    body: JSON.stringify({ value: { heroTitle: 'Updated homepage title' } }),
  })
  assert.equal(update.status, 200)
  const read = await fetch(`${server.baseUrl}/api/v1/admin/site-content/home`, { headers: { Cookie: auth.cookie } })
  assert.equal((await read.json()).item.value.heroTitle, 'Updated homepage title')

  const remove = await fetch(`${server.baseUrl}/api/v1/admin/site-content/home`, {
    method: 'DELETE',
    headers: { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrfToken },
  })
  assert.equal(remove.status, 204)
})

test('image uploads validate content and size, then serve stored images safely', async (t) => {
  const password = 'secure image upload test password'
  const user = {
    id: 'image-admin',
    name: 'Image Admin',
    email: 'image-admin@example.org',
    password_hash: await bcrypt.hash(password, 4),
    legacy_password: null,
    avatar_url: null,
    email_verified_at: null,
    created_at: new Date(),
    is_active: 1,
  }
  const server = await startServer(createApp({
    config: createConfig(),
    pool: makeManagementPool(user),
    sessionStore: new MemorySessionStore(),
  }))
  t.after(server.close)
  const auth = await createAdminSession(server, user.email, password)
  let uploadedPath

  try {
    const image = new FormData()
    const validPng = await sharp({
      create: { width: 1, height: 1, channels: 3, background: { r: 12, g: 34, b: 56 } },
    }).png().toBuffer()
    image.append('image', new Blob([validPng], { type: 'image/png' }), 'picture.png')
    const response = await fetch(`${server.baseUrl}/api/v1/admin/uploads`, {
      method: 'POST',
      headers: { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrfToken },
      body: image,
    })
    assert.equal(response.status, 201)
    const result = await response.json()
    uploadedPath = result.url.split('/').pop()
    assert.match(result.url, /^\/api\/v1\/uploads\/[a-f0-9-]+\.png$/)

    const served = await fetch(`${server.baseUrl}${result.url}`)
    assert.equal(served.status, 200)
    assert.equal(served.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(served.headers.get('cross-origin-resource-policy'), 'cross-origin')

    const invalid = new FormData()
    invalid.append('image', new Blob(['not an image'], { type: 'image/png' }), 'fake.png')
    const rejected = await fetch(`${server.baseUrl}/api/v1/admin/uploads`, {
      method: 'POST',
      headers: { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrfToken },
      body: invalid,
    })
    assert.equal(rejected.status, 400)

    const oversized = new FormData()
    oversized.append('image', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png')
    const tooLarge = await fetch(`${server.baseUrl}/api/v1/admin/uploads`, {
      method: 'POST',
      headers: { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrfToken },
      body: oversized,
    })
    assert.equal(tooLarge.status, 413)
  } finally {
    if (uploadedPath) await unlink(join(uploadDirectory, uploadedPath))
  }
})
