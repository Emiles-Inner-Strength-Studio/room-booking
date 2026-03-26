/**
 * useGoogleCalendar — hook for Google Calendar API access via GAPI + GIS
 *
 * Auth strategy:
 *  - Initial sign-in: full redirect (works in lockdown browsers)
 *  - Background refresh: GIS initTokenClient prompt:'' (hidden iframe, no navigation)
 *  - Org session expiry: non-blocking reconnect banner (authed stays true, UI stays up)
 *  - Refresh frequency: every 30 minutes regardless of token expiry
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

export function useGoogleCalendar() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [needsReconnect, setNeedsReconnect] = useState(false) // non-blocking banner
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

    const scheduleNextRefresh = (silentRefreshFn) => {
      if (refreshTimer) clearInterval(refreshTimer)
      // Refresh every 30 minutes — well within typical token lifetimes
      refreshTimer = setInterval(silentRefreshFn, REFRESH_INTERVAL_MS)
      console.log('[gcal] refresh interval set: every 30min')
    }

    const init = async () => {
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

        // GIS token client for SILENT background refresh only (no redirect, uses hidden iframe)
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
                // Org session expired — show reconnect banner but keep UI up
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

        // Handle token returned from redirect sign-in
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
            // Always start a silent refresh immediately on load (checks if org session still active)
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

  // Full redirect sign-in (for lockdown browsers / reconnect after org session expiry)
  const signIn = useCallback(() => {
    window.location.href = buildAuthUrl(getClientId(), 'select_account')
    return new Promise(() => {})
  }, [])

  const signOut = useCallback(() => {
    const token = window.gapi?.client?.getToken()
    if (token?.access_token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token.access_token)
      window.gapi.client.setToken('')
    }
    clearSavedToken()
    if (refreshTimer) clearInterval(refreshTimer)
    setAuthed(false)
    setNeedsReconnect(false)
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

  return { ready, authed, needsReconnect, error, isMock, signIn, signOut, listRooms, getTodayEvents, bookRoom }
}
