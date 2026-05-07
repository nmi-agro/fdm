import type { MiddlewareHandler } from "hono"
import { createMiddleware } from "hono/factory"
import type { FdmAuth } from "@nmi-agro/fdm-core"
import { ApiError } from "./error"
import type { ApiEnv, ApiPrincipalContext } from "./types"

/**
 * Creates an API key authentication middleware bound to the given auth instance.
 * Skips authentication for OPTIONS requests and the provided skip paths.
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
            throw new ApiError(401, "unauthorized", result.error?.message ?? "Invalid, expired, or revoked API key.")
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
