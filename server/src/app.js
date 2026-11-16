import express from 'express'
import session from 'express-session'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { MySQLSessionStore } from './db/mysql-session-store.js'
import { uploadDirectory } from './routes/management.routes.js'
import { createMailer } from './services/mailer.js'
import { requireCsrf } from './middleware/csrf.js'
import { asyncRoute, errorHandler } from './middleware/errors.js'
import { createAuthRouter } from './routes/auth.routes.js'
import { createContentRouter } from './routes/content.routes.js'
import { createApplicationRouter } from './routes/application.routes.js'
import { createContactRouter } from './routes/contact.routes.js'
import { createAdminRouter } from './routes/admin.routes.js'
import { createManagementRouter } from './routes/management.routes.js'

export function createApp({ config, pool, sessionStore: providedSessionStore }) {
  const app = express()
  const sessionStore = providedSessionStore || new MySQLSessionStore(pool)
  app.locals.sessionStore = sessionStore
  const mailer = createMailer(config.mail)
  const isProduction = config.nodeEnv === 'production'
  app.disable('x-powered-by')
  if (isProduction) app.set('trust proxy', 1)

  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'", config.frontendOrigin],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    } : false,
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  }))
  app.use(cors({
    origin: config.frontendOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  }))
  app.use(express.json({ limit: '32kb' }))
  app.use(session({
    name: 'byb.sid',
    secret: config.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    },
  }))
  app.use('/api/v1', requireCsrf)
  app.use('/api/v1/uploads', express.static(uploadDirectory, {
    dotfiles: 'deny',
    index: false,
    maxAge: '1y',
    immutable: true,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Disposition', 'inline')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    },
  }))

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' } },
  })
  const recoveryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 4,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many password recovery attempts. Try again later.' } },
  })
  const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many messages. Try again later.' } },
  })

  const apiInfo = {
    name: 'Bwiza Youth Bridge API',
    status: 'ok',
    apiBasePath: '/api/v1',
    health: '/api/v1/health',
  }
  const databaseHealth = asyncRoute(async (req, res) => {
    try {
      await pool.query('SELECT 1')
    } catch (error) {
      console.error('Database health check failed:', error.code || 'DATABASE_UNAVAILABLE')
      return res.status(503).json({
        status: 'error',
        error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is unavailable.' },
      })
    }
    return res.json({ status: 'ok' })
  })

  app.get('/', (req, res) => res.json(apiInfo))
  app.get('/api/v1', (req, res) => res.json(apiInfo))
  app.get('/health', databaseHealth)
  app.get('/api/v1/health', databaseHealth)
  app.use('/api/v1/auth', createAuthRouter({
    pool, mailer, frontendBaseUrl: config.frontendBaseUrl, authLimiter, recoveryLimiter,
  }))
  app.use('/api/v1', createContentRouter({ pool }))
  app.use('/api/v1/applications', createApplicationRouter({ pool }))
  app.use('/api/v1/contact-messages', contactLimiter, createContactRouter({ pool }))
  app.use('/api/v1/admin', createAdminRouter({ pool }))
  app.use('/api/v1/admin', createManagementRouter({ pool }))

  app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found.' } }))
  app.use(errorHandler)
  return app
}
