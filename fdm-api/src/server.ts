/**
 * Standalone HTTP server entry point for the fdm-api Cloud Run service.
 *
 * Environment variables:
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
 *   BETTER_AUTH_SECRET, BETTER_AUTH_URL
 *   PUBLIC_FDM_NAME, PUBLIC_FDM_URL
 *   FDM_API_ALLOWED_ORIGINS  — comma-separated list of allowed CORS origins
 *   PORT                     — HTTP port (default: 6173)
 */
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
    ? process.env.FDM_API_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : []

const app = createFdmApi(fdm, auth, {
    appName: String(process.env.PUBLIC_FDM_NAME ?? "FDM"),
    appUrl: String(process.env.PUBLIC_FDM_URL),
    allowedOrigins,
})

const port = Number(process.env.PORT ?? 6173)

serve({ fetch: app.fetch, port }, () => {
    console.log(`fdm-api listening on port ${port}`)
})
