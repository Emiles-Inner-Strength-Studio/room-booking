/**
 * useGoogleCalendar — hook for Google Calendar API access via GAPI + GIS
 *
 * Uses redirect flow (ux_mode: 'redirect') for lockdown browser compatibility.
 * Token returned in URL hash after redirect, persisted to localStorage.
 * Silent refresh attempts on expiry — falls back to full redirect if needed.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getMockEvents, MOCK_ROOMS } from './mockData'

const SCOPES = 'https://www.googleapis.com/auth/calendar'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
const TOKEN_KEY = 'gcal_token'

const DEFAULT_API_KEY = 'AIzaSyDP9bt-G0tgBNWGIoxYMV7vNxx-lT3I4JM'
const DEFAULT_CLIENT_ID = '961612899421-hkrid21kugiikch6lul2kuqo004ekj6p.apps.googleusercontent.com'

const getClientId = () => localStorage.getItem('gcal_client_id') || DEFAULT_CLIENT_ID
const getApiKey = () => localStorage.getItem('gcal_api_key') || DEFAULT_API_KEY

// Redirect URI must be registered in GCP OAuth client as an authorised redirect URI
const REDIRECT_URI = window.location.origin + window.location.pathname.replace(/\/$/, '')

let refreshTimer = null

function scheduleRefresh(expiresIn, refreshFn) {
  if (refreshTimer) clearTimeout(refreshTimer)
  const delay = Math.max((Number(expiresIn) - 300) * 1000, 10000)
  console.log(`[gcal] refresh scheduled in ${Math.round(delay / 60000)}m`)
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

// Build the Google OAuth URL manually for redirect flow
// GIS initTokenClient with ux_mode:'redirect' handles this, but we also
// need to support manual URL construction as fallback
function buildAuthUrl(clientId, prompt = '') {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    ...(prompt && { prompt }),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
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

    const silentRefresh = () => {
      console.log('[gcal] silent refresh via redirect...')
      // prompt='' triggers a silent redirect if session is still active
      window.location.href = buildAuthUrl(clientId, '')
    }

    const init = async () => {
      try {
        // Check for token in URL hash (returning from OAuth redirect)
        const hash = new URLSearchParams(window.location.hash.slice(1))
        const accessToken = hash.get('access_token')
        const expiresIn = hash.get('expires_in')

        await loadScript('https://apis.google.com/js/api.js')

        await new Promise((resolve, reject) => {
          if (!window.gapi) { reject(new Error('gapi script failed to load')); return }
          window.gapi.load('client', async () => {
            try {
              await window.gapi.client.init({ apiKey, discoveryDocs: [DISCOVERY_DOC] })
              resolve()
            } catch (e) { reject(e) }
          })
        })

        // Load GIS for sign-out / revoke only (auth is handled via manual redirect)
        await loadScript('https://accounts.google.com/gsi/client')

        // Check for token in URL hash (returning from OAuth redirect)
        if (accessToken) {
          window.history.replaceState(null, '', window.location.pathname)
          saveToken({ access_token: accessToken, expires_in: Number(expiresIn) || 3600 })
          console.log('[gcal] token received from redirect, expires in', expiresIn, 's')
        }

        // Restore saved token
        const saved = loadSavedToken()
        if (saved) {
          window.gapi.client.setToken({ access_token: saved.access_token })
          setAuthed(true)
          if (saved.expired) {
            console.log('[gcal] saved token expired, silent refresh...')
            silentRefresh()
          } else {
            scheduleRefresh(saved.msLeft / 1000, silentRefresh)
            console.log('[gcal] token restored,', Math.round(saved.msLeft / 60000), 'min remaining')
          }
        } else {
          console.log('[gcal] no saved token')
        }

        // Store silentRefresh ref so tokenClientRef can be used for sign-out
        tokenClientRef.current = { silentRefresh }

        setReady(true)
        console.log('[gcal] ready, redirect_uri:', REDIRECT_URI)
      } catch (e) {
        console.error('[gcal] init failed:', e)
        setError('Google API init failed')
      }
    }

    init()
  }, [])

  const signIn = useCallback(() => {
    const clientId = getClientId()
    // Always use redirect — works in all browsers including lockdown
    window.location.href = buildAuthUrl(clientId, 'select_account')
    return new Promise(() => {}) // navigates away
  }, [])

  const signOut = useCallback(() => {
    const token = window.gapi?.client?.getToken()
    if (token?.access_token && window.google?.accounts?.oauth2) {
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
      throw new Error('Not authenticated — please sign in')
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
