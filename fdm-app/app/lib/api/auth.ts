import type { MiddlewareHandler } from "hono"
import { createMiddleware } from "hono/factory"
import { auth } from "~/lib/auth.server"
import { ApiError } from "./error"

export interface ApiPrincipalContext {
    userId: string
    apiKeyId: string
    keyName: string | null
    channel: "api"
    effectivePrincipalId: string
}

declare module "hono" {
    interface ContextVariableMap {
        principal: ApiPrincipalContext
    }
}

const SKIP_PATHS = new Set(["/api/docs", "/api/openapi.json"])

/**
 * Middleware that authenticates requests using an API key.
 * Accepts either X-API-Key header or Authorization: Bearer.
 * Skips authentication for OPTIONS requests and documentation paths.
 */
export const apiKeyAuth: MiddlewareHandler = createMiddleware(async (c, next) => {
    if (c.req.method === "OPTIONS" || SKIP_PATHS.has(c.req.path)) {
        return next()
    }

    const xApiKey = c.req.header("x-api-key")
    const authHeader = c.req.header("authorization")
    const bearerKey = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : undefined

    if (xApiKey && bearerKey) {
        throw new ApiError(
            400,
            "ambiguous-api-key",
            "Provide either X-API-Key or Authorization: Bearer, not both.",
        )
    }

    const rawKey = xApiKey ?? bearerKey

    if (!rawKey) {
        throw new ApiError(
            401,
            "unauthorized",
            "An API key is required. Use X-API-Key or Authorization: Bearer.",
        )
    }

    const result = await auth.api.verifyApiKey({ body: { key: rawKey } })

    if (!result.valid || !result.key) {
        throw new ApiError(
            401,
            "unauthorized",
            result.error?.message ?? "Invalid, expired, or revoked API key.",
        )
    }

    const principal: ApiPrincipalContext = {
        userId: result.key.referenceId,
        apiKeyId: result.key.id,
        keyName: result.key.name ?? null,
        channel: "api",
        effectivePrincipalId: result.key.referenceId,
    }

    c.set("principal", principal)
    return next()
})
