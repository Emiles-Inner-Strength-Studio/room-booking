import { useEffect } from 'react'

const AUTO_CLOSE_MS = 30000

export function useAutoClose(onClose) {
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [onClose])
}
