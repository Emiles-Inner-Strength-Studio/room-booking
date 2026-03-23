/**
 * useGoogleCalendar — hook for Google Calendar API access via GAPI + GIS
 *
 * Persists OAuth token in localStorage so sign-in survives page reloads.
 * Silently refreshes expired tokens via redirect (no prompt).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getMockEvents, MOCK_ROOMS } from './mockData'

const SCOPES = 'https://www.googleapis.com/auth/calendar'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
const REDIRECT_URI = window.location.origin + window.location.pathname
const TOKEN_KEY = 'gcal_token'

const DEFAULT_API_KEY = 'AIzaSyDP9bt-G0tgBNWGIoxYMV7vNxx-lT3I4JM'
const DEFAULT_CLIENT_ID = '961612899421-hkrid21kugiikch6lul2kuqo004ekj6p.apps.googleusercontent.com'

const getClientId = () => localStorage.getItem('gcal_client_id') || DEFAULT_CLIENT_ID
const getApiKey = () => localStorage.getItem('gcal_api_key') || DEFAULT_API_KEY

let refreshTimer = null

function scheduleRefresh(expiresIn, refreshFn) {
  if (refreshTimer) clearTimeout(refreshTimer)
  // Refresh 5 minutes before expiry (or immediately if already close)
  const delay = Math.max((Number(expiresIn) - 300) * 1000, 10000)
  console.log(`[gcal] token refresh scheduled in ${Math.round(delay / 60000)}m`)
  refreshTimer = setTimeout(refreshFn, delay)
}

function saveToken({ access_token, expires_in }) {
  const expiry = Date.now() + (Number(expires_in) || 3600) * 1000
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token, expiry }))
}

function loadSavedToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const { access_token, expiry } = JSON.parse(raw)
    const msLeft = expiry - Date.now()
    return { access_token, expiry, msLeft, expired: msLeft <= 0 }
  } catch { return null }
}

function clearSavedToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function useGoogleCalendar() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [isMock] = useState(false)
  const [error, setError] = useState(null)
  const tokenClientRef = useRef(null)

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

        await new Promise((resolve, reject) => {
          window.gapi.load('client', async () => {
            try {
              await window.gapi.client.init({ apiKey, discoveryDocs: [DISCOVERY_DOC] })
              resolve()
            } catch (e) { reject(e) }
          })
        })

        const silentRefresh = () => {
          console.log('[gcal] attempting silent token refresh...')
          tokenClientRef.current?.requestAccessToken({ prompt: '' })
        }

        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: (resp) => {
            if (resp.error) {
              console.warn('[gcal] token refresh failed:', resp.error)
              // Only clear authed if it's not just a transient error
              if (resp.error === 'interaction_required' || resp.error === 'login_required') {
                setAuthed(false)
                clearSavedToken()
              }
              return
            }
            window.gapi.client.setToken({ access_token: resp.access_token })
            saveToken({ access_token: resp.access_token, expires_in: resp.expires_in })
            setAuthed(true)
            scheduleRefresh(resp.expires_in, silentRefresh)
            console.log('[gcal] token refreshed, expires in', resp.expires_in, 's')
          },
        })

        // Try restoring a saved token
        const saved = loadSavedToken()
        if (saved) {
          // Always restore the token into GAPI (even if expired) so API calls
          // that happen before the silent refresh completes don't hard-fail
          window.gapi.client.setToken({ access_token: saved.access_token })
          setAuthed(true)

          if (saved.expired) {
            // Token expired — attempt silent refresh immediately (no prompt)
            console.log('[gcal] saved token expired, attempting silent refresh...')
            silentRefresh()
          } else {
            const remaining = Math.max(saved.msLeft / 1000, 0)
            scheduleRefresh(remaining, silentRefresh)
            console.log('[gcal] token restored,', Math.round(remaining / 60), 'min remaining')
          }
        } else {
          console.log('[gcal] no saved token — sign-in required')
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
    const existing = window.gapi?.client?.getToken()
    if (existing?.access_token) return Promise.resolve(true)
    if (!tokenClientRef.current) return Promise.resolve(false)
    // Popup flow — callback sets authed state
    tokenClientRef.current.requestAccessToken({ prompt: '' })
    return Promise.resolve(true)
  }, [])

  const signOut = useCallback(() => {
    const token = window.gapi?.client?.getToken()
    if (token?.access_token) {
      window.google.accounts.oauth2.revoke(token.access_token)
      window.gapi.client.setToken('')
    }
    clearSavedToken()
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
    if (!window.gapi?.client?.getToken()?.access_token) {
      tokenClientRef.current?.requestAccessToken({ prompt: '' })
      throw new Error('Re-authenticating — please try again in a moment')
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
