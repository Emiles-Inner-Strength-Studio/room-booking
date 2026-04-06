import { useState } from 'react'
import { generateQrSvg } from './qr'

export default function EventDetailModal({ event, onClose, onCancel }) {
  const start = new Date(event.start.dateTime || event.start.date)
  const end = new Date(event.end.dateTime || event.end.date)
  const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const durationMs = end - start
  const totalMins = Math.round(durationMs / 60000)
  const durationLabel = totalMins < 60
    ? `${totalMins}m`
    : totalMins % 60 === 0
      ? `${totalMins / 60}h`
      : `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`

  const organizer = event.organizer
  const attendees = (event.attendees || []).filter(a => !a.resource && !a.self)
  const isInstantMeeting = event.summary === 'Instant Meeting'
  const [showQr, setShowQr] = useState(false)

  const mailtoUrl = attendees.length > 0
    ? `mailto:${attendees.map(a => a.email).join(',')}?subject=${encodeURIComponent(event.summary || 'Meeting')}`
    : null
  const qrSvg = mailtoUrl ? generateQrSvg(mailtoUrl, { size: 200, fg: '#ffffff', bg: 'transparent' }) : null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8" onClick={onClose}>
      <div className="bg-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-700">
          <div className="flex justify-between items-start">
            <div className="min-w-0 flex-1">
              <h2 className="text-white text-3xl font-bold truncate">{event.summary}</h2>
              <p className="text-slate-400 text-base mt-1">
                {fmt(start)} → {fmt(end)} · {durationLabel}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center flex-shrink-0">×</button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5 max-h-[50vh] overflow-y-auto">

          {/* Organizer */}
          {organizer && (
            <div>
              <label className="text-slate-400 text-sm font-medium uppercase tracking-wide mb-2 block">Organizer</label>
              <div className="flex items-center gap-3 bg-slate-700/50 rounded-2xl px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {(organizer.displayName || organizer.email || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  {organizer.displayName && <p className="text-white text-base font-medium truncate">{organizer.displayName}</p>}
                  <p className="text-slate-400 text-sm truncate">{organizer.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Participants */}
          {attendees.length > 0 && (
            <div>
              <label className="text-slate-400 text-sm font-medium uppercase tracking-wide mb-2 block">
                Participants ({attendees.length})
              </label>
              <div className="space-y-2">
                {attendees.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-700/50 rounded-2xl px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-slate-600 text-slate-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {(a.displayName || a.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      {a.displayName && <p className="text-white text-base font-medium truncate">{a.displayName}</p>}
                      <p className="text-slate-400 text-sm truncate">{a.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      a.responseStatus === 'accepted' ? 'bg-green-500/20 text-green-400'
                      : a.responseStatus === 'declined' ? 'bg-red-500/20 text-red-400'
                      : a.responseStatus === 'tentative' ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-slate-600 text-slate-400'
                    }`}>
                      {a.responseStatus === 'accepted' ? 'Accepted'
                        : a.responseStatus === 'declined' ? 'Declined'
                        : a.responseStatus === 'tentative' ? 'Maybe'
                        : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!organizer && attendees.length === 0 && (
            <p className="text-slate-500 text-base text-center py-4">No participant info available</p>
          )}

          {/* QR code for mailto */}
          {showQr && qrSvg && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="bg-slate-700/50 rounded-2xl p-6" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="text-slate-500 text-sm">Scan to email participants</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex gap-4">
          {onCancel && isInstantMeeting && (
            <button
              onClick={() => onCancel(event)}
              className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-2xl py-5 text-xl font-semibold transition-colors"
            >
              Cancel Meeting
            </button>
          )}
          {mailtoUrl && (
            <button
              onClick={() => setShowQr(!showQr)}
              className={`flex-1 rounded-2xl py-5 text-xl font-semibold transition-colors ${
                showQr
                  ? 'bg-transparent text-blue-400 border-2 border-blue-500'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              Email Participants
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-2xl py-5 text-xl font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
