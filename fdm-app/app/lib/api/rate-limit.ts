import { eq, sql } from "drizzle-orm"
import type { MiddlewareHandler } from "hono"
import { nanoid } from "nanoid"
import { rateLimit } from "@nmi-agro/fdm-core"
import { fdm } from "~/lib/fdm.server"
import type { ApiPrincipalContext } from "./auth"
import { ApiError } from "./error"

const WINDOW_MS = 60_000

export const RATE_LIMITS = {
    general: 120,
    write: 30,
    calc: 10,
} as const

export type RateBucket = keyof typeof RATE_LIMITS

/**
 * Returns a Hono middleware that enforces per-key rate limiting.
 * Uses the fdm-authn.rate_limit table with atomic upsert to avoid
 * race conditions under concurrent requests.
 */
export function rateLimitMiddleware(bucket: RateBucket): MiddlewareHandler {
    const limit = RATE_LIMITS[bucket]

    return async (c, next) => {
        const principal = c.get("principal") as ApiPrincipalContext
        const key = `fdm-api:${principal.apiKeyId}:${bucket}`
        const now = Date.now()
        const windowStart = now - WINDOW_MS

        // Atomic upsert: reset count when window has expired, otherwise increment.
        // Reading the resulting count in the same statement avoids read-then-write races.
        const [record] = await fdm
            .insert(rateLimit)
            .values({
                id: nanoid(),
                key,
                count: 1,
                lastRequest: now,
            })
            .onConflictDoUpdate({
                target: rateLimit.key,
                set: {
                    count: sql`CASE WHEN ${rateLimit.lastRequest} < ${windowStart} THEN 1 ELSE ${rateLimit.count} + 1 END`,
                    lastRequest: sql`CASE WHEN ${rateLimit.lastRequest} < ${windowStart} THEN ${now} ELSE ${rateLimit.lastRequest} END`,
                },
            })
            .returning({ count: rateLimit.count, lastRequest: rateLimit.lastRequest })

        if (record.count > limit) {
            const retryAfter = Math.ceil(
                (record.lastRequest + WINDOW_MS - now) / 1000,
            )
            c.header("Retry-After", String(Math.max(retryAfter, 1)))
            throw new ApiError(
                429,
                "rate-limit-exceeded",
                `Rate limit exceeded. Try again in ${Math.max(retryAfter, 1)}s.`,
            )
        }

        return next()
    }
}
