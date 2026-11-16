import { randomBytes, timingSafeEqual } from 'node:crypto'
import { HttpError } from './errors.js'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

export function issueCsrfToken(req, res) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex')
  res.json({ csrfToken: req.session.csrfToken })
}

export function requireCsrf(req, res, next) {
  if (safeMethods.has(req.method)) return next()

  const supplied = req.get('X-CSRF-Token')
  const expected = req.session?.csrfToken
  if (typeof supplied !== 'string' || typeof expected !== 'string') {
    return next(new HttpError(403, 'The request could not be verified.', 'CSRF_INVALID'))
  }

  const suppliedBuffer = Buffer.from(supplied)
  const expectedBuffer = Buffer.from(expected)
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return next(new HttpError(403, 'The request could not be verified.', 'CSRF_INVALID'))
  }
  return next()
}

export function createCsrfToken() {
  return randomBytes(32).toString('hex')
}
