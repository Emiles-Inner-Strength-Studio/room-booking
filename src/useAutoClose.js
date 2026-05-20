import { useEffect, useRef } from 'react'
import { AUTO_CLOSE_MS } from './config'

export { AUTO_CLOSE_MS }

export function useAutoClose(onClose) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [])
}
