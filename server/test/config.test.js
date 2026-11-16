import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConfig } from '../src/config/env.js'

const productionEnvironment = {
  NODE_ENV: 'production',
  DB_HOST: 'db.example.org',
  DB_PORT: '3306',
  DB_NAME: 'byb',
  DB_USER: 'byb_app',
  DB_PASSWORD: 'test-only-database-password',
  DB_SSL: 'true',
  SESSION_SECRET: 'a'.repeat(64),
  FRONTEND_ORIGIN: 'https://byb.example.org',
  FRONTEND_BASE_URL: 'https://byb.example.org',
  PORT: '5000',
  MAIL_HOST: '',
  MAIL_PORT: '587',
  MAIL_SECURE: 'false',
  MAIL_USER: '',
  MAIL_PASSWORD: '',
  MAIL_FROM: '',
}

function withEnvironment(overrides, callback) {
  const keys = new Set([...Object.keys(productionEnvironment), ...Object.keys(overrides)])
  const previous = new Map([...keys].map((key) => [key, process.env[key]]))
  Object.assign(process.env, productionEnvironment, overrides)
  try {
    return callback()
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('production configuration requires HTTPS and verified database TLS', () => {
  assert.throws(
    () => withEnvironment({ DB_SSL: 'false' }, loadConfig),
    /DB_SSL=true is required in production/,
  )
  assert.throws(
    () => withEnvironment({ DB_PASSWORD: '' }, loadConfig),
    /DB_PASSWORD is required in production/,
  )
  assert.throws(
    () => withEnvironment({ FRONTEND_ORIGIN: 'http://byb.example.org' }, loadConfig),
    /must use HTTPS in production/,
  )
  assert.throws(
    () => withEnvironment({ SESSION_SECRET: 'replace-with-at-least-32-random-characters' }, loadConfig),
    /Replace the example SESSION_SECRET/,
  )
})

test('production configuration accepts secure database and frontend settings', () => {
  const config = withEnvironment({}, loadConfig)
  assert.equal(config.nodeEnv, 'production')
  assert.deepEqual(config.db.ssl, { rejectUnauthorized: true })
  assert.equal(new URL(config.frontendOrigin).protocol, 'https:')
  assert.equal(new URL(config.frontendBaseUrl).protocol, 'https:')
})
