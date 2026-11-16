import { Router } from 'express'
import { asyncRoute, HttpError } from '../middleware/errors.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function createContactRouter({ pool }) {
  const router = Router()
  router.post('/', asyncRoute(async (req, res) => {
    const { name, email, subject, message } = req.body || {}
    const values = {
      name: typeof name === 'string' ? name.trim() : '',
      email: typeof email === 'string' ? email.trim().toLowerCase() : '',
      subject: typeof subject === 'string' ? subject.trim() : '',
      message: typeof message === 'string' ? message.trim() : '',
    }
    if (values.name.length < 2 || values.name.length > 120 ||
        !emailPattern.test(values.email) || values.email.length > 254 ||
        values.subject.length < 2 || values.subject.length > 200 ||
        values.message.length < 10 || values.message.length > 5000) {
      throw new HttpError(400, 'Check the name, email, subject, and message fields.', 'VALIDATION_ERROR')
    }
    const [result] = await pool.execute(
      'INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
      [values.name, values.email, values.subject, values.message],
    )
    res.status(201).json({ id: result.insertId, message: 'Your message has been received.' })
  }))
  return router
}
