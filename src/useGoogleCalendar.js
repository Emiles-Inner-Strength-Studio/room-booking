/**
 * useGoogleCalendar — hook for Google Calendar API access via GAPI + GIS
 *
 * Auth flow:
 *  - Client ID + API Key stored in localStorage (set via Settings)
 *  - Uses Google Identity Services (GIS) for OAuth token
 *  - Token stored in memory, auto-refreshed
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const SCOPES = 'https://www.googleapis.com/auth/calendar'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'

export function useGoogleCalendar() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState(null)
  const tokenClientRef = useRef(null)
  const resolveAuthRef = useRef(null)

  const clientId = localStorage.getItem('gcal_client_id')
  const apiKey = localStorage.getItem('gcal_api_key')

  // Init GAPI + GIS
  useEffect(() => {
    if (!clientId || !apiKey) return

    const initGapi = () => new Promise((resolve) => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({ apiKey, discoveryDocs: [DISCOVERY_DOC] })
        resolve()
      })
    })

    const initGis = () => {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) {
            setError(resp.error)
            if (resolveAuthRef.current) resolveAuthRef.current(false)
            return
          }
          setAuthed(true)
          if (resolveAuthRef.current) resolveAuthRef.current(true)
        },
      })
    }

    const init = async () => {
      try {
        await initGapi()
        initGis()
        setReady(true)
        // If we have a valid token already, mark authed
        const token = window.gapi.client.getToken()
        if (token) setAuthed(true)
      } catch (e) {
        setError(e.message)
      }
    }

    if (window.gapi && window.google) {
      init()
    } else {
      // Wait for scripts to load
      const interval = setInterval(() => {
        if (window.gapi && window.google) {
          clearInterval(interval)
          init()
        }
      }, 100)
    }
  }, [clientId, apiKey])

  const signIn = useCallback(() => {
    return new Promise((resolve) => {
      resolveAuthRef.current = resolve
      if (!tokenClientRef.current) { resolve(false); return }
      const token = window.gapi.client.getToken()
      if (token === null) {
        tokenClientRef.current.requestAccessToken({ prompt: 'consent' })
      } else {
        tokenClientRef.current.requestAccessToken({ prompt: '' })
      }
    })
  }, [])

  const signOut = useCallback(() => {
    const token = window.gapi.client.getToken()
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token)
      window.gapi.client.setToken('')
    }
    setAuthed(false)
  }, [])

  // List room resources (Google Workspace admin only, or use directory API)
  const listRooms = useCallback(async () => {
    // Returns calendars the authed user has access to (includes room resources shared with them)
    const res = await window.gapi.client.calendar.calendarList.list({
      minAccessRole: 'reader',
    })
    return res.result.items || []
  }, [])

  // Get events for today
  const getTodayEvents = useCallback(async (calendarId) => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    const res = await window.gapi.client.calendar.events.list({
      calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })
    return res.result.items || []
  }, [])

  // Book a room
  const bookRoom = useCallback(async (calendarId, { title, startTime, durationMinutes }) => {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000)
    const res = await window.gapi.client.calendar.events.insert({
      calendarId,
      resource: {
        summary: title,
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
      },
    })
    return res.result
  }, [])

  return { ready, authed, error, signIn, signOut, listRooms, getTodayEvents, bookRoom }
}
