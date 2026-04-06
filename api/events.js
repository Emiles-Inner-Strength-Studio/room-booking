import { getCalendarClient, cors, securityHeaders, rateLimit, requireAuth } from './_auth.js'

export default async function handler(req, res) {
  securityHeaders(res)
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!rateLimit(req, res)) return
  if (!requireAuth(req, res)) return
  if (req.method !== 'GET' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const { calendarId } = req.query
  if (!calendarId) return res.status(400).json({ error: 'calendarId required' })
  if (typeof calendarId !== 'string' || calendarId.length > 256) {
    return res.status(400).json({ error: 'Invalid calendarId' })
  }

  try {
    const calendar = await getCalendarClient()

    if (req.method === 'DELETE') {
      const { eventId } = req.query
      if (!eventId) return res.status(400).json({ error: 'eventId required' })
      if (typeof eventId !== 'string' || eventId.length > 1024) {
        return res.status(400).json({ error: 'Invalid eventId' })
      }
      // Try deleting from the service account's own calendar first (where bookings are created),
      // then fall back to the room calendar
      try {
        await calendar.events.delete({ calendarId: 'primary', eventId })
      } catch (primaryErr) {
        if (primaryErr.code === 404 || primaryErr.code === 403) {
          await calendar.events.delete({ calendarId, eventId })
        } else {
          throw primaryErr
        }
      }
      return res.status(200).json({ ok: true })
    }

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    const result = await calendar.events.list({
      calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })
    res.status(200).json(result.data.items || [])
  } catch (e) {
    console.error('events error:', e.message)
    res.status(500).json({ error: e.message || 'Failed to process request' })
  }
}
