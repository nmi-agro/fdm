import PostHogClient from "~/posthog.server"

type EventProperties = Record<string, unknown>

/**
 * Captures a server-side PostHog event.
 *
 * Fire-and-forget — always call without `await` so it never blocks a response.
 * When `b_id_farm` is present in `properties`, the event is automatically associated
 * with the `farm` group so farm-level dashboards work out of the box.
 * No-ops gracefully when PostHog is not configured.
 */
export function captureEvent(
  distinctId: string,
  event: string,
  properties: EventProperties = {},
): void {
  const posthog = PostHogClient()
  if (!posthog) return

  const groups: Record<string, string> = {}
  if (typeof properties.b_id_farm === "string") {
    groups.farm = properties.b_id_farm
  }
  if (typeof properties.org_slug === "string") {
    groups.organization = properties.org_slug
  }

  try {
    posthog.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        ...(Object.keys(groups).length > 0 ? { $groups: groups } : {}),
      },
    })
  } catch {
    // never let analytics errors surface to callers
  }
}
