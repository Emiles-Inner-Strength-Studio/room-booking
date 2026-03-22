import { useState, useEffect, useCallback, useRef } from 'react'
import { useGoogleCalendar } from './useGoogleCalendar'
import { useClock } from './useClock'
import SettingsModal from './SettingsModal'
import BookingModal from './BookingModal'
import { MOCK_ROOM_NAME } from './mockData'

const REFRESH_INTERVAL = 60000 // 1 min

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms) {
  const totalMins = Math.round(ms / 60000)
  if (totalMins < 60) return `${totalMins}m`
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getCurrentAndNext(events, now) {
  const current = events.find(e => {
    const start = new Date(e.start.dateTime || e.start.date)
    const end = new Date(e.end.dateTime || e.end.date)
    return start <= now && end > now
  })
  const upcoming = events.filter(e => {
    const start = new Date(e.start.dateTime || e.start.date)
    return start > now
  })
  return { current, upcoming }
}

export default function App() {
  const gcal = useGoogleCalendar()
  const now = useClock()
  const [events, setEvents] = useState([])
  const [roomId, setRoomId] = useState(localStorage.getItem('gcal_room_id') || 'mock-room-a')
  const [roomName, setRoomName] = useState(localStorage.getItem('gcal_room_name') || MOCK_ROOM_NAME)
  const [showSettings, setShowSettings] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  // Secret tap counter for settings (tap top-right corner 3x)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef(null)

  const loadEvents = useCallback(async () => {
    if (!gcal.authed || !roomId) return
    setLoading(true)
    try {
      const items = await gcal.getTodayEvents(roomId)
      setEvents(items)
      setLastRefresh(new Date())
    } catch (e) {
      console.error('Failed to load events', e)
    }
    setLoading(false)
  }, [gcal.authed, roomId, gcal.getTodayEvents])

  useEffect(() => {
    loadEvents()
    const interval = setInterval(loadEvents, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [loadEvents])

  // Clear partial/invalid credentials on first load
  useEffect(() => {
    const clientId = localStorage.getItem('gcal_client_id') || ''
    const apiKey = localStorage.getItem('gcal_api_key') || ''
    if ((clientId && clientId.length < 10) || (apiKey && apiKey.length < 10)) {
      localStorage.removeItem('gcal_client_id')
      localStorage.removeItem('gcal_api_key')
    }
  }, [])

  const handleSecretTap = () => {
    tapCountRef.current += 1
    clearTimeout(tapTimerRef.current)
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0 }, 2000)
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0
      setShowSettings(true)
    }
  }

  const { current, upcoming } = getCurrentAndNext(events, now)

  const isFree = !current
  const nextEvent = upcoming[0]
  const nextStart = nextEvent ? new Date(nextEvent.start.dateTime || nextEvent.start.date) : null
  const freeUntil = nextStart
  const timeUntilNext = nextStart ? nextStart - now : null
  const currentEnd = current ? new Date(current.end.dateTime || current.end.date) : null
  const timeRemaining = currentEnd ? currentEnd - now : null

  const handleBook = async ({ title, startTime, durationMinutes }) => {
    // Ensure we have an OAuth token before writing
    if (!gcal.authed) {
      const ok = await gcal.signIn()
      if (!ok) throw new Error('Sign-in required to book')
    }
    await gcal.bookRoom(roomId, { title, startTime, durationMinutes })
    await loadEvents()
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-white overflow-hidden relative">

      {/* Secret settings tap zone — top right */}
      <div className="absolute top-0 right-0 w-20 h-20 z-40" onClick={handleSecretTap} />

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{roomName}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-light tabular-nums">{formatTime(now)}</div>
        </div>
      </div>

      {/* Status banner */}
      <div className={`mx-6 rounded-2xl p-6 transition-colors ${isFree ? 'bg-green-500/20 border border-green-500/40' : 'bg-red-500/20 border border-red-500/40'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-2xl font-bold ${isFree ? 'text-green-400' : 'text-red-400'}`}>
              {isFree ? '● Available' : '● In Use'}
            </div>
            {isFree ? (
              <p className="text-slate-300 mt-1 text-sm">
                {freeUntil ? `Free until ${formatTime(freeUntil)} · ${formatDuration(timeUntilNext)}` : 'Free for the rest of the day'}
              </p>
            ) : (
              <div className="mt-1">
                <p className="text-slate-200 font-medium">{current.summary}</p>
                <p className="text-slate-400 text-sm mt-0.5">
                  Ends {formatTime(currentEnd)} · {formatDuration(timeRemaining)} remaining
                </p>
              </div>
            )}
          </div>
          {isFree && (
            <button
              onClick={() => setShowBooking(true)}
              className="bg-green-500 hover:bg-green-400 active:bg-green-600 text-white font-semibold px-6 py-3 rounded-xl text-base transition-colors shadow-lg"
            >
              Book Now
            </button>
          )}
        </div>
      </div>

      {/* Today's schedule */}
      <div className="flex-1 overflow-y-auto px-6 mt-6">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">Today's Schedule</h2>
        {!gcal.authed ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-slate-400">Not connected to Google Calendar</p>
            <button
              onClick={() => setShowSettings(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-medium"
            >
              Set Up
            </button>
          </div>
        ) : loading && events.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-8">Loading...</div>
        ) : events.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-8">No meetings today</div>
        ) : (
          <div className="space-y-2 pb-6">
            {events.map(event => {
              const start = new Date(event.start.dateTime || event.start.date)
              const end = new Date(event.end.dateTime || event.end.date)
              const isPast = end < now
              const isNow = start <= now && end > now
              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    isNow
                      ? 'bg-red-500/10 border-red-500/30'
                      : isPast
                      ? 'bg-slate-800/30 border-slate-700/30 opacity-40'
                      : 'bg-slate-800/60 border-slate-700/40'
                  }`}
                >
                  <div className="text-right min-w-[4.5rem]">
                    <div className={`text-sm font-medium ${isNow ? 'text-red-300' : 'text-slate-300'}`}>{formatTime(start)}</div>
                    <div className="text-xs text-slate-500">{formatTime(end)}</div>
                  </div>
                  <div className={`w-px h-10 ${isNow ? 'bg-red-500' : 'bg-slate-600'}`} />
                  <div className="flex-1">
                    <div className={`font-medium ${isNow ? 'text-white' : 'text-slate-200'}`}>{event.summary}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{formatDuration(end - start)}</div>
                  </div>
                  {isNow && <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 pb-6 flex justify-between items-center">
        <span className="text-slate-600 text-xs">
          {gcal.isMock
            ? <span className="text-amber-600/70">● Demo mode — tap ×3 top-right to connect Google Calendar</span>
            : lastRefresh ? `Updated ${formatTime(lastRefresh)}` : ''}
        </span>
        <button onClick={loadEvents} className="text-slate-600 hover:text-slate-400 text-xs transition-colors">
          Refresh
        </button>
      </div>

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          gcal={gcal}
          onClose={() => setShowSettings(false)}
          onSave={(id, name) => { setRoomId(id); setRoomName(name); loadEvents() }}
        />
      )}
      {showBooking && (
        <BookingModal
          startTime={now}
          onClose={() => setShowBooking(false)}
          onConfirm={handleBook}
        />
      )}
    </div>
  )
}
