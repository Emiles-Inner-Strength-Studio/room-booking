/**
 * useGoogleCalendar — hook for Google Calendar API access via GAPI + GIS
 *
 * Falls back to mock data when credentials aren't configured.
 * Remove mockData imports when going live with real credentials.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getMockEvents, MOCK_ROOMS } from './mockData'

const SCOPES = 'https://www.googleapis.com/auth/calendar'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'

function hasValidCredentials() {
  const clientId = localStorage.getItem('gcal_client_id') || ''
  const apiKey = localStorage.getItem('gcal_api_key') || ''
  return clientId.length > 10 && apiKey.length > 10
}

export function useGoogleCalendar() {
  const credentialsPresent = hasValidCredentials()
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState(null)
  const [isMock, setIsMock] = useState(!credentialsPresent)
  const tokenClientRef = useRef(null)
  const resolveAuthRef = useRef(null)

  // --- Mock mode ---
  useEffect(() => {
    if (!credentialsPresent) {
      setIsMock(true)
      setReady(true)
      setAuthed(true)
    }
  }, [credentialsPresent])

  // --- Real mode: Init GAPI + GIS ---
  useEffect(() => {
    if (!credentialsPresent) return

    const clientId = localStorage.getItem('gcal_client_id') || ''
    const apiKey = localStorage.getItem('gcal_api_key') || ''

    const initGapi = () => new Promise((resolve, reject) => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({ apiKey, discoveryDocs: [DISCOVERY_DOC] })
          resolve()
        } catch (e) {
          reject(e)
        }
      })
    })

    const initGis = () => {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) {
            setError(resp.error)
            resolveAuthRef.current?.(false)
            return
          }
          // Persist token expiry so we know when to refresh
          localStorage.setItem('gcal_token_expiry', Date.now() + (resp.expires_in * 1000))
          setAuthed(true)
          resolveAuthRef.current?.(true)
        },
      })
    }

    const init = async () => {
      try {
        console.log('[gcal] initialising with clientId:', clientId.slice(0, 20) + '...')
        await initGapi()
        console.log('[gcal] GAPI ready')
        initGis()
        console.log('[gcal] GIS ready')
        setIsMock(false)
        setReady(true)
        // Try silent token refresh on load (no prompt)
        tokenClientRef.current.requestAccessToken({ prompt: '' })
        if (window.gapi.client.getToken()) setAuthed(true)
      } catch (e) {
        console.warn('[gcal] init failed, falling back to mock:', e)
        setIsMock(true)
        setReady(true)
        setAuthed(true)
        setError('Google API init failed — running in demo mode')
      }
    }

    const loadScript = (src) => new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })

    const waitForScripts = async () => {
      try {
        await loadScript('https://apis.google.com/js/api.js')
        await loadScript('https://accounts.google.com/gsi/client')
        init()
      } catch (e) {
        console.warn('Failed to load Google scripts, falling back to mock:', e)
        setIsMock(true)
        setReady(true)
        setAuthed(true)
      }
    }

    waitForScripts()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(() => {
    if (isMock) return Promise.resolve(true)
    // If we already have a valid token, resolve immediately
    const existing = window.gapi?.client?.getToken()
    if (existing?.access_token) return Promise.resolve(true)
    return new Promise((resolve) => {
      resolveAuthRef.current = resolve
      if (!tokenClientRef.current) { resolve(false); return }
      // Always use consent prompt to ensure we get a fresh token
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' })
    })
  }, [isMock])

  const signOut = useCallback(() => {
    if (isMock) return
    const token = window.gapi.client.getToken()
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token)
      window.gapi.client.setToken('')
    }
    setAuthed(false)
  }, [isMock])

  const listRooms = useCallback(async () => {
    if (isMock) return MOCK_ROOMS
    const res = await window.gapi.client.calendar.calendarList.list({ minAccessRole: 'reader' })
    return res.result.items || []
  }, [isMock])

  const getTodayEvents = useCallback(async (calendarId) => {
    if (isMock) return getMockEvents()
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const res = await window.gapi.client.calendar.events.list({
      calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })
    return res.result.items || []
  }, [isMock])

  const bookRoom = useCallback(async (calendarId, { title, startTime, durationMinutes }) => {
    if (isMock) {
      console.log('[mock] Booked:', { title, startTime, durationMinutes })
      return { id: `mock-booked-${Date.now()}`, summary: title }
    }
    const token = window.gapi.client.getToken()
    console.log('[gcal] bookRoom token present:', !!token)
    if (!token) throw new Error('Not authenticated — no OAuth token')
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000)
    const res = await window.gapi.client.calendar.events.insert({
      calendarId,
      resource: {
        summary: title,
        start: { dateTime: startTime.toISOString() },
        end:   { dateTime: endTime.toISOString() },
      },
    })
    return res.result
  }, [isMock])

  return { ready, authed, error, isMock, signIn, signOut, listRooms, getTodayEvents, bookRoom }
}
