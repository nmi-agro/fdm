import type { MiddlewareHandler } from "hono"
import { type FdmType, rateLimit } from "@nmi-agro/fdm-core"
import { sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import type { ApiEnv, ApiPrincipalContext } from "./types"
import { ApiError } from "./error"

const WINDOW_MS = 60_000

/**
 * Defines per-API-key request limits for each rate-limited route bucket.
 */
export const RATE_LIMITS = {
  general: 120,
  write: 30,
  calc: 10,
  nmi: 10,
} as const

/**
 * Matches the paths that trigger requests to the NMI API. These are counted in the
 * `nmi` bucket only, so the `general` and `write` middleware of the parent resources
 * (`/farms/*`, `/fields/*`) must not count them a second time.
 */
const NMI_PATH_PATTERNS: RegExp[] = [
  /\/fields\/[^/]+\/indicators\/?$/,
  /\/farms\/[^/]+\/indicators\/?$/,
  /\/fields\/[^/]+\/measures\/catalogue\/?$/,
  /\/farms\/[^/]+\/calculations\/nutrient-advice\/?$/,
  /\/fields\/[^/]+\/calculations\/nutrient-advice\/?$/,
  /\/farms\/[^/]+\/soil-analyses\/import\/compare\/?$/,
  /\/farms\/[^/]+\/fertilizer-plans\/?$/,
  /\/farm-groups\/[^/]+\/indicators\/?$/,
  /\/organizations\/[^/]+\/indicators\/?$/,
  // Applying an import requests soil estimates for every new field.
  /\/farms\/[^/]+\/fields\/import\/apply\/?$/,
]

/**
 * Enumerates the supported rate-limit buckets understood by the middleware.
 */
export type RateBucket = keyof typeof RATE_LIMITS

/**
 * The state of a rate-limit bucket after a request was counted.
 */
export interface RateLimitResult {
  /** Whether the request is within the limit. */
  allowed: boolean
  /** Maximum number of requests per window for the bucket. */
  limit: number
  /** Requests left in the current window. */
  remaining: number
  /** Seconds until the current window ends. At least 1 when the request is not allowed. */
  resetIn: number
}

/**
 * Counts one request for an API key in a rate-limit bucket and reports whether it is allowed.
 *
 * Counts are stored in the shared `rateLimit` table under `fdm-api:<apiKeyId>:<bucket>`, so every
 * service that uses this function shares the same per-key limits within a 60-second window.
 *
 * @param fdm - Database used to read and update the rate-limit table.
 * @param apiKeyId - Identifier of the API key that made the request.
 * @param bucket - Named limit bucket that determines the allowed request volume.
 * @returns The bucket state after counting the request.
 * @example
 * ```ts
 * const { allowed, resetIn } = await consumeRateLimit(fdm, principal.apiKeyId, "write")
 * ```
 */
export async function consumeRateLimit(
  fdm: FdmType,
  apiKeyId: string,
  bucket: RateBucket,
): Promise<RateLimitResult> {
  return consumeWindow(fdm, `fdm-api:${apiKeyId}:${bucket}`, RATE_LIMITS[bucket], WINDOW_MS)
}

/**
 * Counts one event under a key in the shared `rateLimit` table and reports whether it is within
 * the limit. The window starts at the first counted event and resets once it has passed.
 *
 * @param fdm - Database used to read and update the rate-limit table.
 * @param key - Storage key of the counter, for example `fdm-api:<apiKeyId>:general`.
 * @param limit - Largest number of events allowed per window.
 * @param windowMs - Length of the window in milliseconds.
 * @returns The counter state after counting the event.
 */
export async function consumeWindow(
  fdm: FdmType,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = now - windowMs

  const [record] = await fdm
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

  const resetIn = Math.ceil((record.lastRequest + windowMs - now) / 1000)
  if (record.count > limit) {
    return { allowed: false, limit, remaining: 0, resetIn: Math.max(resetIn, 1) }
  }
  return {
    allowed: true,
    limit,
    remaining: Math.max(limit - record.count, 0),
    resetIn: Math.max(resetIn, 0),
  }
}

/**
 * Creates middleware that enforces per-key request limits within a 60-second window.
 *
 * @param fdm - Database and service context used to read and update the shared rate-limit table.
 * @param bucket - Named limit bucket that determines the allowed request volume.
 * @returns A Hono middleware that tracks requests, sets `Retry-After` when blocked, and forwards allowed requests to the next handler.
 * @throws {ApiError} Throws when the current API key exceeds the configured limit for the selected bucket.
 * @example
 * ```ts
 * app.use("/farms", rateLimitMiddleware(fdm, "general"))
 * ```
 */
export function rateLimitMiddleware(fdm: FdmType, bucket: RateBucket): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    if (bucket !== "nmi" && NMI_PATH_PATTERNS.some((pattern) => pattern.test(c.req.path))) {
      return next()
    }

    // Guard against double-counting: if this bucket already ran for this request, skip the increment.
    let seen = c.get("rateLimitBucketsSeen")
    if (!seen) {
      seen = new Set<string>()
      c.set("rateLimitBucketsSeen", seen)
    }
    if (seen.has(bucket)) {
      return next()
    }
    seen.add(bucket)

    const principal = c.get("principal") as ApiPrincipalContext
    const result = await consumeRateLimit(fdm, principal.apiKeyId, bucket)

    c.header("RateLimit-Limit", String(result.limit))
    c.header("RateLimit-Remaining", String(result.remaining))
    c.header("RateLimit-Reset", String(result.resetIn))
    if (!result.allowed) {
      c.header("Retry-After", String(result.resetIn))
      throw new ApiError(
        429,
        "rate-limit-exceeded",
        `Rate limit exceeded. Try again in ${result.resetIn}s.`,
      )
    }

    return next()
  }
}
