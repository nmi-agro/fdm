import type { Context, ErrorHandler, NotFoundHandler } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { HTTPException } from "hono/http-exception"
import * as Sentry from "@sentry/node"
import { nanoid } from "nanoid"

const TITLES: Record<string, string> = {
    "validation-failed": "Validation Failed",
    "ambiguous-api-key": "Ambiguous API Key",
    unauthorized: "Unauthorized",
    forbidden: "Forbidden",
    "not-found": "Not Found",
    conflict: "Conflict",
    "payload-too-large": "Payload Too Large",
    "unsupported-media-type": "Unsupported Media Type",
    "unprocessable-entity": "Unprocessable Entity",
    "rate-limit-exceeded": "Rate Limit Exceeded",
    "service-unavailable": "Service Unavailable",
    "bad-gateway": "Bad Gateway",
    "gateway-timeout": "Gateway Timeout",
    "internal-error": "Internal Server Error",
}

/**
 * Represents an HTTP error that should be rendered as RFC 9457 problem details.
 */
export class ApiError extends Error {
    /**
     * Creates an API error with HTTP metadata and optional problem details extensions.
     *
     * @param status - HTTP status code returned to the client.
     * @param slug - Machine-readable problem type slug appended to the configured application URL.
     * @param message - Human-readable problem detail included in the response payload.
     * @param extras - Optional RFC 9457 extension members to merge into the problem document.
     */
    constructor(
        /** HTTP status code returned to the client. */
        public readonly status: number,
        /** Machine-readable problem type slug. */
        public readonly slug: string,
        message: string,
        /** Optional extension members included in the problem document. */
        public readonly extras?: Record<string, unknown>,
    ) {
        super(message)
        this.name = "ApiError"
    }
}

/**
 * Builds an RFC 9457 `application/problem+json` response for the current request.
 *
 * @param c - Hono request context used to write the response.
 * @param status - HTTP status code for the problem response.
 * @param slug - Machine-readable problem type slug appended to the application URL.
 * @param detail - Human-readable explanation of the failure.
 * @param appUrl - Canonical application URL used to generate the absolute problem type URI.
 * @param extras - Optional extension members to include in the problem details payload.
 * @returns A JSON response with the `application/problem+json` content type.
 * @example
 * ```ts
 * return problemResponse(c, 404, "not-found", "Farm not found.", "https://example.com")
 * ```
 */
export function problemResponse(
    c: Context,
    status: number,
    slug: string,
    detail: string,
    appUrl: string,
    extras?: Record<string, unknown>,
    errorId?: string,
) {
    const error_id = errorId ?? nanoid()
    const logLine = `[fdm-api] error_id=${error_id} status=${status} type=${slug} path=${c.req.path} detail="${detail}"`
    if (status >= 500) {
        console.error(logLine)
    } else {
        console.warn(logLine)
    }
    return c.json(
        {
            ...extras,
            type: `${appUrl}/problems/${slug}`,
            title: TITLES[slug] ?? slug,
            status,
            detail,
            instance: c.req.path,
            error_id,
        },
        status as ContentfulStatusCode,
        { "content-type": "application/problem+json" },
    )
}

const PERMISSION_MESSAGES = new Set([
    "Permission denied",
    "Principal does not have permission to perform this action",
])

function isPermissionDenied(err: unknown): boolean {
    if (!(err instanceof Error)) return false
    if (PERMISSION_MESSAGES.has(err.message)) return true
    if (err.cause) return isPermissionDenied(err.cause)
    return false
}

/**
 * Creates the global Hono error handler used by the API application.
 *
 * @param appUrl - Canonical application URL used to generate absolute problem type URIs.
 * @returns An error handler that maps known API and permission failures to problem responses and falls back to a 500 response for unexpected errors.
 * @throws {ApiError} Does not throw directly, but converts upstream `ApiError` instances into HTTP responses.
 */
export function createErrorHandler(appUrl: string): ErrorHandler {
    return (err, c) => {
        if (err instanceof HTTPException && err.status === 400) {
            return problemResponse(c, 400, "validation-failed", "Request body contains invalid JSON.", appUrl)
        }
        if (err instanceof ApiError) {
            return problemResponse(c, err.status, err.slug, err.message, appUrl, err.extras)
        }
        if (isPermissionDenied(err)) {
            return problemResponse(c, 403, "forbidden", "You do not have permission to access this resource.", appUrl)
        }
        if (err instanceof SyntaxError) {
            return problemResponse(c, 400, "validation-failed", `Request body contains invalid JSON: ${err.message}`, appUrl)
        }
        console.error("[fdm-api] Unhandled error:", err)
        const error_id = nanoid()
        Sentry.withScope((scope) => {
            scope.setTag("error_id", error_id)
            Sentry.captureException(err)
        })
        return problemResponse(c, 500, "internal-error", "An unexpected error occurred.", appUrl, undefined, error_id)
    }
}

/**
 * Creates the fallback handler for requests that do not match any API route.
 *
 * @param appUrl - Canonical application URL used to generate the problem type URI.
 * @returns A not-found handler that responds with a 404 RFC 9457 problem document.
 * @example
 * ```ts
 * app.notFound(createNotFoundHandler("https://example.com"))
 * ```
 */
export function createNotFoundHandler(appUrl: string): NotFoundHandler {
    return (c) => problemResponse(c, 404, "not-found", `${c.req.path} does not exist.`, appUrl)
}
