import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeEmail, validateLogin, validateNewPassword, validateProfileName, validateRegistration,
} from '../src/middleware/validate.js'

test('registration normalizes email and trims the display name', () => {
  assert.deepEqual(validateRegistration({
    name: '  A BYB Member ',
    email: '  PERSON@EXAMPLE.ORG ',
    password: 'a long secure password',
  }), {
    name: 'A BYB Member',
    email: 'person@example.org',
    password: 'a long secure password',
  })
})

test('registration accepts an eight-character password and rejects shorter passwords', () => {
  assert.deepEqual(validateRegistration({
    name: 'Member',
    email: 'person@example.org',
    password: 'eight888',
  }).password, 'eight888')
  assert.throws(() => validateRegistration({ name: 'Member', email: 'person@example.org', password: 'seven77' }), { status: 400 })
  assert.throws(() => validateRegistration({ name: 'Member', email: 'not-an-email', password: 'long enough password' }), { status: 400 })
  assert.throws(() => validateNewPassword('seven77'), { status: 400 })
})

test('login rejects oversized bcrypt inputs', () => {
  assert.throws(() => validateLogin({ email: 'person@example.org', password: 'x'.repeat(73) }), { status: 400 })
  assert.throws(() => validateLogin({ email: 'person@example.org', password: 'seven77' }), { status: 400 })
  assert.equal(validateLogin({ email: 'person@example.org', password: 'eight888' }).password, 'eight888')
})

test('profile names are trimmed and bounded', () => {
  assert.equal(validateProfileName({ name: '  A Member  ' }), 'A Member')
  assert.throws(() => validateProfileName({ name: ' ' }), { status: 400 })
})

test('email normalization is safe for non-string values', () => {
  assert.equal(normalizeEmail(null), '')
})
