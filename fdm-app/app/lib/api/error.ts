import type { Context, ErrorHandler, NotFoundHandler } from "hono"
import { nanoid } from "nanoid"
import { serverConfig } from "~/lib/config.server"

const appUrl = serverConfig.url

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

/**
 * Returns an RFC 7807 problem+json response.
 */
export function problemResponse(
    c: Context,
    status: number,
    slug: string,
    detail: string,
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

/**
 * A typed API error that carries a status code and slug. Throw this
 * from route handlers to have it mapped to a problem+json response.
 */
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

export const errorHandler: ErrorHandler = (err, c) => {
    if (err instanceof ApiError) {
        return problemResponse(c, err.status, err.slug, err.message, err.extras)
    }
    console.error("[API] Unhandled error:", err)
    return problemResponse(c, 500, "internal-error", "An unexpected error occurred.")
}

export const notFoundHandler: NotFoundHandler = (c) => {
    return problemResponse(c, 404, "not-found", `${c.req.path} does not exist.`)
}
