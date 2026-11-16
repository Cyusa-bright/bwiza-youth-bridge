import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'SESSION_SECRET', 'FRONTEND_ORIGIN']
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })

function positiveInteger(value, fallback, name, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value || fallback)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}`)
  }
  return parsed
}

export function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production')
  }

  const missing = required.filter((key) => !process.env[key])
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  const sessionSecret = process.env.SESSION_SECRET
  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters')
  }
  if (process.env.DB_SSL && !['true', 'false'].includes(process.env.DB_SSL)) {
    throw new Error('DB_SSL must be true or false')
  }
  const frontendOrigin = process.env.FRONTEND_ORIGIN
  let parsedOrigin
  try {
    parsedOrigin = new URL(frontendOrigin)
  } catch {
    throw new Error('FRONTEND_ORIGIN must be a valid origin URL')
  }
  if (parsedOrigin.origin !== frontendOrigin) {
    throw new Error('FRONTEND_ORIGIN must not contain a path, query, or trailing slash')
  }

  const mail = {
    host: process.env.MAIL_HOST,
    port: positiveInteger(process.env.MAIL_PORT, 587, 'MAIL_PORT', 65535),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM,
  }
  if (process.env.MAIL_SECURE && !['true', 'false'].includes(process.env.MAIL_SECURE)) {
    throw new Error('MAIL_SECURE must be true or false')
  }
  const mailConfigured = Boolean(
    process.env.MAIL_HOST || process.env.MAIL_FROM || process.env.MAIL_USER ||
    process.env.MAIL_PASSWORD || process.env.MAIL_SECURE === 'true',
  )
  if (mailConfigured && (!mail.host || !mail.from || Boolean(mail.user) !== Boolean(mail.password))) {
    throw new Error('Configure MAIL_HOST and MAIL_FROM, and provide both MAIL_USER and MAIL_PASSWORD when using SMTP authentication')
  }
  const frontendBaseUrl = process.env.FRONTEND_BASE_URL || frontendOrigin
  let parsedBaseUrl
  try {
    parsedBaseUrl = new URL(frontendBaseUrl)
  } catch {
    throw new Error('FRONTEND_BASE_URL must be an absolute URL')
  }
  if (!['http:', 'https:'].includes(parsedBaseUrl.protocol) || parsedBaseUrl.username || parsedBaseUrl.password) {
    throw new Error('FRONTEND_BASE_URL must use HTTP or HTTPS and must not contain credentials')
  }

  if (nodeEnv === 'production') {
    if (sessionSecret === 'replace-with-at-least-32-random-characters') {
      throw new Error('Replace the example SESSION_SECRET before production deployment')
    }
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD is required in production')
    }
    if (process.env.DB_SSL !== 'true') {
      throw new Error('DB_SSL=true is required in production')
    }
    if (parsedOrigin.protocol !== 'https:' || parsedBaseUrl.protocol !== 'https:') {
      throw new Error('FRONTEND_ORIGIN and FRONTEND_BASE_URL must use HTTPS in production')
    }
  }

  return {
    nodeEnv,
    port: positiveInteger(process.env.PORT, 5000, 'PORT', 65535),
    db: {
      host: process.env.DB_HOST,
      port: positiveInteger(process.env.DB_PORT, 3306, 'DB_PORT', 65535),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    },
    sessionSecret: process.env.SESSION_SECRET,
    frontendOrigin,
    frontendBaseUrl,
    mail,
  }
}
