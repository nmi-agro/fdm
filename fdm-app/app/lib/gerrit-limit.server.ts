/**
 * Server-side helpers for Gerrit's per-user daily rate limiting.
 *
 * The limit value is read from the PostHog feature flag payload for the
 * `gerrit_daily_limit` flag. Usage is tracked by counting
 * `gerrit_plan_generated` events captured to PostHog for the user today
 * (Europe/Amsterdam calendar day).
 *
 * Both helpers fail open: when PostHog is unconfigured or unavailable, the
 * limit is treated as unlimited and the used count is 0.
 */

import { serverConfig } from "~/lib/config.server"
import PostHogClient from "~/posthog.server"

const FLAG_KEY = "gerrit_daily_limit"
const EVENT_NAME = "gerrit_plan_generated"
const DEFAULT_LIMIT = 3

/**
 * Returns the start of the current Europe/Amsterdam calendar day as an ISO
 * string in UTC, e.g. "2024-06-15T22:00:00.000Z" (UTC+2 day boundary).
 * Handles DST automatically via Intl.DateTimeFormat.
 */
export function getAmsterdamDayStartISO(now: Date = new Date()): string {
    // Get the year/month/day in Amsterdam time
    const parts = new Intl.DateTimeFormat("nl-NL", {
        timeZone: "Europe/Amsterdam",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now)

    const year = Number(parts.find((p) => p.type === "year")!.value)
    const month = Number(parts.find((p) => p.type === "month")!.value)
    const day = Number(parts.find((p) => p.type === "day")!.value)

    // Find what UTC timestamp corresponds to Amsterdam midnight for this date.
    const amsterdamOffset = getAmsterdamOffsetMinutes(now)
    const utcMs =
        Date.UTC(year, month - 1, day, 0, 0, 0, 0) -
        amsterdamOffset * 60_000

    return new Date(utcMs).toISOString()
}

/**
 * Returns the Amsterdam UTC offset in minutes (e.g. 120 for UTC+2).
 * Uses Intl.DateTimeFormat.formatToParts for reliable cross-platform parsing.
 */
function getAmsterdamOffsetMinutes(date: Date): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Amsterdam",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
    }).formatToParts(date)

    const get = (type: string) =>
        Number(parts.find((p) => p.type === type)!.value)

    // hour12:false can return 24 at midnight; normalise to 0
    const amsMs = Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour") % 24,
        get("minute"),
        get("second"),
    )
    return Math.round((amsMs - date.getTime()) / 60_000)
}

/**
 * Reads the `gerrit_daily_limit` PostHog feature flag payload for the user.
 * Payload may be a bare number (3) or an object ({ limit: 3 }).
 * Returns Infinity when the flag is absent, the value is 0/negative, or
 * PostHog is unavailable.
 */
export async function getGerritDailyLimit(
    principalId: string,
): Promise<number> {
    try {
        const posthog = PostHogClient()
        if (!posthog) return Infinity

        const flags = await posthog.evaluateFlags(principalId)
        const payload = flags.getFlagPayload(FLAG_KEY)

        let limit: number | undefined
        if (typeof payload === "number") {
            limit = payload
        } else if (
            payload !== null &&
            typeof payload === "object" &&
            "limit" in (payload as object) &&
            typeof (payload as Record<string, unknown>).limit === "number"
        ) {
            limit = (payload as Record<string, unknown>).limit as number
        }

        if (limit === undefined || limit <= 0) return Infinity
        return limit
    } catch {
        return DEFAULT_LIMIT
    }
}

/**
 * Counts how many `gerrit_plan_generated` events the user has triggered
 * today (Europe/Amsterdam calendar day) by querying PostHog's HogQL API.
 *
 * Returns 0 when PostHog query credentials are missing or the query fails.
 */
export async function countGerritRequestsToday(
    principalId: string,
): Promise<number> {
    const posthogConfig = serverConfig.analytics?.posthog
    const projectId = posthogConfig?.projectId
    const personalApiKey = posthogConfig?.personalApiKey
    const host = posthogConfig?.host

    if (!projectId || !personalApiKey || !host) return 0

    const dayStart = getAmsterdamDayStartISO()
    // ClickHouse expects 'YYYY-MM-DD HH:MM:SS', not ISO 8601 with T/Z.
    const dayStartCH = dayStart.replace("T", " ").slice(0, 19)

    const query = {
        query: {
            kind: "HogQLQuery",
            query: `SELECT count() FROM events WHERE event = '${EVENT_NAME}' AND distinct_id = '${principalId.replace(/'/g, "\\'")}' AND timestamp >= toDateTime('${dayStartCH}', 'UTC')`,
        },
    }

    try {
        const response = await fetch(
            `${host}/api/projects/${projectId}/query/`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${personalApiKey}`,
                },
                body: JSON.stringify(query),
                signal: AbortSignal.timeout(5_000),
            },
        )

        const text = await response.text()
        if (!response.ok) {
            console.error("[gerrit-limit] HogQL query failed", response.status, text)
            return 0
        }

        console.debug("[gerrit-limit] HogQL query:", query.query)
        console.debug("[gerrit-limit] HogQL response:", text)

        const json = JSON.parse(text) as { results?: [[number]] }
        return json.results?.[0]?.[0] ?? 0
    } catch (err) {
        console.error("[gerrit-limit] HogQL error:", err)
        return 0
    }
}

/**
 * Returns current usage info for a user: how many requests they've made
 * today, their daily limit, and how many remain.
 */
export async function getGerritUsage(principalId: string): Promise<{
    limit: number
    used: number
    remaining: number
}> {
    const [limit, used] = await Promise.all([
        getGerritDailyLimit(principalId),
        countGerritRequestsToday(principalId),
    ])

    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used)
    return { limit, used, remaining }
}
