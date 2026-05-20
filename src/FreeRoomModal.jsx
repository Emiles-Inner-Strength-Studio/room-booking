import { useState, useEffect } from 'react'
import { useAutoClose } from './useAutoClose'
import TimerCloseButton from './TimerCloseButton'

function parseLocation(name) {
  return (name || '').split(/\s*[-–]\s*/)[0].trim()
}

function parseRoomDisplay(raw = '') {
  const parts = raw.split(/\s*[-–]\s*/).map(s => s.trim()).filter(Boolean)
  const last = parts[parts.length - 1] || raw
  const capacityMatch = last.match(/^(.*?)\s*\((\d+)\)\s*$/)
  const displayName = capacityMatch ? capacityMatch[1].trim() : last.replace(/\s*\(\d+\)\s*$/, '').trim()
  const capacity = capacityMatch ? capacityMatch[2] : (raw.match(/\((\d+)\)/) || [])[1] || null
  return { displayName, capacity }
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function FreeRoomModal({ onClose, gcal, currentRoomId, currentRoomName }) {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)

  useAutoClose(onClose)

  const location = parseLocation(currentRoomName)

  useEffect(() => {
    let cancelled = false

    async function findFreeRooms() {
      setLoading(true)
      try {
        const allRooms = await gcal.listRooms()
        // Filter to same location, exclude current room
        const sameLocation = allRooms.filter(r =>
          r.id !== currentRoomId && parseLocation(r.summary) === location
        )

        // Check each room's availability in parallel
        const results = await Promise.all(
          sameLocation.map(async (room) => {
            try {
              const events = await gcal.getEvents(room.id)
              const now = new Date()
              const current = events.find(e => {
                const start = new Date(e.start.dateTime || e.start.date)
                const end = new Date(e.end.dateTime || e.end.date)
                return start <= now && end > now
              })
              const nextEvent = events.find(e => new Date(e.start.dateTime || e.start.date) > now)
              const nextStart = nextEvent ? new Date(nextEvent.start.dateTime || nextEvent.start.date) : null
              return { ...room, isFree: !current, nextStart, currentEvent: current }
            } catch {
              return { ...room, isFree: null, nextStart: null, currentEvent: null }
            }
          })
        )

        if (!cancelled) {
          // Sort: free rooms first, then by how long they're free
          const sorted = results
            .filter(r => r.isFree !== null)
            .sort((a, b) => {
              if (a.isFree && !b.isFree) return -1
              if (!a.isFree && b.isFree) return 1
              // Both free: sort by longest availability
              if (a.isFree && b.isFree) {
                const aUntil = a.nextStart ? a.nextStart.getTime() : Infinity
                const bUntil = b.nextStart ? b.nextStart.getTime() : Infinity
                return bUntil - aUntil
              }
              return 0
            })
          setRooms(sorted)
        }
      } catch (e) {
        console.error('Failed to find free rooms', e)
      }
      if (!cancelled) setLoading(false)
    }

    findFreeRooms()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const freeRooms = rooms.filter(r => r.isFree)
  const busyRooms = rooms.filter(r => !r.isFree)

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <div className="bg-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-white text-3xl font-bold">Find a Free Room</h2>
              <p className="text-slate-400 text-base mt-1">{location}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center">&times;</button>
          </div>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <div className="text-slate-500 text-center py-10">Checking rooms...</div>
          ) : rooms.length === 0 ? (
            <div className="text-slate-500 text-center py-10">No other rooms found at this location</div>
          ) : (
            <div className="space-y-3">
              {freeRooms.length > 0 && (
                <>
                  <p className="text-green-400 text-xs font-semibold uppercase tracking-widest mb-2">Available Now</p>
                  {freeRooms.map(room => {
                    const { displayName, capacity } = parseRoomDisplay(room.summary)
                    return (
                      <div
                        key={room.id}
                        className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-green-500/30 bg-green-500/5"
                      >
                        <div className="w-3 h-3 rounded-full bg-green-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-lg font-semibold truncate">{displayName}</div>
                          <div className="text-slate-400 text-sm">
                            {room.nextStart ? `Free until ${formatTime(room.nextStart)}` : 'Free rest of day'}
                            {capacity && <span className="text-slate-500"> · {capacity} seats</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {busyRooms.length > 0 && (
                <>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-2 mt-6">In Use</p>
                  {busyRooms.map(room => {
                    const { displayName, capacity } = parseRoomDisplay(room.summary)
                    const endTime = room.currentEvent
                      ? new Date(room.currentEvent.end.dateTime || room.currentEvent.end.date)
                      : null
                    return (
                      <div
                        key={room.id}
                        className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-slate-700/30 bg-slate-800/50 opacity-60"
                      >
                        <div className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-300 text-lg font-medium truncate">{displayName}</div>
                          <div className="text-slate-500 text-sm">
                            {endTime ? `Free at ${formatTime(endTime)}` : 'Busy'}
                            {capacity && <span> · {capacity} seats</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {freeRooms.length === 0 && !loading && (
                <div className="text-slate-400 text-center py-4 mt-2">
                  No rooms available right now
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 pt-4">
          <TimerCloseButton onClick={onClose} className="w-full">Close</TimerCloseButton>
        </div>
      </div>
    </div>
  )
}
