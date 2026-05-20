import { useState, useEffect, useRef } from 'react'
import { MEET_EARLY_POLL_INTERVAL, MEET_NORMAL_POLL_INTERVAL, MEET_EARLY_PHASE_DURATION } from './config'

const MEET_API_BASE = 'https://meet.googleapis.com/v2'

const getApiKeyHeader = () => {
  const key = localStorage.getItem('gcal_api_key_backend')
  return key ? { Authorization: `Bearer ${key}` } : {}
}

// Backend mode: call our serverless endpoint
async function fetchParticipantsBackend(meetingCode) {
  const res = await fetch(`/api/meet-participants?meetingCode=${encodeURIComponent(meetingCode)}`, {
    headers: getApiKeyHeader(),
  })
  if (!res.ok) return []
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
export function useMeetParticipants(meetingCode, eventStart, eventEnd, isBackend = true) {
  const [participants, setParticipants] = useState([])
  const intervalRef = useRef(null)
  const timeoutRef = useRef(null)
  const phaseTimeoutRef = useRef(null)

  useEffect(() => {
    if (!meetingCode || !eventStart || !eventEnd) {
      setParticipants([])
      return
    }

    const now = Date.now()
    const startMs = eventStart.getTime()
    const endMs = eventEnd.getTime()

    // If event already ended, don't poll
    if (now >= endMs) {
      setParticipants([])
      return
    }

    let active = true

    const poll = async () => {
      if (!active) return
      const result = isBackend
        ? await fetchParticipantsBackend(meetingCode)
        : await fetchParticipantsOAuth(meetingCode)
      if (active) setParticipants(result)
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
      setParticipants([])
      clearInterval(intervalRef.current)
    }, stopMs)

    return () => {
      active = false
      clearInterval(intervalRef.current)
      clearTimeout(timeoutRef.current)
      clearTimeout(phaseTimeoutRef.current)
      clearTimeout(stopTimer)
    }
  }, [meetingCode, eventStart?.getTime(), eventEnd?.getTime(), isBackend])

  return { participants }
}
