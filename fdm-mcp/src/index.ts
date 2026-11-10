import type { FdmAuth, FdmType } from "@nmi-agro/fdm-core"
import { localhostOriginValidation, originValidation } from "@modelcontextprotocol/hono"
import { createMcpHandler } from "@modelcontextprotocol/server"
import {
  type ApiEnv,
  ApiError,
  type ApiPrincipalContext,
  consumeRateLimit,
  createApiKeyAuth,
  createErrorHandler,
  createNotFoundHandler,
  defaultServices,
} from "@nmi-agro/fdm-api"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { cors } from "hono/cors"
import type { McpAnalyticsConfig } from "./analytics"
import type { McpServices } from "./tools/types"
import { LOG_OPTIONS } from "./log"
import { createMcpServer } from "./mcp-server"
import { SERVER_VERSION } from "./version"

/** Path of the MCP endpoint. */
export const MCP_PATH = "/mcp"

/** Largest request body the MCP endpoint accepts: 5 MB, the same as the REST API. */
const MAX_BODY_BYTES = 5 * 1024 * 1024

/**
 * Configuration of the MCP server.
 */
export interface FdmMcpConfig {
  /** Public name of the application, used as server name and in the server instructions. */
  appName: string
  /** Public URL of this service, used for the problem type URLs of error responses. */
  appUrl: string
  /**
   * Origins of web pages allowed to call the server, for example `https://app.example.com`.
   * Requests without an `Origin` header (desktop apps, command-line clients and servers) are
   * always allowed. When empty, only `localhost` origins are allowed.
   */
  allowedOrigins?: string[]
  /** PostHog MCP analytics; omit to send no analytics. */
  analytics?: McpAnalyticsConfig
}

/** Reads the JSON-RPC method names of a request body, which can be one message or a batch. */
function methodsOf(body: unknown): string[] {
  const messages = Array.isArray(body) ? body : [body]
  return messages
    .map((message) => (message as { method?: unknown } | null)?.method)
    .filter((method): method is string => typeof method === "string")
}

/** Logs a request that the MCP handler rejected, for example one with invalid MCP headers. */
export function logRejectedRequest(error: Error): void {
  console.warn(`[fdm-mcp] request rejected: ${error.message}`)
}

/**
 * Creates the factory that builds the MCP server for each request, for the principal that the
 * route passes in `authInfo.extra.principal`.
 *
 * @param config - Name and analytics of the server.
 * @param fdm - Database.
 * @param services - Data-access functions.
 * @returns The factory for `createMcpHandler`.
 * @throws {ApiError} 401 when a request arrives without a principal.
 */
export function createServerFactory(
  config: Pick<FdmMcpConfig, "appName" | "analytics">,
  fdm: FdmType,
  services: McpServices,
) {
  return ({ authInfo }: { authInfo?: { extra?: Record<string, unknown> } }) => {
    const principal = authInfo?.extra?.principal as ApiPrincipalContext | undefined
    if (!principal) {
      // The route always passes the principal; this guards against misuse of the handler.
      throw new ApiError(401, "unauthorized", "An API key is required.")
    }
    return createMcpServer({
      appName: config.appName,
      fdm,
      services,
      principal,
      analytics: config.analytics,
    })
  }
}

/**
 * Creates the Hono application of the MCP server. It serves the Model Context Protocol over
 * stateless Streamable HTTP at `/mcp`, for the user who owns the API key of each request.
 *
 * - **Authentication**: the same API keys as the REST API, as `X-API-Key` or
 *   `Authorization: Bearer`. A missing or invalid key gives 401 with `WWW-Authenticate`.
 * - **Audit**: changes are recorded with audit channel `mcp` and the API key id.
 * - **Limits**: every tool call counts in the rate-limit bucket of its operation, shared with
 *   the REST API; other protocol requests count in the `general` bucket.
 * - **Origin**: requests from web pages are only accepted from `allowedOrigins`.
 *
 * @param fdm - Database from `@nmi-agro/fdm-core`.
 * @param auth - Authentication service used to verify API keys.
 * @param config - Name, URL, allowed origins and analytics.
 * @param services - Optional service overrides, for tests.
 * @returns The Hono application.
 * @example
 * ```ts
 * const app = createFdmMcp(fdm, auth, { appName: "FDM", appUrl: "https://mcp.example.com" })
 * serve({ fetch: app.fetch, port: 6174 })
 * ```
 */
