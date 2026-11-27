/**
 * Standalone HTTP server entry point for the fdm-mcp Cloud Run service.
 *
 * Environment variables:
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
 *   BETTER_AUTH_SECRET, BETTER_AUTH_URL — must match fdm-app, which issues the API keys
 *   PUBLIC_FDM_NAME          — public name of the application, shown to assistants
 *   PUBLIC_FDM_MCP_URL       — public URL of this service, used in error responses
 *   FDM_MCP_ALLOWED_ORIGINS  — comma-separated origins of web pages allowed to call the server;
 *                              omit to allow only localhost. Clients without an Origin header
 *                              (desktop apps, CLIs, servers) are always allowed.
 *   NMI_API_KEY              — NMI API key for indicators, measure options and nutrient advice
 *   POSTHOG_PROJECT_TOKEN, POSTHOG_HOST — PostHog MCP analytics; omit the token to disable it.
 *                              The host defaults to https://eu.i.posthog.com
 *   PUBLIC_POSTHOG_KEY, PUBLIC_POSTHOG_HOST — legacy aliases for the PostHog variables
 *   PUBLIC_SENTRY_DSN        — Sentry DSN; omit to disable error reporting
 *   SENTRY_RELEASE           — release tag for Sentry and PostHog (defaults to npm_package_version)
 *   PORT                     — HTTP port (default: 6174)
 */
// Sentry must be initialized before any other imports
import "../instrument.server.mjs"
import { serve } from "@hono/node-server"
import { createFdmAuth, createFdmServer } from "@nmi-agro/fdm-core"
import { PostHog } from "@posthog/mcp"
import { createFdmMcp } from "./index"

const fdm = createFdmServer(
  process.env.POSTGRES_HOST,
  Number(process.env.POSTGRES_PORT ?? 5432),
  process.env.POSTGRES_USER,
  process.env.POSTGRES_PASSWORD,
  process.env.POSTGRES_DB,
)

const auth = createFdmAuth(fdm)

const appUrl = process.env.PUBLIC_FDM_MCP_URL
if (!appUrl) {
  console.error(
    "[fdm-mcp] PUBLIC_FDM_MCP_URL is not set. Set it to the public URL of this service (e.g. https://mcp.yourdomain.com).",
  )
  process.exit(1)
}

const allowedOrigins = (process.env.FDM_MCP_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

// An empty value counts as unset, so a forwarded but empty new name doesn't hide the old one
const posthogToken = process.env.POSTHOG_PROJECT_TOKEN || process.env.PUBLIC_POSTHOG_KEY
// Analytics stay in the EU region unless a host is set
const posthogHost =
  process.env.POSTHOG_HOST || process.env.PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com"
const posthog = posthogToken ? new PostHog(posthogToken, { host: posthogHost }) : undefined
if (!posthog) {
  console.warn("[fdm-mcp] POSTHOG_PROJECT_TOKEN is not set — MCP analytics are disabled")
}

// The name assistants show for this server, for example "MINAS2". An empty value counts as unset.
const appName = process.env.PUBLIC_FDM_NAME?.trim() || "FDM"
if (!process.env.PUBLIC_FDM_NAME?.trim()) {
  console.warn('[fdm-mcp] PUBLIC_FDM_NAME is not set — the server presents itself as "FDM"')
}

const app = createFdmMcp(fdm, auth, {
  appName,
  appUrl,
  allowedOrigins,
  analytics: posthog
    ? {
        posthog,
        serverBuild: process.env.SENTRY_RELEASE ?? process.env.npm_package_version,
      }
    : undefined,
})

const port = Number(process.env.PORT ?? 6174)

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`fdm-mcp listening on http://localhost:${port}/mcp`)
})

/** Longest time to wait for running requests on shutdown, before the process exits anyway. */
const SHUTDOWN_TIMEOUT_MS = 10_000

/**
 * Stops accepting requests, waits until the running requests have finished (at most
 * {@link SHUTDOWN_TIMEOUT_MS}), sends queued analytics events and then exits.
 */
process.on("SIGTERM", async () => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, SHUTDOWN_TIMEOUT_MS).unref()
    server.close(() => resolve())
  })
  await posthog?.shutdown()
  process.exit(0)
})
