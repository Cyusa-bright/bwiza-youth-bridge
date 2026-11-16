import { Router } from 'express'
import { asyncRoute, HttpError } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'

export function createApplicationRouter({ pool }) {
  const router = Router()
  const authenticated = requireAuth(pool)

  router.get('/my', authenticated, asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT a.id, a.message, a.status, a.created_at, a.updated_at,
              p.slug AS program_slug, p.title AS program_title,
              e.slug AS event_slug, e.title AS event_title
       FROM applications a
       LEFT JOIN programs p ON p.id = a.program_id
       LEFT JOIN events e ON e.id = a.event_id
       WHERE a.user_id = ? ORDER BY a.created_at DESC`,
      [req.user.id],
    )
    res.json({ items: rows })
  }))

  router.post('/', authenticated, asyncRoute(async (req, res) => {
    const { programSlug, eventSlug, message = '' } = req.body || {}
    if (Boolean(programSlug) === Boolean(eventSlug)) {
      throw new HttpError(400, 'Choose one program or event to apply for.', 'VALIDATION_ERROR')
    }
    if (typeof message !== 'string' || message.length > 3000) {
      throw new HttpError(400, 'Message must be 3000 characters or fewer.', 'VALIDATION_ERROR')
    }
    const resource = programSlug ? 'programs' : 'events'
    const slug = programSlug || eventSlug
    if (typeof slug !== 'string' || slug.length > 160) throw new HttpError(400, 'Invalid application target.', 'VALIDATION_ERROR')
    const [targets] = await pool.execute(
      `SELECT id FROM ${resource} WHERE slug = ? AND status = 'published' LIMIT 1`,
      [slug],
    )
    if (!targets.length) throw new HttpError(404, 'The selected opportunity is not available.', 'NOT_FOUND')
    const [result] = await pool.execute(
      `INSERT INTO applications (user_id, ${programSlug ? 'program_id' : 'event_id'}, message)
       VALUES (?, ?, ?)`,
      [req.user.id, targets[0].id, message.trim() || null],
    )
    res.status(201).json({ id: result.insertId, status: 'submitted' })
  }))

  router.patch('/:id/withdraw', authenticated, asyncRoute(async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id)) throw new HttpError(400, 'Invalid application identifier.', 'VALIDATION_ERROR')
    const [result] = await pool.execute(
      `UPDATE applications SET status = 'withdrawn'
       WHERE id = ? AND user_id = ? AND status IN ('submitted', 'reviewing')`,
      [req.params.id, req.user.id],
    )
    if (!result.affectedRows) throw new HttpError(404, 'Application not found or can no longer be withdrawn.', 'NOT_FOUND')
    res.json({ id: req.params.id, status: 'withdrawn' })
  }))
  return router
}
