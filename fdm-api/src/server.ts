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
 *   GCS_BUCKET_NAME          — bucket for uploaded and generated files; omit to disable file endpoints
 *   GOOGLE_APPLICATION_CREDENTIALS, GCS_SERVICE_ACCOUNT_EMAIL, GCS_SERVICE_ACCOUNT_KEY
 *                            — optional GCS credentials; omit to use Application Default Credentials
 *   NMI_API_KEY              — NMI API key for nutrient advice, indicators, lab report reading and fertilizer plans
 *   FDM_REPORT_LOGO          — path to the logo (PNG or JPEG) shown in generated reports
 *   FDM_REPORT_LOGO_INVERTED — path to the logo for dark backgrounds, such as the report cover
 *   FDM_REPORT_COVER         — path to the cover image (PNG or JPEG) of generated reports
 *   PORT                     — HTTP port (default: 6173)
 */
// Sentry must be initialized before any other imports
import "../instrument.server.mjs"
import { serve } from "@hono/node-server"
import { createFdmAuth, createFdmServer } from "@nmi-agro/fdm-core"
import { readFile } from "node:fs/promises"
import { extname } from "node:path"
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

/**
 * Reads an image file as a data URI for report branding. A missing or unreadable file is logged
 * and left out, so reports are still generated without it.
 */
async function readImage(path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined
  try {
    const mime = extname(path).toLowerCase() === ".png" ? "image/png" : "image/jpeg"
    return `data:${mime};base64,${(await readFile(path)).toString("base64")}`
  } catch (error) {
    console.warn(`[fdm-api] could not read report image ${path}:`, error)
    return undefined
  }
}

const appName = String(process.env.PUBLIC_FDM_NAME ?? "FDM")
let reportBranding: ReturnType<typeof loadReportBranding> | undefined
async function loadReportBranding() {
  const [logo, logoInverted, coverImage] = await Promise.all([
    readImage(process.env.FDM_REPORT_LOGO),
    readImage(process.env.FDM_REPORT_LOGO_INVERTED),
    readImage(process.env.FDM_REPORT_COVER),
  ])
  return { name: appName, logo, logoInverted, coverImage }
}

const app = createFdmApi(fdm, auth, {
  appName,
  appUrl,
  allowedOrigins,
  reportBranding: () => {
    reportBranding ??= loadReportBranding()
    return reportBranding
  },
})

const port = Number(process.env.PORT ?? 6173)

serve({ fetch: app.fetch, port }, () => {
  console.log(
    `fdm-api listening on \x1b]8;;http://localhost:${port}/docs\x07http://localhost:${port}/docs\x1b]8;;\x07`,
  )
})
