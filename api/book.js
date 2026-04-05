import { getCalendarClient, cors, securityHeaders, rateLimit, requireAuth } from './_auth.js'

const MAX_TITLE_LENGTH = 200
const MAX_DURATION_MINUTES = 480 // 8 hours
const MIN_DURATION_MINUTES = 5

export default async function handler(req, res) {
  securityHeaders(res)
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!rateLimit(req, res)) return
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { calendarId, title, startTime, durationMinutes } = req.body || {}

  if (!calendarId || !title || !startTime || durationMinutes == null) {
    return res.status(400).json({ error: 'calendarId, title, startTime, durationMinutes required' })
  }

  if (typeof calendarId !== 'string' || calendarId.length > 256) {
    return res.status(400).json({ error: 'Invalid calendarId' })
  }
  if (typeof title !== 'string' || title.length === 0 || title.length > MAX_TITLE_LENGTH) {
    return res.status(400).json({ error: `Title must be 1-${MAX_TITLE_LENGTH} characters` })
  }
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes) ||
      durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES) {
    return res.status(400).json({ error: `Duration must be ${MIN_DURATION_MINUTES}-${MAX_DURATION_MINUTES} minutes` })
  }

  const start = new Date(startTime)
  if (isNaN(start.getTime())) {
    return res.status(400).json({ error: 'Invalid startTime — must be a valid ISO 8601 date' })
  }

  try {
    const calendar = await getCalendarClient()
    const end = new Date(start.getTime() + durationMinutes * 60000)

    const result = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: [{ email: calendarId, resource: true }],
      },
    })
    res.status(200).json(result.data)
  } catch (e) {
    console.error('book error:', e.message)
    res.status(500).json({ error: 'Failed to create booking' })
  }
}
