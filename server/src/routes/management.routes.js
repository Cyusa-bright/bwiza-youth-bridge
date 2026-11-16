import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import sharp from 'sharp'
import { Router } from 'express'
import { asyncRoute, HttpError } from '../middleware/errors.js'
import { requireRole } from '../middleware/auth.js'
import { validateId } from '../middleware/validate.js'

const uploadDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../uploads')
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
})
const resources = {
  programs: {
    table: 'programs',
    fields: 'id, slug, title, summary, category, image, details, status, created_at, updated_at',
    order: 'created_at DESC, id DESC',
    event: false,
  },
  projects: {
    table: 'projects',
    fields: 'id, slug, title, summary, category, image, details, status, created_at, updated_at',
    order: 'created_at DESC, id DESC',
  },
  events: {
    table: 'events',
    fields: 'id, slug, title, summary, category, image, details, status, starts_at, ends_at, location, created_at, updated_at',
    order: 'starts_at DESC, id DESC',
  },
  team: {
    table: 'team',
    fields: 'id, slug, name, role, bio, image, status, sort_order, created_at, updated_at',
    order: 'sort_order ASC, id ASC',
  },
}
const resourceNames = new Set(Object.keys(resources))
const allowedStatuses = new Set(['draft', 'published', 'archived'])
const validKey = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/

function slugify(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160)
}

function text(value, name, { min = 0, max, required = false } = {}) {
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string') throw new HttpError(400, `${name} must be text.`, 'VALIDATION_ERROR')
  const result = value.trim()
  if ((required && result.length < Math.max(1, min)) || result.length < min || result.length > max) {
    throw new HttpError(400, `${name} must be between ${min} and ${max} characters.`, 'VALIDATION_ERROR')
  }
  return result
}

function imagePath(value) {
  if (value === undefined) return null
  if (value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 2048 ||
      [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new HttpError(400, 'Image URL is invalid.', 'VALIDATION_ERROR')
  }
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) {
      return url.href
    }
  } catch {
    // The value is not an absolute HTTP URL.
  }
  throw new HttpError(400, 'Image URL must be a local path or an HTTP(S) URL.', 'VALIDATION_ERROR')
}

function eventDate(value, name, required = false) {
  if ((value === undefined || value === '') && !required) return null
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new HttpError(400, `${name} must be a valid date.`, 'VALIDATION_ERROR')
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function parseDetails(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function shapeRecord(resource, row) {
  if (!row) return row
  if (resource === 'team') return row
  return {
    ...row,
    description: row.summary,
    details: parseDetails(row.details),
    ...(resource === 'events' ? { date: row.starts_at } : {}),
  }
}

function validateRecord(resource, body, existing = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Provide a valid content record.', 'VALIDATION_ERROR')
  }
  const merged = { ...existing, ...body }
  const statuses = resource === 'events' ? new Set([...allowedStatuses, 'cancelled']) : allowedStatuses
  const status = merged.status === undefined ? 'draft' : merged.status
  if (!statuses.has(status)) {
    throw new HttpError(400, `Status must be ${[...statuses].join(', ')}.`, 'VALIDATION_ERROR')
  }
  const image = imagePath(merged.image)
  const detailsInput = merged.points === undefined ? merged.details : merged.points
  let details = null
  if (detailsInput !== undefined && detailsInput !== null && detailsInput !== '') {
    if (Array.isArray(detailsInput)) {
      if (detailsInput.length > 30 || detailsInput.some((item) => typeof item !== 'string' || item.trim().length > 500)) {
        throw new HttpError(400, 'Details must contain no more than 30 text items of at most 500 characters.', 'VALIDATION_ERROR')
      }
      details = JSON.stringify(detailsInput.map((item) => item.trim()).filter(Boolean))
    } else if (typeof detailsInput === 'string' && detailsInput.length <= 12000) {
      details = detailsInput
    } else if (typeof detailsInput === 'object' && Buffer.byteLength(JSON.stringify(detailsInput), 'utf8') <= 12000) {
      details = JSON.stringify(detailsInput)
    } else {
      throw new HttpError(400, 'Details must be text or a list of text items.', 'VALIDATION_ERROR')
    }
  }

  if (resource === 'team') {
    const name = text(merged.name, 'Name', { min: 2, max: 255, required: true })
    return {
      slug: slugify(text(merged.slug || name, 'Slug', { max: 160 }) || name),
      name,
      role: text(merged.role || '', 'Role', { max: 100 }) || null,
      bio: text(merged.bio || '', 'Biography', { max: 5000 }) || null,
      image,
      status,
      sort_order: Number.isInteger(merged.sort_order) && merged.sort_order >= 0 && merged.sort_order <= 100000
        ? merged.sort_order : 0,
    }
  }

  const title = text(merged.title, 'Title', { min: 2, max: 200, required: true })
  const slugInput = merged.slug ? text(merged.slug, 'Slug', { max: 160 }) : title
  const slug = slugify(slugInput)
  if (!slug) throw new HttpError(400, 'A non-empty title is required to create a slug.', 'VALIDATION_ERROR')
  const summary = text(merged.summary ?? merged.description, 'Description', { min: 2, max: 12000, required: true })
  const category = text(merged.category || '', 'Category', { max: 100 }) || null
  const record = { slug, title, summary, category, image, details, status }
  if (resource === 'events') {
    const start = eventDate(merged.starts_at ?? merged.startsAt ?? merged.date, 'Start date', true)
    const end = eventDate(merged.ends_at ?? merged.endsAt, 'End date')
    if (end && new Date(end) < new Date(start)) {
      throw new HttpError(400, 'End date cannot be before start date.', 'VALIDATION_ERROR')
    }
    record.starts_at = start
    record.date = start
    record.ends_at = end
    record.location = text(merged.location || '', 'Location', { max: 255 }) || null
  }
  return record
}

async function normalizeImage(buffer) {
  const image = sharp(buffer, { failOn: 'error', limitInputPixels: 16_000_000 })
  try {
    const metadata = await image.metadata()
    const formats = {
      jpeg: { extension: 'jpg', mime: 'image/jpeg' },
      png: { extension: 'png', mime: 'image/png' },
      webp: { extension: 'webp', mime: 'image/webp' },
    }
    const type = formats[metadata.format]
    if (!type || !metadata.width || !metadata.height) {
      throw new HttpError(400, 'Only valid JPEG, PNG, or WebP images are accepted.', 'INVALID_IMAGE')
    }
    const normalized = await image.rotate().toFormat(metadata.format).toBuffer()
    if (normalized.length > 5 * 1024 * 1024) {
      throw new HttpError(413, 'Image files must be 5 MB or smaller after processing.', 'UPLOAD_TOO_LARGE')
    }
    return { ...type, buffer: normalized }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'The uploaded file is not a valid supported image.', 'INVALID_IMAGE')
  }
}

