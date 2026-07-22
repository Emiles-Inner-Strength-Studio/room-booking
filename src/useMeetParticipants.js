import { useState, useEffect, useRef } from 'react'
import { MEET_EARLY_POLL_INTERVAL, MEET_NORMAL_POLL_INTERVAL, MEET_EARLY_PHASE_DURATION } from './config'

const MEET_API_BASE = 'https://meet.googleapis.com/v2'

const getApiKeyHeader = () => {
  const key = localStorage.getItem('gcal_api_key_backend')
  return key ? { Authorization: `Bearer ${key}` } : {}
}

// Backend mode: call our serverless endpoint
async function fetchParticipantsBackend(calendarId, eventId) {
  const params = new URLSearchParams({ calendarId, eventId })

  const res = await fetch(`/api/meet-participants?${params}`, {
    headers: getApiKeyHeader(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Meet participants request failed (${res.status})`)
  const data = await res.json()
  return data.participants || []
}

// OAuth mode: call Meet REST API directly with user's access token
async function fetchParticipantsOAuth(meetingCode) {
  const token = window.gapi?.client?.getToken()?.access_token
  if (!token) return []

  try {
    // Find active conference for this meeting code
    const confRes = await fetch(
      `${MEET_API_BASE}/conferenceRecords?filter=${encodeURIComponent(`space.meeting_code="${meetingCode}" AND end_time IS NULL`)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!confRes.ok) return []
    const confData = await confRes.json()
    const records = confData.conferenceRecords || []
    if (records.length === 0) return []

    const conferenceRecord = records[0].name

    // List active participants
    const partRes = await fetch(
      `${MEET_API_BASE}/${conferenceRecord}/participants?filter=${encodeURIComponent('latest_end_time IS NULL')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!partRes.ok) return []
    const partData = await partRes.json()

    return (partData.participants || []).map(p => ({
      displayName: p.signedinUser?.displayName || p.anonymousUser?.displayName || p.phoneUser?.displayName || 'Unknown',
      type: p.signedinUser ? 'user' : p.anonymousUser ? 'anonymous' : 'phone',
    }))
  } catch {
    return []
  }
}

/**
 * Poll Google Meet for active participants in a call.
 * - Starts polling at eventStart
 * - Polls every 15s for the first 5 minutes, then every 30s
 * - Stops when eventEnd is reached or meetingCode is null
 * - Works in both backend (service account) and OAuth (client-side) modes
 */
export function useMeetParticipants(meetingCode, eventStart, eventEnd, isBackend = true, calendarId = null, eventId = null) {
  const [participantState, setParticipantState] = useState({ meetingCode: null, participants: [] })
  const intervalRef = useRef(null)
  const timeoutRef = useRef(null)
  const phaseTimeoutRef = useRef(null)
  const startMs = eventStart?.getTime() ?? null
  const endMs = eventEnd?.getTime() ?? null

  useEffect(() => {
    if (!meetingCode || startMs == null || endMs == null) return
    if (isBackend && (!calendarId || !eventId)) return

    const now = Date.now()

    // If event already ended, don't poll
    if (now >= endMs) return

    let active = true

    const poll = async () => {
      if (!active) return
      try {
        const result = isBackend
          ? await fetchParticipantsBackend(calendarId, eventId)
          : await fetchParticipantsOAuth(meetingCode)
        if (active) setParticipantState({ meetingCode, participants: result })
      } catch (error) {
        // Keep the last known participant list during transient failures.
        console.warn('[meet] participant polling failed:', error.message)
      }
    }

    const startPolling = () => {
      if (!active) return
      const elapsed = Date.now() - startMs
      const isEarlyPhase = elapsed < MEET_EARLY_PHASE_DURATION
      const interval = isEarlyPhase ? MEET_EARLY_POLL_INTERVAL : MEET_NORMAL_POLL_INTERVAL

      // Initial fetch
      poll()

      // Set up interval
      intervalRef.current = setInterval(poll, interval)

      // If in early phase, schedule switch to normal interval
      if (isEarlyPhase) {
        const remaining = MEET_EARLY_PHASE_DURATION - elapsed
        phaseTimeoutRef.current = setTimeout(() => {
          if (!active) return
          clearInterval(intervalRef.current)
          intervalRef.current = setInterval(poll, MEET_NORMAL_POLL_INTERVAL)
        }, remaining)
      }
    }

    // Delay start until event begins, or start immediately if already active
    const delayMs = Math.max(0, startMs - now)
    if (delayMs > 0) {
      timeoutRef.current = setTimeout(startPolling, delayMs)
    } else {
      startPolling()
    }

    // Schedule stop at event end
    const stopMs = endMs - Date.now()
    const stopTimer = setTimeout(() => {
      active = false
      setParticipantState({ meetingCode, participants: [] })
      clearInterval(intervalRef.current)
    }, stopMs)

    return () => {
      active = false
      clearInterval(intervalRef.current)
      clearTimeout(timeoutRef.current)
      clearTimeout(phaseTimeoutRef.current)
      clearTimeout(stopTimer)
    }
  }, [meetingCode, startMs, endMs, isBackend, calendarId, eventId])

  const participants = participantState.meetingCode === meetingCode
    ? participantState.participants
    : []
  return { participants }
}
