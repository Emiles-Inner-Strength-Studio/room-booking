/**
 * useGoogleCalendar — hook for Google Calendar API access
 *
 * Two modes:
 *  1. Service account (backend): auto-detected via /api/health — no sign-in needed
 *  2. GAPI + GIS (client-side): full redirect OAuth, silent refresh every 30min
 *
 * The hook auto-detects which mode to use on init.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getMockEvents, MOCK_ROOMS } from './mockData'

const SCOPES = 'https://www.googleapis.com/auth/calendar'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
const TOKEN_KEY = 'gcal_token'
const REFRESH_INTERVAL_MS = 30 * 60 * 1000 // refresh every 30 min

const DEFAULT_API_KEY = 'AIzaSyDP9bt-G0tgBNWGIoxYMV7vNxx-lT3I4JM'
const DEFAULT_CLIENT_ID = '961612899421-hkrid21kugiikch6lul2kuqo004ekj6p.apps.googleusercontent.com'

const getClientId = () => localStorage.getItem('gcal_client_id') || DEFAULT_CLIENT_ID
const getApiKey = () => localStorage.getItem('gcal_api_key') || DEFAULT_API_KEY

const REDIRECT_URI = window.location.origin + window.location.pathname.replace(/\/$/, '')

function buildAuthUrl(clientId, prompt = 'select_account') {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    prompt,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
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
    return { access_token, expiry, msLeft: expiry - Date.now(), expired: Date.now() > expiry }
  } catch { return null }
}

function clearSavedToken() {
  localStorage.removeItem(TOKEN_KEY)
}

let refreshTimer = null

// ── Backend (service account) API helpers ──

const getApiKeyHeader = () => {
  const key = localStorage.getItem('gcal_api_key_backend')
  return key ? { Authorization: `Bearer ${key}` } : {}
}

async function backendListRooms() {
  const res = await fetch('/api/rooms', { headers: getApiKeyHeader() })
  if (!res.ok) throw new Error(`rooms: ${res.status}`)
  return res.json()
}

async function backendGetTodayEvents(calendarId) {
  const res = await fetch(`/api/events?calendarId=${encodeURIComponent(calendarId)}`, {
    headers: getApiKeyHeader(),
  })
  if (!res.ok) throw new Error(`events: ${res.status}`)
  return res.json()
}

async function backendBookRoom(calendarId, { title, startTime, durationMinutes }) {
  const res = await fetch('/api/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getApiKeyHeader() },
    body: JSON.stringify({ calendarId, title, startTime: startTime.toISOString(), durationMinutes }),
  })
  if (!res.ok) throw new Error(`book: ${res.status}`)
  return res.json()
}

async function detectBackend() {
  if (localStorage.getItem('gcal_force_sso') === '1') return false
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const data = await res.json()
      return data.ok === true
    }
  } catch { /* backend not available */ }
  return false
}

// ── Hook ──

export function useGoogleCalendar() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [isMock] = useState(false)
  const [isBackend, setIsBackend] = useState(false)
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

    const scheduleNextRefresh = (silentRefreshFn) => {
      if (refreshTimer) clearInterval(refreshTimer)
      refreshTimer = setInterval(silentRefreshFn, REFRESH_INTERVAL_MS)
      console.log('[gcal] refresh interval set: every 30min')
    }

    const init = async () => {
      // Try backend (service account) first
      const hasBackend = await detectBackend()
      if (hasBackend) {
        console.log('[gcal] backend detected — using service account mode')
        setIsBackend(true)
        setAuthed(true)
        setReady(true)
        return
      }

      // Fall back to GAPI + GIS client-side auth
      console.log('[gcal] no backend — using client-side GAPI auth')
      try {
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

        await loadScript('https://accounts.google.com/gsi/client')

        const silentRefresh = () => {
          if (!tokenClientRef.current) return
          console.log('[gcal] silent background refresh...')
          tokenClientRef.current.requestAccessToken({ prompt: '' })
        }

        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: (resp) => {
            if (resp.error) {
              console.warn('[gcal] silent refresh failed:', resp.error)
              if (resp.error === 'interaction_required' || resp.error === 'login_required') {
                setNeedsReconnect(true)
                console.log('[gcal] org session expired — reconnect banner shown')
              }
              return
            }
            window.gapi.client.setToken({ access_token: resp.access_token })
            saveToken({ access_token: resp.access_token, expires_in: resp.expires_in })
            setAuthed(true)
            setNeedsReconnect(false)
            console.log('[gcal] token refreshed silently, expires in', resp.expires_in, 's')
          },
        })

        const hash = new URLSearchParams(window.location.hash.slice(1))
        const accessToken = hash.get('access_token')
        const expiresIn = hash.get('expires_in')
        if (accessToken) {
          window.history.replaceState(null, '', window.location.pathname)
          window.gapi.client.setToken({ access_token: accessToken })
          saveToken({ access_token: accessToken, expires_in: Number(expiresIn) || 3600 })
          setAuthed(true)
          setNeedsReconnect(false)
          scheduleNextRefresh(silentRefresh)
          console.log('[gcal] signed in via redirect')
        } else {
          const saved = loadSavedToken()
          if (saved) {
            window.gapi.client.setToken({ access_token: saved.access_token })
            setAuthed(true)
            console.log('[gcal] token restored,', Math.round(saved.msLeft / 60000), 'min remaining')
            silentRefresh()
          } else {
            console.log('[gcal] no saved token')
          }
          scheduleNextRefresh(silentRefresh)
        }

        setReady(true)
        console.log('[gcal] ready')
      } catch (e) {
        console.error('[gcal] init failed:', e)
        setError('Google API init failed')
        setReady(true)
      }
    }

    init()
    return () => { if (refreshTimer) clearInterval(refreshTimer) }
  }, [])

  const signIn = useCallback(() => {
    if (isBackend) return Promise.resolve() // no-op in backend mode
    window.location.href = buildAuthUrl(getClientId(), 'select_account')
    return new Promise(() => {})
  }, [isBackend])

  const signOut = useCallback(() => {
    if (isBackend) return // no-op in backend mode
    const token = window.gapi?.client?.getToken()
    if (token?.access_token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token.access_token)
      window.gapi.client.setToken('')
    }
    clearSavedToken()
    if (refreshTimer) clearInterval(refreshTimer)
    setAuthed(false)
    setNeedsReconnect(false)
  }, [isBackend])

  const listRooms = useCallback(async () => {
    if (isMock) return MOCK_ROOMS
    if (isBackend) return backendListRooms()
    const res = await window.gapi.client.calendar.calendarList.list({ minAccessRole: 'reader' })
    return res.result.items || []
  }, [isMock, isBackend])

  const getTodayEvents = useCallback(async (calendarId) => {
    if (isMock) return getMockEvents()
    if (isBackend) return backendGetTodayEvents(calendarId)
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
  }, [isMock, isBackend])

  const bookRoom = useCallback(async (calendarId, { title, startTime, durationMinutes }) => {
    if (isMock) {
      console.log('[mock] Booked:', { title, startTime, durationMinutes })
      return { id: `mock-booked-${Date.now()}`, summary: title }
    }
    if (isBackend) return backendBookRoom(calendarId, { title, startTime, durationMinutes })
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
  }, [isMock, isBackend])

  return { ready, authed, needsReconnect, error, isMock, isBackend, signIn, signOut, listRooms, getTodayEvents, bookRoom }
}
