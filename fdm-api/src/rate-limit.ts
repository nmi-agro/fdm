import { sql } from "drizzle-orm"
import type { MiddlewareHandler } from "hono"
import { nanoid } from "nanoid"
import { rateLimit, type FdmType } from "@nmi-agro/fdm-core"
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
} as const

/**
 * Enumerates the supported rate-limit buckets understood by the middleware.
 */
export type RateBucket = keyof typeof RATE_LIMITS

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
    const limit = RATE_LIMITS[bucket]

    return async (c, next) => {
        const principal = c.get("principal") as ApiPrincipalContext
        const key = `fdm-api:${principal.apiKeyId}:${bucket}`
        const now = Date.now()
        const windowStart = now - WINDOW_MS

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
            .returning({ count: rateLimit.count, lastRequest: rateLimit.lastRequest })

        if (record.count > limit) {
            const retryAfter = Math.ceil((record.lastRequest + WINDOW_MS - now) / 1000)
            c.header("Retry-After", String(Math.max(retryAfter, 1)))
            throw new ApiError(429, "rate-limit-exceeded", `Rate limit exceeded. Try again in ${Math.max(retryAfter, 1)}s.`)
        }

        return next()
    }
}
