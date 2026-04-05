import { getCalendarClient, cors, requireAuth } from './_auth.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })

  const { calendarId, title, startTime, durationMinutes } = req.body
  if (!calendarId || !title || !startTime || !durationMinutes) {
    return res.status(400).json({ error: 'calendarId, title, startTime, durationMinutes required' })
  }

  try {
    const calendar = await getCalendarClient()
    const start = new Date(startTime)
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
    res.status(500).json({ error: e.message })
  }
}
