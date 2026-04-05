import { getCalendarClient, cors, requireAuth } from './_auth.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!requireAuth(req, res)) return

  try {
    const calendar = await getCalendarClient()
    const result = await calendar.calendarList.list({ minAccessRole: 'reader' })
    const items = (result.data.items || []).map(({ id, summary, description }) => ({
      id,
      summary,
      description,
    }))
    res.status(200).json(items)
  } catch (e) {
    console.error('rooms error:', e.message)
    res.status(500).json({ error: e.message })
  }
}
