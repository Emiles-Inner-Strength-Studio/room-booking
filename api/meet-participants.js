import { getCalendarClient, getMeetClient, cors, securityHeaders, rateLimit, requireAuth } from './_auth.js'
import { isPrivateEvent } from '../src/eventPrivacy.js'

function getMeetingCode(event) {
  const values = [
    event.conferenceData?.conferenceId,
    event.hangoutLink,
    ...(event.conferenceData?.entryPoints || []).map(entry => entry.uri),
  ]
  return values.join(' ').match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/)?.[0] || null
}

export default async function handler(req, res) {
  securityHeaders(res)
  cors(req, res)
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('CDN-Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!rateLimit(req, res)) return
  if (!requireAuth(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { calendarId, eventId } = req.query
  if (!calendarId || typeof calendarId !== 'string' || calendarId.length > 256) {
    return res.status(400).json({ error: 'Valid calendarId required' })
  }
  if (!eventId || typeof eventId !== 'string' || eventId.length > 1024) {
    return res.status(400).json({ error: 'Valid eventId required' })
  }

  try {
    // Reload the event server-side so a client cannot bypass its privacy flag.
    const calendar = await getCalendarClient()
    const event = (await calendar.events.get({ calendarId, eventId })).data
    if (isPrivateEvent(event)) {
      return res.status(200).json({ participants: [] })
    }

    const meetingCode = getMeetingCode(event)
    const organizerEmail = event.organizer?.email
    if (!meetingCode || !organizerEmail) {
      return res.status(200).json({ participants: [] })
    }

    // Meet records are visible to the conference organizer. Room kiosks
    // normally impersonate a fixed admin account, which cannot see meetings
    // organized by other users, so use the organizer from the Calendar event.
    const meet = await getMeetClient(organizerEmail)

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
    // A missing/not-yet-started meeting is a valid empty result.
    if (e.code === 404 || e.status === 404) {
      return res.status(200).json({ participants: [] })
    }
    console.error('meet-participants error:', e.message)
    const status = e.code === 403 || e.status === 403 ? 403 : 500
    res.status(status).json({ error: status === 403 ? 'Meet access denied' : 'Failed to fetch participants' })
  }
}
