import { useState } from 'react'
import { useAutoClose } from './useAutoClose'
import TimerCloseButton from './TimerCloseButton'

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay()
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function DatePickerModal({ onClose, onSelect, selectedDate, today }) {
  const todayStr = today.toLocaleDateString('en-CA')
  const initial = selectedDate || todayStr
  const [viewYear, setViewYear] = useState(Number(initial.slice(0, 4)))
  const [viewMonth, setViewMonth] = useState(Number(initial.slice(5, 7)) - 1)

  useAutoClose(onClose)

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const canGoPrev = viewYear > today.getFullYear() || viewMonth > today.getMonth() || viewYear > today.getFullYear()
  const isPrevDisabled = viewYear === today.getFullYear() && viewMonth <= today.getMonth()

  const handleDayClick = (day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (dateStr < todayStr) return
    onSelect(dateStr)
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} />)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isPast = dateStr < todayStr
    const isToday = dateStr === todayStr
    const isSelected = dateStr === selectedDate

    cells.push(
      <button
        key={day}
        onClick={() => handleDayClick(day)}
        disabled={isPast}
        className={`aspect-square rounded-xl text-lg font-medium transition-all ${
          isPast
            ? 'text-slate-700 cursor-not-allowed'
            : isSelected
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : isToday
                ? 'bg-slate-700 text-white ring-2 ring-blue-400/50 hover:bg-slate-600'
                : 'text-slate-300 hover:bg-slate-700'
        }`}
      >
        {day}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <div className="bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Month navigation */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <button
            onClick={prevMonth}
            disabled={isPrevDisabled}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isPrevDisabled ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h2 className="text-white text-xl font-bold">{MONTHS[viewMonth]} {viewYear}</h2>
          <button
            onClick={nextMonth}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="px-8 grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-slate-500 uppercase">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="px-8 pb-6 grid grid-cols-7 gap-1">
          {cells}
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex gap-4">
          <TimerCloseButton onClick={onClose}>Cancel</TimerCloseButton>
          {selectedDate && (
            <button
              onClick={() => onSelect(todayStr)}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-5 text-xl font-bold transition-colors"
            >
              Today
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
