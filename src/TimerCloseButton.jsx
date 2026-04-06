import { AUTO_CLOSE_MS } from './useAutoClose'

export default function TimerCloseButton({ onClick, children = 'Close', className = '' }) {
  const seconds = AUTO_CLOSE_MS / 1000
  // Match rounded-2xl = 1rem = 16px
  const r = 16

  return (
    <button
      onClick={onClick}
      className={`relative flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-2xl py-5 text-xl font-semibold transition-colors ${className}`}
    >
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <rect
          x="1" y="1" rx={r} ry={r}
          width="calc(100% - 2px)" height="calc(100% - 2px)"
          fill="none" stroke="currentColor" strokeWidth="2"
          className="text-slate-500"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset="0"
          style={{
            animation: `timer-outline ${seconds}s linear forwards`,
          }}
        />
      </svg>
      <span className="relative">{children}</span>
      <style>{`
        @keyframes timer-outline {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 1; }
        }
      `}</style>
    </button>
  )
}
