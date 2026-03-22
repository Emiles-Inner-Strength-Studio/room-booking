import { useState } from 'react'

const DURATIONS = [15, 30, 45, 60, 90, 120]

export default function BookingModal({ onClose, onConfirm, startTime }) {
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleConfirm = async () => {
    if (!title.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onConfirm({ title: title.trim(), startTime, durationMinutes: duration })
      onClose()
    } catch (e) {
      setError(e.message || 'Booking failed')
    }
    setLoading(false)
  }

  const endTime = new Date(startTime.getTime() + duration * 60000)
  const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-6">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
        <h2 className="text-white text-xl font-semibold">Book This Room</h2>

        <div className="text-slate-300 text-sm">
          Starting now · {fmt(startTime)} → {fmt(endTime)}
        </div>

        {/* Title */}
        <div>
          <label className="text-slate-400 text-sm mb-1 block">Meeting name</label>
          <input
            autoFocus
            className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            placeholder="e.g. Team standup"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="text-slate-400 text-sm mb-2 block">Duration</label>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                  duration === d
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {d < 60 ? `${d}m` : `${d / 60}h`}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl py-3 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!title.trim() || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-3 font-medium transition-colors"
          >
            {loading ? 'Booking...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
