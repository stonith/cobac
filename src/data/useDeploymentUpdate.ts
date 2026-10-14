import { useEffect, useState } from 'react'
import { SNAPSHOT_VERSION } from './useSnapshot'

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION
export const VERSION_URL = `${import.meta.env.BASE_URL}version.json`
export const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000
const CHECK_TIMEOUT = 10 * 1000

function isVersion(value: unknown): value is { build: string; snapshot: string } {
  if (!value || typeof value !== 'object') return false
  return (
    'build' in value &&
    typeof value.build === 'string' &&
    value.build.length > 0 &&
    'snapshot' in value &&
    typeof value.snapshot === 'string' &&
    value.snapshot.length > 0
  )
}

/** Compare with the embedded build, never a first-poll baseline that could already be newer. */
export function useDeploymentUpdate(ready: boolean): boolean {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    let pending: AbortController | null = null
    let pendingTimeout: number | undefined
    const check = async () => {
      if (pending || document.visibilityState === 'hidden' || !navigator.onLine) return
      const controller = new AbortController()
      pending = controller
      pendingTimeout = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT)
      try {
        const response = await fetch(VERSION_URL, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const version: unknown = await response.json()
        if (
          !cancelled &&
          isVersion(version) &&
          (version.build !== APP_VERSION || version.snapshot !== SNAPSHOT_VERSION)
        ) {
          setAvailable(true)
        }
      } catch {
        // Offline, interrupted and malformed responses should not disrupt the loaded calendar.
      } finally {
        window.clearTimeout(pendingTimeout)
        pending = null
      }
    }
    const onFocus = () => {
      void check()
    }
    onFocus()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const interval = window.setInterval(onFocus, UPDATE_CHECK_INTERVAL)
    return () => {
      cancelled = true
      pending?.abort()
      window.clearTimeout(pendingTimeout)
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [ready])
  return available
}
