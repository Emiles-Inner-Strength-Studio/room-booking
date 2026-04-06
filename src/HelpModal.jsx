import { useAutoClose } from './useAutoClose'
import TimerCloseButton from './TimerCloseButton'

export default function HelpModal({ onClose, roomName }) {
  useAutoClose(onClose)
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <div className="bg-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">

        <div className="px-8 pt-8 pb-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-white text-2xl font-bold">How to use</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center">×</button>
        </div>

        <div className="px-8 py-6 space-y-6">

          <div className="flex gap-4 items-start">
            <span className="text-2xl mt-0.5">📅</span>
            <div>
              <p className="text-white font-semibold text-lg">Booking a room</p>
              <p className="text-slate-400 mt-1">When the room is free, tap <span className="text-white font-medium">Book Now</span>. Enter a name and choose a duration. The booking will appear on your calendar.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <span className="text-2xl mt-0.5">👤</span>
            <div>
              <p className="text-white font-semibold text-lg">Sign-in account</p>
              <p className="text-slate-400 mt-1">Sign in with a <span className="text-white font-medium">shared or generic Google account</span> — not a personal one. This account stays signed in on the display.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <span className="text-2xl mt-0.5">🚪</span>
            <div>
              <p className="text-white font-semibold text-lg">Adding a new room</p>
              <p className="text-slate-400 mt-1">To add a room to the selector, share the room's Google Calendar resource with the signed-in account. It will then appear in Settings → Room.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <span className="text-2xl mt-0.5">⚙️</span>
            <div>
              <p className="text-white font-semibold text-lg">Settings</p>
              <p className="text-slate-400 mt-1">Tap the gear icon at the bottom to change the room or refresh the calendar.</p>
            </div>
          </div>

        </div>

        <div className="px-8 pb-8">
          <TimerCloseButton onClick={onClose}>Got it</TimerCloseButton>
        </div>
      </div>
    </div>
  )
}
