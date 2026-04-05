import { getCalendarClient, cors, securityHeaders, rateLimit, requireAuth } from './_auth.js'

export default async function handler(req, res) {
  securityHeaders(res)
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!rateLimit(req, res)) return
  if (!requireAuth(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

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
    res.status(500).json({ error: 'Failed to fetch rooms' })
  }
}
