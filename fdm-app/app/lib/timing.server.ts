import { captureEvent } from "~/lib/analytics.server"

/**
 * Runs `fn` and records how long it took as a PostHog event.
 *
 * The event is captured fire-and-forget once `fn` settles, also when it fails, so that slow
 * calculations can be monitored without affecting the response. The result or error of `fn` is
 * passed through unchanged.
 *
 * @param distinctId - The principal id of the user, used as the PostHog distinct id.
 * @param event - The name of the PostHog event.
 * @param properties - Extra properties to record, for example the block name and field count.
 * @param fn - The work to time.
 * @returns The result of `fn`.
 */
export async function withTiming<T>(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now()
  let success = false
  try {
    const result = await fn()
    success = true
    return result
  } finally {
    captureEvent(distinctId, event, {
      ...properties,
      duration_ms: Math.round(performance.now() - start),
      success,
    })
  }
}
