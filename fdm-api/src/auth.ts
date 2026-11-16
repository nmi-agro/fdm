import type { FdmAuth } from "@nmi-agro/fdm-core"
import type { MiddlewareHandler } from "hono"
import { withAuditContext } from "@nmi-agro/fdm-core"
import * as Sentry from "@sentry/node"
import { createMiddleware } from "hono/factory"
import type { ApiEnv, ApiPrincipalContext } from "./types"
import { ApiError } from "./error"

/**
 * Settings for {@link createApiKeyAuth} that differ between the services that use it.
 */
export interface ApiKeyAuthOptions {
  /** Audit channel recorded for authenticated requests. Defaults to `"api"`. */
  channel?: ApiPrincipalContext["channel"]
  /**
   * Value of the `WWW-Authenticate` header on 401 responses, for example `Bearer realm="FDM"`.
   * Omitted by default.
   */
  wwwAuthenticate?: string
}

/**
 * Creates middleware that authenticates requests with a user-owned API key.
 *
 * The principal and the audit context are tagged with the channel from `options`, so the audit
 * log shows whether a change came through the REST API (`"api"`) or the MCP server (`"mcp"`).
 *
 * @param auth - Better Auth integration used to verify presented API keys.
 * @param skipPaths - Absolute request paths that should bypass authentication, such as API documentation endpoints.
 * @param options - Optional settings for the service that uses the middleware.
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
  options: ApiKeyAuthOptions = {},
): MiddlewareHandler<ApiEnv> {
  const skipSet = new Set(skipPaths)
  const channel = options.channel ?? "api"

  return createMiddleware<ApiEnv>(async (c, next) => {
    if (c.req.method === "OPTIONS" || skipSet.has(c.req.path)) {
      return next()
    }

    const unauthorized = (message: string): ApiError => {
      if (options.wwwAuthenticate) {
        // RFC 9110: a 401 response carries a challenge that tells the client how to authenticate.
        c.header("WWW-Authenticate", options.wwwAuthenticate)
      }
      return new ApiError(401, "unauthorized", message)
    }

    const xApiKey = c.req.header("x-api-key")
    const authHeader = c.req.header("authorization")

    if (xApiKey !== undefined && authHeader !== undefined) {
      throw new ApiError(
        400,
        "ambiguous-api-key",
        "Provide either X-API-Key or Authorization: Bearer, not both.",
      )
    }

    const bearerKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined

    const rawKey = xApiKey ?? bearerKey

    if (!rawKey) {
      throw unauthorized("An API key is required. Use X-API-Key or Authorization: Bearer.")
    }

    const result = await auth.api.verifyApiKey({ body: { key: rawKey } })

    if (!result.valid || !result.key) {
      const msg =
        typeof result.error?.message === "string"
          ? result.error.message
          : "Invalid, expired, or revoked API key."
      throw unauthorized(msg)
    }

    const principal: ApiPrincipalContext = {
      userId: result.key.referenceId,
      apiKeyId: result.key.id,
      keyName: result.key.name ?? null,
      channel,
      effectivePrincipalId: result.key.referenceId,
    }

    c.set("principal", principal)
    Sentry.setTag("api.key_id", principal.apiKeyId)
    Sentry.setTag("audit_channel", channel)
    return withAuditContext({ channel, credential_id: result.key.id }, () => next())
  })
}
