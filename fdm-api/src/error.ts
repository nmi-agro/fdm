import type { Context, ErrorHandler, NotFoundHandler } from "hono"
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
    "internal-error": "Internal Server Error",
}

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly slug: string,
        message: string,
        public readonly extras?: Record<string, unknown>,
    ) {
        super(message)
        this.name = "ApiError"
    }
}

export function problemResponse(
    c: Context,
    status: number,
    slug: string,
    detail: string,
    appUrl: string,
    extras?: Record<string, unknown>,
) {
    return c.json(
        {
            type: `${appUrl}/problems/${slug}`,
            title: TITLES[slug] ?? slug,
            status,
            detail,
            instance: c.req.path,
            error_id: nanoid(),
            ...extras,
        },
        status as Parameters<typeof c.json>[1],
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

export function createErrorHandler(appUrl: string): ErrorHandler {
    return (err, c) => {
        if (err instanceof ApiError) {
            return problemResponse(c, err.status, err.slug, err.message, appUrl, err.extras)
        }
        if (isPermissionDenied(err)) {
            return problemResponse(c, 403, "forbidden", "You do not have permission to access this resource.", appUrl)
        }
        console.error("[fdm-api] Unhandled error:", err)
        return problemResponse(c, 500, "internal-error", "An unexpected error occurred.", appUrl)
    }
}

export function createNotFoundHandler(appUrl: string): NotFoundHandler {
    return (c) => problemResponse(c, 404, "not-found", `${c.req.path} does not exist.`, appUrl)
}
