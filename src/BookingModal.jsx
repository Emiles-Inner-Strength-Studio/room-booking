import { useState, useRef, useEffect } from 'react'
import { useAutoClose } from './useAutoClose'
import TimerCloseButton from './TimerCloseButton'

const DURATIONS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h',  minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h',  minutes: 120 },
]

function formatDurationLabel(mins) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function BookingModal({ onClose, onConfirm, startTime, maxEnd }) {
  const maxMinutes = maxEnd ? Math.floor((maxEnd - startTime) / 60000) : null

  const DEFAULT_DURATION = 30
  const hasUntilNextPreset = maxMinutes != null && !DURATIONS.some(d => d.minutes === maxMinutes) && maxMinutes >= 5
  const defaultAvailable = maxMinutes == null || DEFAULT_DURATION <= maxMinutes
  const isConstrained = hasUntilNextPreset && !defaultAvailable

  useAutoClose(onClose)

  const [title, setTitle] = useState('Instant Meeting')
  const [duration, setDuration] = useState(defaultAvailable ? DEFAULT_DURATION : (hasUntilNextPreset ? maxMinutes : DEFAULT_DURATION))
  const [customMinutes, setCustomMinutes] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const customInputRef = useRef(null)

  useEffect(() => {
    if (showCustom) {
      const timer = setTimeout(() => customInputRef.current?.focus(), 300)
      return () => clearTimeout(timer)
    }
  }, [showCustom])

  const effectiveDuration = showCustom
    ? Math.min(parseInt(customMinutes) || 0, maxMinutes ?? Infinity)
    : Math.min(duration, maxMinutes ?? Infinity)

  const endTime = new Date(startTime.getTime() + effectiveDuration * 60000)

  const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const handleConfirm = async () => {
    if (!title.trim() || effectiveDuration < 5) return
    setLoading(true)
    setError(null)
    try {
      await onConfirm({ title: title.trim(), startTime, durationMinutes: effectiveDuration })
      onClose()
    } catch (e) {
      setError(e.message || 'Booking failed — please try again')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <div className="bg-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-white text-3xl font-bold">Book This Room</h2>
              <p className="text-slate-400 text-base mt-1">
                {fmt(startTime)} → {fmt(endTime)} · {effectiveDuration}m
              </p>
            </div>
            <TimerCloseButton onClick={onClose} />
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Title */}
          <div>
            <label className="text-slate-400 text-sm font-medium uppercase tracking-wide mb-2 block">Meeting name</label>
            <input
              className="w-full bg-slate-700 text-white rounded-2xl px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="Meeting name"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="text-slate-400 text-sm font-medium uppercase tracking-wide mb-3 block">Duration</label>
            <div className="grid grid-cols-3 gap-3">
              {DURATIONS.map(d => {
                const disabled = maxMinutes != null && d.minutes > maxMinutes
                return (
                  <button
                    key={d.minutes}
                    onClick={() => { if (!disabled) { setDuration(d.minutes); setShowCustom(false) } }}
                    disabled={disabled}
                    className={`py-4 rounded-2xl text-lg font-semibold transition-colors border-2 ${
                      disabled
                        ? 'bg-slate-700/50 text-slate-600 border-transparent cursor-not-allowed'
                        : !showCustom && duration === d.minutes
                          ? 'bg-transparent text-blue-400 border-blue-500'
                          : 'bg-slate-700 text-slate-300 border-transparent hover:bg-slate-600'
                    }`}
                  >
                    {d.label}
                  </button>
                )
              })}
              <div className={`col-span-3 flex items-center transition-all duration-300 ${showCustom ? 'gap-3' : 'gap-0'}`}>
                <button
                  onClick={() => setShowCustom(!showCustom)}
                  className={`py-4 rounded-2xl text-lg font-semibold transition-all duration-300 border-2 ${
                    showCustom
                      ? 'bg-transparent text-blue-400 border-blue-500 w-28 flex-shrink-0'
                      : 'bg-slate-700 text-slate-300 border-transparent hover:bg-slate-600 flex-1'
                  }`}
                >
                  Custom
                </button>
                <div className={`overflow-hidden transition-all duration-300 flex items-center gap-3 ${
                  showCustom ? 'flex-1 opacity-100' : 'w-0 opacity-0'
                }`}>
                  <input
                    ref={customInputRef}
                    type="number"
                    min="5"
                    max={maxMinutes ?? 480}
                    className="w-full bg-slate-700 text-white rounded-2xl px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    value={customMinutes}
                    onChange={e => setCustomMinutes(e.target.value)}
                    placeholder={String(Math.min(60, maxMinutes ?? 60))}
                  />
                  <span className="text-slate-400 text-lg flex-shrink-0">min</span>
                </div>
              </div>
              {hasUntilNextPreset && (
                <button
                  onClick={() => { setDuration(maxMinutes); setShowCustom(false) }}
                  className={`py-4 rounded-2xl text-lg font-semibold transition-colors col-span-3 border-2 ${
                    !showCustom && duration === maxMinutes
                      ? isConstrained ? 'bg-transparent text-amber-400 border-amber-500' : 'bg-transparent text-blue-400 border-blue-500'
                      : isConstrained ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-slate-700 text-slate-300 border-transparent hover:bg-slate-600'
                  }`}
                >
                  {formatDurationLabel(maxMinutes)} — until next meeting
                </button>
              )}
            </div>
          </div>

          {error && <p className="text-red-400 text-base">{error}</p>}
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-2xl py-5 text-xl font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!title.trim() || effectiveDuration < 5 || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-2xl py-5 text-xl font-bold transition-colors"
          >
            {loading ? 'Booking...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
