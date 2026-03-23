/**
 * useGoogleCalendar — hook for Google Calendar API access via GAPI + GIS
 *
 * Falls back to mock data when credentials aren't configured.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getMockEvents, MOCK_ROOMS } from './mockData'

const SCOPES = 'https://www.googleapis.com/auth/calendar'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
const REDIRECT_URI = window.location.origin + window.location.pathname

const DEFAULT_API_KEY = 'AIzaSyDP9bt-G0tgBNWGIoxYMV7vNxx-lT3I4JM'
const DEFAULT_CLIENT_ID = '961612899421-hkrid21kugiikch6lul2kuqo004ekj6p.apps.googleusercontent.com'

const getClientId = () => localStorage.getItem('gcal_client_id') || DEFAULT_CLIENT_ID
const getApiKey = () => localStorage.getItem('gcal_api_key') || DEFAULT_API_KEY

export function useGoogleCalendar() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [isMock] = useState(false) // always use real credentials
  const [error, setError] = useState(null)
  const tokenClientRef = useRef(null)
  const resolveAuthRef = useRef(null)

  useEffect(() => {
    const clientId = getClientId()
    const apiKey = getApiKey()

    const loadScript = (src) => new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
      const s = document.createElement('script')
      s.src = src; s.async = true
      s.onload = resolve; s.onerror = reject
      document.head.appendChild(s)
    })

    const init = async () => {
      try {
        await loadScript('https://apis.google.com/js/api.js')
        await loadScript('https://accounts.google.com/gsi/client')

        // Init GAPI client
        await new Promise((resolve, reject) => {
          window.gapi.load('client', async () => {
            try {
              await window.gapi.client.init({ apiKey, discoveryDocs: [DISCOVERY_DOC] })
              resolve()
            } catch (e) { reject(e) }
          })
        })

        // Init GIS code client (redirect flow — no popup)
        tokenClientRef.current = window.google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: SCOPES,
          ux_mode: 'redirect',
          redirect_uri: REDIRECT_URI,
          state: 'gcal_auth',
        })

        // Check if we're returning from an OAuth redirect
        // GIS redirect flow returns an auth code in the URL — exchange it for a token
        // For implicit/token flow we use a different approach: store token in sessionStorage
        // Actually for pure browser use, use token flow with redirect instead
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          ux_mode: 'redirect',
          redirect_uri: REDIRECT_URI,
          callback: (resp) => {
            if (resp.error) {
              setError(resp.error)
              resolveAuthRef.current?.(false)
              return
            }
            setAuthed(true)
            resolveAuthRef.current?.(true)
          },
        })

        // Handle return from OAuth redirect — token is in URL hash
        const hash = new URLSearchParams(window.location.hash.slice(1))
        const accessToken = hash.get('access_token')
        if (accessToken) {
          window.gapi.client.setToken({ access_token: accessToken })
          setAuthed(true)
          // Clean the token from the URL
          window.history.replaceState(null, '', window.location.pathname)
          console.log('[gcal] token restored from redirect')
        }

        setReady(true)
        console.log('[gcal] ready')
      } catch (e) {
        console.error('[gcal] init failed:', e)
        setError('Google API init failed')
      }
    }

    init()
  }, [])

  const signIn = useCallback(() => {
    // Already have a token in memory
    const existing = window.gapi?.client?.getToken()
    if (existing?.access_token) return Promise.resolve(true)
    if (!tokenClientRef.current) return Promise.resolve(false)
    // Redirect flow — this will navigate away and back
    tokenClientRef.current.requestAccessToken({ prompt: '' })
    // Returns a never-resolving promise since we're redirecting
    return new Promise(() => {})
  }, [])

  const signOut = useCallback(() => {
    const token = window.gapi?.client?.getToken()
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token)
      window.gapi.client.setToken('')
    }
    setAuthed(false)
  }, [])

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
    // Ensure we have an OAuth token
    if (!window.gapi?.client?.getToken()?.access_token) {
      const ok = await new Promise((resolve) => {
        resolveAuthRef.current = resolve
        tokenClientRef.current?.requestAccessToken({ prompt: '' })
      })
      if (!ok) throw new Error('Sign-in required to book')
    }
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000)
    const res = await window.gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: {
        summary: title,
        start: { dateTime: startTime.toISOString() },
        end:   { dateTime: endTime.toISOString() },
        attendees: [{ email: calendarId, resource: true }],
      },
    })
    return res.result
  }, [isMock])

  return { ready, authed, error, isMock, signIn, signOut, listRooms, getTodayEvents, bookRoom }
}