export function createFdmMcp(
  fdm: FdmType,
  auth: FdmAuth,
  config: FdmMcpConfig,
  services: Partial<McpServices> = {},
): Hono<ApiEnv> {
  const allServices: McpServices = { ...defaultServices, ...services }
  const allowedOrigins = config.allowedOrigins ?? []

  const handler = createMcpHandler(createServerFactory(config, fdm, allServices), {
    responseMode: "json",
    onerror: logRejectedRequest,
  })

  const app = new Hono<ApiEnv>()
  app.onError(createErrorHandler(config.appUrl, LOG_OPTIONS))
  const notFound = createNotFoundHandler(config.appUrl, LOG_OPTIONS)
  app.notFound((c) =>
    // MCP clients probe for OAuth metadata on every connection. The server has no OAuth, so
    // answer these probes with a plain 404 and keep them out of the logs.
    c.req.path.includes("/.well-known/") ? c.body(null, 404) : notFound(c),
  )

  app.use(
    "*",
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Accept",
        "Authorization",
        "X-API-Key",
        "Mcp-Method",
        "Mcp-Name",
        "Mcp-Protocol-Version",
        "Mcp-Session-Id",
        "Last-Event-ID",
      ],
      exposeHeaders: [
        "WWW-Authenticate",
        "Retry-After",
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
      ],
      maxAge: 86400,
    }),
  )

  app.get("/", (c) =>
    c.json({
      name: config.appName,
      description: "Model Context Protocol (MCP) server for AI assistants.",
      version: SERVER_VERSION,
      endpoint: MCP_PATH,
    }),
  )
  app.get("/health", (c) => c.json({ status: "ok" }))

  app.use(
    MCP_PATH,
    allowedOrigins.length > 0
      ? originValidation(allowedOrigins.map((origin) => new URL(origin).hostname))
      : localhostOriginValidation(),
  )
  app.use(
    MCP_PATH,
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: () => {
        throw new ApiError(413, "payload-too-large", "The request body is larger than 5 MB.")
      },
    }),
  )
  app.use(
    MCP_PATH,
    createApiKeyAuth(auth, [], {
      channel: "mcp",
      wwwAuthenticate: `Bearer realm="${config.appName}"`,
    }),
  )

  app.on(["POST", "GET", "DELETE"], MCP_PATH, async (c) => {
    const principal = c.get("principal")
    let parsedBody: unknown
    if (c.req.method === "POST") {
      try {
        parsedBody = JSON.parse(await c.req.text())
      } catch {
        return c.json(
          { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
          400,
        )
      }
      // Tool calls count in the bucket of their tool; other requests count as general reads.
      if (!methodsOf(parsedBody).includes("tools/call")) {
        const limit = await consumeRateLimit(fdm, principal.apiKeyId, "general")
        if (!limit.allowed) {
          throw new ApiError(
            429,
            "rate-limit-exceeded",
            `Rate limit exceeded. Try again in ${limit.resetIn}s.`,
            undefined,
            undefined,
            { "Retry-After": String(limit.resetIn) },
          )
        }
      }
    }
    return handler.fetch(c.req.raw, {
      parsedBody,
      authInfo: {
        // The API key itself is never passed on; the principal identifies the caller.
        token: "",
        clientId: principal.apiKeyId,
        scopes: [],
        extra: { principal },
      },
    })
  })

  return app
}

export type { McpAnalyticsConfig } from "./analytics"
export { PRIVATE_EVENT_PROPERTIES, scrubEvent } from "./analytics"
export { buildInstructions } from "./instructions"
export { createMcpServer, type McpServerSetup, serverSlug } from "./mcp-server"
export { EXCLUDED_OPERATIONS, TOOLS, type McpTool } from "./tools"
export type { McpServices } from "./tools/types"
export { SERVER_VERSION } from "./version"
