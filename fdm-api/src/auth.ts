import type { MiddlewareHandler } from "hono"
import { createMiddleware } from "hono/factory"
import type { FdmAuth } from "@nmi-agro/fdm-core"
import { ApiError } from "./error"
import type { ApiEnv, ApiPrincipalContext } from "./types"

/**
 * Creates middleware that authenticates requests with a user-owned API key.
 *
 * @param auth - Better Auth integration used to verify presented API keys.
 * @param skipPaths - Absolute request paths that should bypass authentication, such as API documentation endpoints.
 * @returns A Hono middleware that reads `X-API-Key` or `Authorization: Bearer`, verifies the key, and stores the principal on the request context.
 * @throws {ApiError} Throws when both auth headers are supplied, when no API key is present, or when verification fails.
 * @example
 * ```ts
 * app.use("*", createApiKeyAuth(auth, ["/api/docs", "/api/openapi.json"]))
 * ```
 */
export function createApiKeyAuth(
    auth: FdmAuth,
    skipPaths: string[],
): MiddlewareHandler<ApiEnv> {
    const skipSet = new Set(skipPaths)

    return createMiddleware<ApiEnv>(async (c, next) => {
        if (c.req.method === "OPTIONS" || skipSet.has(c.req.path)) {
            return next()
        }

        const xApiKey = c.req.header("x-api-key")
        const authHeader = c.req.header("authorization")
        const bearerKey = authHeader?.startsWith("Bearer ")
            ? authHeader.slice(7)
            : undefined

        if (xApiKey && bearerKey) {
            throw new ApiError(400, "ambiguous-api-key", "Provide either X-API-Key or Authorization: Bearer, not both.")
        }

        const rawKey = xApiKey ?? bearerKey

        if (!rawKey) {
            throw new ApiError(401, "unauthorized", "An API key is required. Use X-API-Key or Authorization: Bearer.")
        }

        const result = await auth.api.verifyApiKey({ body: { key: rawKey } })

        if (!result.valid || !result.key) {
            const msg = typeof result.error?.message === "string"
                ? result.error.message
                : "Invalid, expired, or revoked API key."
            throw new ApiError(401, "unauthorized", msg)
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
}
