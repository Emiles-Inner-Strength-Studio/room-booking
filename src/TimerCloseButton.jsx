import { AUTO_CLOSE_MS } from './useAutoClose'

export default function TimerCloseButton({ onClick }) {
  const seconds = AUTO_CLOSE_MS / 1000
  // SVG circle: radius 18, circumference ~113.1
  const r = 18
  const circ = 2 * Math.PI * r

  return (
    <button
      onClick={onClick}
      className="relative w-10 h-10 flex items-center justify-center flex-shrink-0 group"
      title="Close"
    >
      <svg className="absolute inset-0 w-10 h-10 -rotate-90" viewBox="0 0 40 40">
        {/* Background ring */}
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-700" />
        {/* Animated ring */}
        <circle
          cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="2"
          className="text-slate-400"
          strokeDasharray={circ}
          strokeDashoffset="0"
          strokeLinecap="round"
          style={{
            animation: `timer-ring ${seconds}s linear forwards`,
          }}
        />
      </svg>
      <span className="relative text-slate-500 group-hover:text-white text-2xl leading-none transition-colors">×</span>
      <style>{`
        @keyframes timer-ring {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: ${circ}; }
        }
      `}</style>
    </button>
  )
}
