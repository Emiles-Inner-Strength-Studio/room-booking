import { useEffect, useRef } from 'react'

export const AUTO_CLOSE_MS = 30000

export function useAutoClose(onClose) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [])
}
