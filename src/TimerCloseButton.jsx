import { AUTO_CLOSE_MS } from './useAutoClose'

export default function TimerCloseButton({ onClick, children = 'Close', className = '' }) {
  const seconds = AUTO_CLOSE_MS / 1000

  return (
    <button
      onClick={onClick}
      className={`relative flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-2xl py-5 text-xl font-semibold transition-colors overflow-hidden ${className}`}
    >
      <span className="relative">{children}</span>
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-slate-400 rounded-full"
        style={{
          animation: `timer-bar ${seconds}s linear forwards`,
        }}
      />
      <style>{`
        @keyframes timer-bar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </button>
  )
}
