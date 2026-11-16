export class HttpError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)

  if (error.name === 'MulterError') {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE'
    return res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'UPLOAD_TOO_LARGE' : 'UPLOAD_INVALID',
        message: tooLarge ? 'Image files must be 5 MB or smaller.' : 'The uploaded file is invalid.',
      },
    })
  }

  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with those details already exists.' } })
  }

  const unavailableDatabaseErrors = new Set([
    'ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST',
  ])
  const databaseUnavailable = unavailableDatabaseErrors.has(error.code)
  const status = Number.isInteger(error.status) ? error.status : databaseUnavailable ? 503 : 500
  if (status >= 500) {
    const code = databaseUnavailable ? 'DATABASE_UNAVAILABLE' : error.code || 'INTERNAL_ERROR'
    const details = { method: req.method, path: req.path, code }
    if (process.env.NODE_ENV === 'development' &&
        ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) {
      details.detail = error.message
    }
    console.error('Request failed:', details)
  }

  return res.status(status).json({
    error: {
      code: databaseUnavailable ? 'DATABASE_UNAVAILABLE' : status >= 500 ? 'INTERNAL_ERROR' : error.code || 'INTERNAL_ERROR',
      message: databaseUnavailable
        ? 'The database is temporarily unavailable.'
        : status >= 500 ? 'An unexpected error occurred.' : error.message,
    },
  })
}
