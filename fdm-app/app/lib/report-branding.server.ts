import type { ReportBranding } from "@nmi-agro/fdm-reports"
import fs from "node:fs/promises"
import path from "node:path"
import { clientConfig } from "~/lib/config"

async function getBase64Image(filePath: string | undefined): Promise<string | undefined> {
  if (!filePath) return undefined
  try {
    const ext = path.extname(filePath).toLowerCase().substring(1)
    const mimeType =
      ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : "application/octet-stream"
    const buffer = await fs.readFile(filePath)
    return `data:${mimeType};base64,${buffer.toString("base64")}`
  } catch (e) {
    if ((e as { code: string })?.code === "ENOENT") return undefined
    console.warn(`Failed to read image file at ${filePath}`, e)
    return undefined
  }
}

let brandingPromise: Promise<ReportBranding> | undefined

/**
 * Returns the name and images of the app for reports such as the fertilizer plan PDF. The
 * images are read from the `public` folder once and kept in memory.
 *
 * @returns The branding of reports.
 */
export function getReportBranding(): Promise<ReportBranding> {
  brandingPromise ??= loadReportBranding()
  return brandingPromise
}

async function loadReportBranding(): Promise<ReportBranding> {
  // Resolve the public directory for both dev (monorepo root) and Docker/prod (app root).
  let publicDir = path.resolve(process.cwd(), "public")
  try {
    const monorepoPublicDir = path.resolve(process.cwd(), "fdm-app", "public")
    const stat = await fs.stat(monorepoPublicDir)
    if (stat.isDirectory()) publicDir = monorepoPublicDir
  } catch {
    // Not running from the monorepo root.
  }

  const relativeLogoPath = clientConfig.logomark?.startsWith("/")
    ? clientConfig.logomark.substring(1)
    : clientConfig.logomark
  const [logo, logoInverted, coverImage] = await Promise.all([
    getBase64Image(relativeLogoPath ? path.join(publicDir, relativeLogoPath) : undefined),
    getBase64Image(path.join(publicDir, "fdm-high-resolution-logo-transparent-no-text.png")),
    getBase64Image(path.join(publicDir, "bemestingsplan_cover.jpg")),
  ])

  return { name: clientConfig.name, logo, logoInverted, coverImage }
}
