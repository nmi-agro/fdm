import { rateLimit } from "@nmi-agro/fdm-core"
import { sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { fdm } from "~/lib/fdm.server"

export interface RateLimitResult {
  /** Whether the request should be allowed to proceed. */
  allowed: boolean
  /** Number of requests counted in the current window (including this one). */
  count: number
  /** Requests remaining in the current window, floored at 0. */
  remaining: number
  /** Time in seconds until the rate limit resets. */
  resetIn: number
}

/**
 * Fixed-window rate limiter backed by the shared `rate_limit` table in the
 * `fdm-authn` schema (the same table better-auth uses for its own rate limiting).
 *
 * Callers must namespace their `key` (e.g. `inbound-email-ticket:<email>`) so
 * different consumers of this table never collide with each other or with
 * better-auth's own keys.
 *
 * The check-and-increment is a single atomic `INSERT ... ON CONFLICT DO UPDATE`
 * statement, so concurrent requests for the same key can't race past each other.
 */
export async function checkRateLimit(
  key: string,
  windowMs: number,
  max: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = now - windowMs

  const [row] = await fdm
    .insert(rateLimit)
    .values({ id: nanoid(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`CASE WHEN ${rateLimit.lastRequest} < ${windowStart} THEN 1 ELSE ${rateLimit.count} + 1 END`,
        lastRequest: sql`CASE WHEN ${rateLimit.lastRequest} < ${windowStart} THEN ${now} ELSE ${rateLimit.lastRequest} END`,
      },
    })
    .returning({
      count: rateLimit.count,
      lastRequest: rateLimit.lastRequest,
    })

  const count = row.count

  const resetIn = Math.ceil((row.lastRequest + windowMs - now) / 1000)
  return {
    allowed: count <= max,
    count,
    remaining: Math.max(0, max - count),
    resetIn: resetIn,
  }
}
