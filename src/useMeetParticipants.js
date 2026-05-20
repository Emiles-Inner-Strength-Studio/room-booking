import { useState, useEffect, useRef } from 'react'

const EARLY_POLL_INTERVAL = 15000  // 15s for first 5 min
const NORMAL_POLL_INTERVAL = 30000 // 30s after that
const EARLY_PHASE_DURATION = 5 * 60000 // 5 minutes

const getApiKeyHeader = () => {
  const key = localStorage.getItem('gcal_api_key_backend')
  return key ? { Authorization: `Bearer ${key}` } : {}
}

async function fetchParticipants(meetingCode) {
  const res = await fetch(`/api/meet-participants?meetingCode=${encodeURIComponent(meetingCode)}`, {
    headers: getApiKeyHeader(),
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.participants || []
}

/**
 * Poll Google Meet for active participants in a call.
 * - Starts polling at eventStart
 * - Polls every 15s for the first 5 minutes, then every 30s
 * - Stops when eventEnd is reached or meetingCode is null
 */
export function useMeetParticipants(meetingCode, eventStart, eventEnd) {
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
      const result = await fetchParticipants(meetingCode)
      if (active) setParticipants(result)
    }

    const startPolling = () => {
      if (!active) return
      const elapsed = Date.now() - startMs
      const isEarlyPhase = elapsed < EARLY_PHASE_DURATION
      const interval = isEarlyPhase ? EARLY_POLL_INTERVAL : NORMAL_POLL_INTERVAL

      // Initial fetch
      poll()

      // Set up interval
      intervalRef.current = setInterval(poll, interval)

      // If in early phase, schedule switch to normal interval
      if (isEarlyPhase) {
        const remaining = EARLY_PHASE_DURATION - elapsed
        phaseTimeoutRef.current = setTimeout(() => {
          if (!active) return
          clearInterval(intervalRef.current)
          intervalRef.current = setInterval(poll, NORMAL_POLL_INTERVAL)
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
  }, [meetingCode, eventStart?.getTime(), eventEnd?.getTime()])

  return { participants }
}
