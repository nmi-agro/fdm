/**
 * Standalone HTTP server entry point for the fdm-api Cloud Run service.
 *
 * Environment variables:
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
 *   BETTER_AUTH_SECRET, BETTER_AUTH_URL
 *   PUBLIC_FDM_NAME, PUBLIC_FDM_URL
 *   PUBLIC_SENTRY_DSN        — Sentry DSN; omit to disable error reporting
 *   SENTRY_RELEASE           — Sentry release tag (defaults to npm_package_version)
 *   FDM_API_ALLOWED_ORIGINS  — comma-separated allowed CORS origins; omit to allow all origins (*)
 *   PORT                     — HTTP port (default: 6173)
 */
// Sentry must be initialized before any other imports
import "../instrument.server.mjs"
import { serve } from "@hono/node-server"
import { createFdmAuth, createFdmServer } from "@nmi-agro/fdm-core"
import { createFdmApi } from "./index"

const fdm = createFdmServer(
    process.env.POSTGRES_HOST,
    Number(process.env.POSTGRES_PORT ?? 5432),
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD,
    process.env.POSTGRES_DB,
)

const auth = createFdmAuth(fdm)

const allowedOrigins = process.env.FDM_API_ALLOWED_ORIGINS
    ? process.env.FDM_API_ALLOWED_ORIGINS.split(",")
          .map((o) => o.trim())
          .filter(Boolean)
    : []

const appUrl = process.env.PUBLIC_FDM_URL
if (!appUrl) {
    console.error(
        "[fdm-api] PUBLIC_FDM_URL is not set. This is required for error response URLs and OpenAPI docs. Set it to the public URL of this service (e.g. https://api.yourdomain.com).",
    )
    process.exit(1)
}

const app = createFdmApi(fdm, auth, {
    appName: String(process.env.PUBLIC_FDM_NAME ?? "FDM"),
    appUrl,
    allowedOrigins,
})

const port = Number(process.env.PORT ?? 6173)

serve({ fetch: app.fetch, port }, () => {
    console.log(`fdm-api listening on \x1b]8;;http://localhost:${port}/docs\x07http://localhost:${port}/docs\x1b]8;;\x07`)
})