function requireResource(value) {
  if (!resourceNames.has(value)) throw new HttpError(404, 'Content collection not found.', 'NOT_FOUND')
  return resources[value]
}

export function createManagementRouter({ pool }) {
  const router = Router()
  router.use(...requireRole(pool, 'admin'))

  router.get('/site-content', asyncRoute(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT content_key, content_value, updated_at FROM website_content ORDER BY content_key',
    )
    res.json({
      items: rows.map((row) => ({ key: row.content_key, value: JSON.parse(row.content_value), updated_at: row.updated_at })),
    })
  }))

  router.post('/site-content', asyncRoute(async (req, res) => {
    const { key, value } = req.body || {}
    if (typeof key !== 'string' || !validKey.test(key)) {
      throw new HttpError(400, 'Content key must be 1–100 letters, numbers, dots, underscores, or hyphens.', 'VALIDATION_ERROR')
    }
    if (value === undefined || value === null || typeof value !== 'object' ||
        Buffer.byteLength(JSON.stringify(value), 'utf8') > 20000) {
      throw new HttpError(400, 'Content value must be an object or array no larger than 20 KB.', 'VALIDATION_ERROR')
    }
    const [result] = await pool.execute(
      'INSERT INTO website_content (content_key, content_value) VALUES (?, ?)',
      [key, JSON.stringify(value)],
    )
    res.status(201).json({ id: result.insertId, key, value })
  }))

  router.get('/site-content/:key', asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(
      'SELECT content_key, content_value, updated_at FROM website_content WHERE content_key = ? LIMIT 1',
      [req.params.key],
    )
    if (!rows.length) throw new HttpError(404, 'Website content not found.', 'NOT_FOUND')
    res.json({ item: { key: rows[0].content_key, value: JSON.parse(rows[0].content_value), updated_at: rows[0].updated_at } })
  }))

  router.patch('/site-content/:key', asyncRoute(async (req, res) => {
    const { value } = req.body || {}
    if (value === undefined || value === null || typeof value !== 'object' ||
        Buffer.byteLength(JSON.stringify(value), 'utf8') > 20000) {
      throw new HttpError(400, 'Content value must be an object or array no larger than 20 KB.', 'VALIDATION_ERROR')
    }
    const [result] = await pool.execute(
      'UPDATE website_content SET content_value = ? WHERE content_key = ?',
      [JSON.stringify(value), req.params.key],
    )
    if (!result.affectedRows) throw new HttpError(404, 'Website content not found.', 'NOT_FOUND')
    res.json({ key: req.params.key, value })
  }))

  router.delete('/site-content/:key', asyncRoute(async (req, res) => {
    const [result] = await pool.execute('DELETE FROM website_content WHERE content_key = ?', [req.params.key])
    if (!result.affectedRows) throw new HttpError(404, 'Website content not found.', 'NOT_FOUND')
    res.status(204).end()
  }))

  router.post('/uploads', upload.single('image'), asyncRoute(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose an image file to upload.', 'VALIDATION_ERROR')
    const normalized = await normalizeImage(req.file.buffer)
    const filename = `${randomUUID()}.${normalized.extension}`
    await mkdir(uploadDirectory, { recursive: true })
    await writeFile(join(uploadDirectory, filename), normalized.buffer, { flag: 'wx', mode: 0o600 })
    res.status(201).json({
      url: `/api/v1/uploads/${filename}`,
      mimeType: normalized.mime,
      size: normalized.buffer.length,
    })
  }))

  router.get('/:resource', asyncRoute(async (req, res, next) => {
    if (!resourceNames.has(req.params.resource)) return next()
    const resource = requireResource(req.params.resource)
    const [rows] = await pool.query(
      `SELECT ${resource.fields} FROM ${resource.table} ORDER BY ${resource.order}`,
    )
    res.json({ items: rows.map((row) => shapeRecord(req.params.resource, row)) })
  }))

  router.get('/:resource/:id', asyncRoute(async (req, res, next) => {
    if (!resourceNames.has(req.params.resource)) return next()
    const id = validateId(req.params.id)
    const resource = requireResource(req.params.resource)
    const [rows] = await pool.execute(
      `SELECT ${resource.fields} FROM ${resource.table} WHERE id = ? LIMIT 1`,
      [id],
    )
    if (!rows.length) throw new HttpError(404, 'Content record not found.', 'NOT_FOUND')
    res.json({ item: shapeRecord(req.params.resource, rows[0]) })
  }))

  router.post('/:resource', asyncRoute(async (req, res, next) => {
    if (!resourceNames.has(req.params.resource)) return next()
    const resource = requireResource(req.params.resource)
    const record = validateRecord(req.params.resource, req.body)
    const columns = Object.keys(record)
    const [result] = await pool.execute(
      `INSERT INTO ${resource.table} (${columns.join(', ')})
       VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((column) => record[column]),
    )
    const [rows] = await pool.execute(
      `SELECT ${resource.fields} FROM ${resource.table} WHERE id = ? LIMIT 1`,
      [result.insertId],
    )
    res.status(201).json({ item: shapeRecord(req.params.resource, rows[0]) })
  }))

  router.patch('/:resource/:id', asyncRoute(async (req, res, next) => {
    if (!resourceNames.has(req.params.resource)) return next()
    const id = validateId(req.params.id)
    const resource = requireResource(req.params.resource)
    const [existingRows] = await pool.execute(
      `SELECT ${resource.fields} FROM ${resource.table} WHERE id = ? LIMIT 1`,
      [id],
    )
    if (!existingRows.length) throw new HttpError(404, 'Content record not found.', 'NOT_FOUND')
    const current = shapeRecord(req.params.resource, existingRows[0])
    const record = validateRecord(req.params.resource, req.body, current)
    const columns = Object.keys(record)
    const [result] = await pool.execute(
      `UPDATE ${resource.table} SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((column) => record[column]), id],
    )
    if (!result.affectedRows) throw new HttpError(404, 'Content record not found.', 'NOT_FOUND')
    const [rows] = await pool.execute(
      `SELECT ${resource.fields} FROM ${resource.table} WHERE id = ? LIMIT 1`,
      [id],
    )
    res.json({ item: shapeRecord(req.params.resource, rows[0]) })
  }))

  router.delete('/:resource/:id', asyncRoute(async (req, res, next) => {
    if (!resourceNames.has(req.params.resource)) return next()
    const id = validateId(req.params.id)
    const resource = requireResource(req.params.resource)
    const [result] = await pool.execute(`DELETE FROM ${resource.table} WHERE id = ?`, [id])
    if (!result.affectedRows) throw new HttpError(404, 'Content record not found.', 'NOT_FOUND')
    res.status(204).end()
  }))

  return router
}

export { uploadDirectory }
