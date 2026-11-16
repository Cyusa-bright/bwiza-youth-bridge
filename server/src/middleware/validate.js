import { HttpError } from './errors.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRegistration(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = normalizeEmail(body.email)
  const password = body.password

  if (name.length < 2 || name.length > 120) throw new HttpError(400, 'Name must be between 2 and 120 characters.', 'VALIDATION_ERROR')
  if (!emailPattern.test(email) || email.length > 254) throw new HttpError(400, 'Enter a valid email address.', 'VALIDATION_ERROR')
  validateNewPassword(password)
  return { name, email, password }
}

export function validateLogin(body = {}) {
  const email = normalizeEmail(body.email)
  if (!emailPattern.test(email) || email.length > 254 || typeof body.password !== 'string' ||
      body.password.length < 8 || Buffer.byteLength(body.password, 'utf8') > 72) {
    throw new HttpError(400, 'Enter a valid email address and password.', 'VALIDATION_ERROR')
  }
  return { email, password: body.password, rememberMe: body.rememberMe === true }
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new HttpError(400, 'Password must be at least 8 characters and no more than 72 bytes.', 'VALIDATION_ERROR')
  }
}

export function validateProfileName(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length < 2 || name.length > 120) throw new HttpError(400, 'Name must be between 2 and 120 characters.', 'VALIDATION_ERROR')
  return name
}

export function validateId(value) {
  if (!/^[1-9]\d*$/.test(String(value))) throw new HttpError(400, 'Invalid identifier.', 'VALIDATION_ERROR')
  return String(value)
}
