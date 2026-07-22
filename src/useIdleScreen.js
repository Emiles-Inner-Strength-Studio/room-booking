import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SCREEN_DIM_TIMEOUT_MS,
  SCREEN_OFF_END_HOUR,
  SCREEN_OFF_START_HOUR,
  SCREEN_OFF_TIMEOUT_MS,
} from './config'

function isAfterHours(date) {
  const hour = date.getHours()
  return hour >= SCREEN_OFF_START_HOUR || hour < SCREEN_OFF_END_HOUR
}

function millisecondsToNextAfterHoursBoundary(date) {
  const next = new Date(date)
  const hour = date.getHours()

  if (hour < SCREEN_OFF_END_HOUR) {
    next.setHours(SCREEN_OFF_END_HOUR, 0, 0, 0)
  } else if (hour < SCREEN_OFF_START_HOUR) {
    next.setHours(SCREEN_OFF_START_HOUR, 0, 0, 0)
  } else {
    next.setDate(next.getDate() + 1)
    next.setHours(SCREEN_OFF_END_HOUR, 0, 0, 0)
  }

  return next.getTime() - date.getTime()
}

export function useIdleScreen() {
  const [screenState, setScreenState] = useState('active')
  const lastActivityRef = useRef(null)
  const timerRef = useRef(null)
  const scheduleRef = useRef(null)

  const wake = useCallback(() => {
    lastActivityRef.current = Date.now()
    setScreenState('active')
    scheduleRef.current?.()
  }, [])

  useEffect(() => {
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current)

      const now = new Date()
      if (lastActivityRef.current == null) lastActivityRef.current = now.getTime()
      const idleFor = now.getTime() - lastActivityRef.current
      const offAt = SCREEN_DIM_TIMEOUT_MS + SCREEN_OFF_TIMEOUT_MS
      let nextState = 'active'

      if (idleFor >= SCREEN_DIM_TIMEOUT_MS) {
        nextState = isAfterHours(now) && idleFor >= offAt ? 'off' : 'dimmed'
      }
      setScreenState(previous => previous === nextState ? previous : nextState)

      const delays = [millisecondsToNextAfterHoursBoundary(now)]
      if (idleFor < SCREEN_DIM_TIMEOUT_MS) {
        delays.push(SCREEN_DIM_TIMEOUT_MS - idleFor)
      } else if (isAfterHours(now) && idleFor < offAt) {
        delays.push(offAt - idleFor)
      }

      timerRef.current = setTimeout(schedule, Math.max(1, Math.min(...delays)))
    }

    scheduleRef.current = schedule
    schedule()

    const handleActivity = () => wake()
    const handleVisibilityChange = () => {
      if (!document.hidden) schedule()
    }

    window.addEventListener('pointerdown', handleActivity, true)
    window.addEventListener('keydown', handleActivity, true)
    window.addEventListener('click', handleActivity, true)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      scheduleRef.current = null
      window.removeEventListener('pointerdown', handleActivity, true)
      window.removeEventListener('keydown', handleActivity, true)
      window.removeEventListener('click', handleActivity, true)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [wake])

  return { screenState, wake }
}
