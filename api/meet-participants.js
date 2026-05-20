import { getMeetClient, cors, securityHeaders, rateLimit, requireAuth } from './_auth.js'

export default async function handler(req, res) {
  securityHeaders(res)
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!rateLimit(req, res)) return
  if (!requireAuth(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { meetingCode } = req.query
  if (!meetingCode || typeof meetingCode !== 'string') {
    return res.status(400).json({ error: 'meetingCode required' })
  }
  // Meeting codes are like "abc-mnop-xyz"
  if (!/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(meetingCode)) {
    return res.status(400).json({ error: 'Invalid meetingCode format' })
  }

  try {
    const meet = await getMeetClient()

    // Find active conference for this meeting code
    const confRes = await meet.conferenceRecords.list({
      filter: `space.meeting_code="${meetingCode}" AND end_time IS NULL`,
    })

    const records = confRes.data.conferenceRecords || []
    if (records.length === 0) {
      return res.status(200).json({ participants: [] })
    }

    const conferenceRecord = records[0].name

    // List active participants (those still in the call)
    const partRes = await meet.conferenceRecords.participants.list({
      parent: conferenceRecord,
      filter: 'latest_end_time IS NULL',
    })

    const participants = (partRes.data.participants || []).map(p => ({
      displayName: p.signedinUser?.displayName || p.anonymousUser?.displayName || p.phoneUser?.displayName || 'Unknown',
      type: p.signedinUser ? 'user' : p.anonymousUser ? 'anonymous' : 'phone',
    }))

    res.status(200).json({ participants })
  } catch (e) {
    // 404 = meeting not found or not started yet — not an error
    if (e.code === 404 || e.status === 404) {
      return res.status(200).json({ participants: [] })
    }
    console.error('meet-participants error:', e.message)
    res.status(500).json({ error: e.message || 'Failed to fetch participants' })
  }
}
