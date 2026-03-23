export default function HelpModal({ onClose, roomName }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <div className="bg-slate-800 rounded-3xl w-full max-w-xl p-8 space-y-6 shadow-2xl">
        <div className="flex justify-between items-center">
          <h2 className="text-white text-2xl font-bold">How to use</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center">×</button>
        </div>

        <div className="space-y-5">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-green-400 text-lg">✓</span>
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Book instantly</p>
              <p className="text-slate-400 mt-1">When the room is free, tap <span className="text-white font-medium">Book Now</span>. Enter a meeting name and choose how long you need.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-slate-300 text-lg">📅</span>
            </div>
            <div>
              <p className="text-white font-semibold text-lg">See today's schedule</p>
              <p className="text-slate-400 mt-1">Scroll down to see all meetings booked for {roomName || 'this room'} today.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-red-400 text-lg">●</span>
            </div>
            <div>
              <p className="text-white font-semibold text-lg">In use</p>
              <p className="text-slate-400 mt-1">When the room is occupied, you'll see who has it and when it's free next.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-slate-300 text-lg">⚙️</span>
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Settings</p>
              <p className="text-slate-400 mt-1">Tap the gear icon at the bottom to change the room or refresh the calendar.</p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-2xl py-4 font-semibold text-lg transition-colors mt-2"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
