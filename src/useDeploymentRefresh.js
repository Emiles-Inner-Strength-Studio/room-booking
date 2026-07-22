import { useEffect } from 'react'
import { DEPLOYMENT_VERSION_POLL_INTERVAL_MS } from './config'

const SESSION_KEY = 'room_booking_deployment_version'

export function useDeploymentRefresh() {
  useEffect(() => {
    let active = true

    const checkDeployment = async () => {
      try {
        const response = await fetch('/api/deployment-version', { cache: 'no-store' })
        if (!response.ok || !active) return

        const { version } = await response.json()
        if (!version || !active) return

        const previousVersion = sessionStorage.getItem(SESSION_KEY)
        sessionStorage.setItem(SESSION_KEY, version)

        if (previousVersion && previousVersion !== version) {
          window.location.reload()
        }
      } catch {
        // A temporary network failure should not interrupt the kiosk.
      }
    }

    checkDeployment()
    const interval = setInterval(checkDeployment, DEPLOYMENT_VERSION_POLL_INTERVAL_MS)
    const handleVisibilityChange = () => {
      if (!document.hidden) checkDeployment()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      active = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
}
