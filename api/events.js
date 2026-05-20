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

    const timeZone = req.query.timeZone || 'UTC'
    if (!/^[A-Za-z_\/]+$/.test(timeZone)) {
      return res.status(400).json({ error: 'Invalid timeZone' })
    }

    // Compute start/end of "today" in the client's timezone as proper RFC3339
    const now = new Date()
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const todayStr = fmt.format(now)
    // Get the UTC offset for this timezone at the current moment
    const localeStr = now.toLocaleString('en-US', { timeZone })
    const localNow = new Date(localeStr)
    const offsetMs = localNow.getTime() - now.getTime()
    const startOfDayUTC = new Date(new Date(`${todayStr}T00:00:00`).getTime() - offsetMs)
    const endOfDayUTC = new Date(new Date(`${todayStr}T23:59:59`).getTime() - offsetMs)

    const result = await calendar.events.list({
      calendarId,
      timeMin: startOfDayUTC.toISOString(),
      timeMax: endOfDayUTC.toISOString(),
      timeZone,
      singleEvents: true,
      orderBy: 'startTime',
    })
    res.status(200).json(result.data.items || [])
  } catch (e) {
    console.error('events error:', e.message)
    res.status(500).json({ error: e.message || 'Failed to process request' })
  }
}
