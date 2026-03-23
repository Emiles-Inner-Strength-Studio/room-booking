import { useState, useEffect, useCallback, useRef } from 'react'
import { useGoogleCalendar } from './useGoogleCalendar'
import { useClock } from './useClock'
import SettingsModal from './SettingsModal'
import BookingModal from './BookingModal'
import HelpModal from './HelpModal'
import { MOCK_ROOM_NAME } from './mockData'

const REFRESH_INTERVAL = 30000
const POST_BOOK_RAPID_INTERVAL = 1000
const POST_BOOK_RAPID_DURATION = 15000
const OPTIMISTIC_IN_USE_DURATION = 15000

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
  const upcoming = events.filter(e => new Date(e.start.dateTime || e.start.date) > now)
  return { current, upcoming }
}

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

export default function App() {
  const gcal = useGoogleCalendar()
  const now = useClock()
  const [events, setEvents] = useState([])
  const [roomId, setRoomId] = useState(localStorage.getItem('gcal_room_id') || '')
  const [roomName, setRoomName] = useState(localStorage.getItem('gcal_room_name') || MOCK_ROOM_NAME)
  const [showSettings, setShowSettings] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [optimisticInUse, setOptimisticInUse] = useState(null)
  const refreshIntervalRef = useRef(null)

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

  const startRefreshCycle = useCallback((rapid = false) => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    if (rapid) {
      refreshIntervalRef.current = setInterval(loadEvents, POST_BOOK_RAPID_INTERVAL)
      setTimeout(() => startRefreshCycle(false), POST_BOOK_RAPID_DURATION)
    } else {
      refreshIntervalRef.current = setInterval(loadEvents, REFRESH_INTERVAL)
    }
  }, [loadEvents])

  useEffect(() => {
    loadEvents()
    startRefreshCycle(false)
    return () => clearInterval(refreshIntervalRef.current)
  }, [loadEvents, startRefreshCycle])

  const handleBook = async ({ title, startTime, durationMinutes }) => {
    const until = new Date(startTime.getTime() + OPTIMISTIC_IN_USE_DURATION)
    setOptimisticInUse({ title, until })
    setTimeout(() => setOptimisticInUse(null), OPTIMISTIC_IN_USE_DURATION)
    await gcal.bookRoom(roomId, { title, startTime, durationMinutes })
    await loadEvents()
    startRefreshCycle(true)
  }

  const { current, upcoming } = getCurrentAndNext(events, now)
  const effectiveCurrent = optimisticInUse && now < optimisticInUse.until
    ? { summary: optimisticInUse.title, _optimistic: true }
    : current
  const isFree = !effectiveCurrent
  const nextEvent = upcoming[0]
  const nextStart = nextEvent ? new Date(nextEvent.start.dateTime || nextEvent.start.date) : null
  const timeUntilNext = nextStart ? nextStart - now : null
  const currentEnd = effectiveCurrent && !effectiveCurrent._optimistic
    ? new Date(effectiveCurrent.end.dateTime || effectiveCurrent.end.date)
    : null
  const timeRemaining = currentEnd ? currentEnd - now : null

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-white overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-7 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{roomName || 'Room Booking'}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="text-4xl font-light tabular-nums text-slate-200">{formatTime(now)}</div>
      </div>

      {/* Not signed in */}
      {!gcal.authed ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
          <div className="text-center space-y-3">
            <p className="text-slate-200 text-2xl font-semibold">Connect to Google Calendar</p>
            <p className="text-slate-500 text-base">Sign in to view and book this room</p>
          </div>
          <button
            onClick={() => gcal.signIn()}
            className="flex items-center gap-3 bg-white text-slate-900 font-bold px-8 py-4 rounded-2xl text-xl shadow-lg hover:bg-slate-100 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
            Sign in with Google
          </button>
          {gcal.error && <p className="text-red-400 text-base">{gcal.error}</p>}
        </div>
      ) : (
        /* Two-column layout */
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT — Availability */}
          <div className={`w-2/3 flex flex-col p-8 border-r border-slate-800 ${isFree ? 'bg-green-500/5' : 'bg-red-500/5'}`}>

            {/* Big status */}
            <div className="flex-1 flex flex-col justify-center">
              <div className={`text-7xl font-extrabold tracking-tight leading-none ${isFree ? 'text-green-400' : 'text-red-400'}`}>
                {isFree ? 'Available' : 'In Use'}
              </div>

              <div className="mt-6 space-y-1">
                {isFree ? (
                  <>
                    <p className="text-slate-300 text-xl">
                      {nextStart
                        ? `Free until ${formatTime(nextStart)}`
                        : 'Free for the rest of the day'}
                    </p>
                    {timeUntilNext && (
                      <p className="text-slate-500 text-lg">{formatDuration(timeUntilNext)} from now</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-white text-4xl font-bold mt-2">{effectiveCurrent.summary}</p>
                    {effectiveCurrent._optimistic ? (
                      <p className="text-slate-400 text-xl mt-2">Just booked</p>
                    ) : (
                      <>
                        <p className="text-slate-400 text-xl mt-2">Until {formatTime(currentEnd)}</p>
                        <p className="text-slate-500 text-lg">{formatDuration(timeRemaining)} remaining</p>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Book Now */}
            {isFree && (
              <button
                onClick={() => setShowBooking(true)}
                className="w-full bg-green-500 hover:bg-green-400 active:bg-green-600 text-white font-bold py-6 rounded-2xl text-2xl transition-colors shadow-xl mt-6"
              >
                Book Now
              </button>
            )}
          </div>

          {/* RIGHT — Schedule */}
          <div className="w-1/3 flex flex-col overflow-hidden">
            <div className="px-8 pt-7 pb-3">
              <h2 className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Today's Schedule</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {loading && events.length === 0 ? (
                <div className="text-slate-500 text-base text-center py-10">Loading...</div>
              ) : events.length === 0 ? (
                <div className="text-slate-500 text-base text-center py-10">
                  {roomId ? 'No meetings today' : 'Select a room in Settings ⚙️'}
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map(event => {
                    const start = new Date(event.start.dateTime || event.start.date)
                    const end = new Date(event.end.dateTime || event.end.date)
                    const isPast = end < now
                    const isNow = start <= now && end > now
                    return (
                      <div
                        key={event.id}
                        className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all ${
                          isNow ? 'bg-red-500/10 border-red-500/30'
                          : isPast ? 'bg-slate-800/20 border-slate-700/20 opacity-35'
                          : 'bg-slate-800/50 border-slate-700/30'
                        }`}
                      >
                        <div className="text-right min-w-[4.5rem]">
                          <div className={`text-sm font-semibold ${isNow ? 'text-red-300' : 'text-slate-300'}`}>{formatTime(start)}</div>
                          <div className="text-xs text-slate-500">{formatTime(end)}</div>
                        </div>
                        <div className={`w-0.5 h-10 rounded-full flex-shrink-0 ${isNow ? 'bg-red-500' : 'bg-slate-600'}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-base font-medium truncate ${isNow ? 'text-white' : 'text-slate-200'}`}>{event.summary}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{formatDuration(end - start)}</div>
                        </div>
                        {isNow && <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-slate-800 flex justify-between items-center">
              <span className="text-slate-700 text-xs">
                {lastRefresh ? `Updated ${formatTime(lastRefresh)}` : ''}
              </span>
              <div className="flex items-center gap-4">
                <button onClick={() => setShowHelp(true)} className="text-slate-600 hover:text-slate-400 transition-colors p-1" title="Help">
                  <HelpIcon />
                </button>
                <button onClick={() => setShowSettings(true)} className="text-slate-600 hover:text-slate-400 transition-colors p-1" title="Settings">
                  <GearIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal gcal={gcal} onClose={() => setShowSettings(false)} onSave={(id, name) => { setRoomId(id); setRoomName(name) }} onRefresh={loadEvents} />
      )}
      {showBooking && (
        <BookingModal startTime={now} onClose={() => setShowBooking(false)} onConfirm={handleBook} />
      )}
      {showHelp && (
        <HelpModal roomName={roomName} onClose={() => setShowHelp(false)} />
      )}
    </div>
  )
}
