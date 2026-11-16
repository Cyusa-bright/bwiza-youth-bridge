import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcrypt'
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  ensureDefaultAdmin,
} from '../src/db/seed-default-admin.js'

test('ensureDefaultAdmin creates the configured administrator account with admin access', async () => {
  const state = {
    users: [],
    roles: [{ id: 1, name: 'member' }, { id: 2, name: 'admin' }],
    userRoles: [],
  }

  const pool = {
    async execute(sql, params = []) {
      if (sql === 'SELECT id, password_hash FROM users WHERE email = ? LIMIT 1') {
        return [state.users.filter((user) => user.email === params[0])]
      }
      if (sql === 'UPDATE users SET name = ?, password_hash = ?, is_active = 1 WHERE id = ?') {
        const [user] = state.users.filter((entry) => entry.id === params[2])
        if (user) {
          user.name = params[0]
          user.password_hash = params[1]
          user.is_active = 1
        }
        return [{ affectedRows: 1 }]
      }
      if (sql === "INSERT IGNORE INTO roles (name) VALUES ('member'), ('admin')") {
        return [{ affectedRows: 1 }]
      }
      if (sql === 'SELECT id FROM roles WHERE name = ? LIMIT 1') {
        return [state.roles.filter((role) => role.name === params[0]).map((role) => ({ id: role.id }))]
      }
      if (sql === 'INSERT INTO users (name, email, password_hash, is_active) VALUES (?, ?, ?, 1)') {
        const id = state.users.length ? state.users[state.users.length - 1].id + 1 : 1
        const user = {
          id,
          name: params[0],
          email: params[1],
          password_hash: params[2],
          is_active: 1,
        }
        state.users.push(user)
        return [{ insertId: id }]
      }
      if (sql === 'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE assigned_at = assigned_at') {
        state.userRoles.push([params[0], params[1]])
        return [{ affectedRows: 1 }]
      }
      return [[]]
    },
  }

  await ensureDefaultAdmin(pool)

  assert.equal(state.users.length, 1)
  assert.equal(state.users[0].email, DEFAULT_ADMIN_EMAIL)
  assert.ok(await bcrypt.compare(DEFAULT_ADMIN_PASSWORD, state.users[0].password_hash))
  assert.ok(state.userRoles.some(([userId, roleId]) => userId === state.users[0].id && roleId === 2))
})
