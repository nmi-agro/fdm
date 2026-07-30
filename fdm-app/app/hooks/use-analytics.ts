import posthog from "posthog-js"
import { useCallback } from "react"
import { clientConfig } from "~/lib/config"

type EventProperties = Record<string, unknown>

/**
 * Returns a `capture` function backed by PostHog.
 *
 * Centralises the `clientConfig.analytics.posthog` guard so individual
 * route components don't each have to check it. Use inside a `useEffect`
 * to fire insight-view events on route mount.
 */
export function useAnalytics() {
  const capture = useCallback((event: string, properties: EventProperties = {}) => {
    if (!clientConfig.analytics.posthog) return
    try {
      posthog.capture(event, properties)
    } catch {
      // never let analytics errors surface to users
    }
  }, [])

  return { capture }
}
