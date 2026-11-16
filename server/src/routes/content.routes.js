import { Router } from 'express'
import { asyncRoute } from '../middleware/errors.js'

const resourceTables = {
  programs: 'programs',
  projects: 'projects',
  events: 'events',
}

export function createContentRouter({ pool }) {
  const router = Router()

  router.get('/site-content', asyncRoute(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT content_key, content_value, updated_at FROM website_content ORDER BY content_key',
    )
    res.json({
      items: rows.map((row) => ({ key: row.content_key, value: JSON.parse(row.content_value), updated_at: row.updated_at })),
    })
  }))

  router.get('/team', asyncRoute(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id, slug, name, role, bio, image, status, sort_order, created_at, updated_at
       FROM team WHERE status = 'published' ORDER BY sort_order ASC, id ASC`,
    )
    res.json({ items: rows })
  }))

  for (const [path, table] of Object.entries(resourceTables)) {
    const extraFields = path === 'events' ? ', starts_at, ends_at, location' : ''
    router.get(`/${path}`, asyncRoute(async (req, res) => {
      const [rows] = await pool.query(
        `SELECT id, slug, title, summary, category, image, details, status${extraFields}, created_at, updated_at
         FROM ${table} WHERE status = 'published' ORDER BY created_at DESC, id DESC`,
      )
      res.json({ items: rows.map((row) => ({
        ...row,
        description: row.summary,
        ...(path === 'events' ? { date: row.starts_at } : {}),
      })) })
    }))
    router.get(`/${path}/:slug`, asyncRoute(async (req, res) => {
      const [rows] = await pool.execute(
        `SELECT id, slug, title, summary, category, image, details, status${extraFields}, created_at, updated_at
         FROM ${table} WHERE slug = ? AND status = 'published' LIMIT 1`,
        [req.params.slug],
      )
      if (!rows.length) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Content not found.' } })
      res.json({ item: {
        ...rows[0],
        description: rows[0].summary,
        ...(path === 'events' ? { date: rows[0].starts_at } : {}),
      } })
    }))
  }
  return router
}
