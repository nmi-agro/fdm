import type { ReportBranding } from "@nmi-agro/fdm-reports"
import { access, readFile } from "node:fs/promises"
import { extname, resolve } from "node:path"

/**
 * File names of the default report images. These are the images that fdm-app shows in its
 * reports, read from its `public` folder.
 */
export const DEFAULT_REPORT_IMAGES = {
  logo: "fdm-high-resolution-logo-transparent-no-text.png",
  logoInverted: "fdm-high-resolution-logo-transparent-no-text.png",
  coverImage: "bemestingsplan_cover.jpg",
} as const

/** Configured paths of the report images. An unset or empty path uses the default image. */
export type ReportImagePaths = Partial<Record<keyof typeof DEFAULT_REPORT_IMAGES, string>>

/**
 * Folders searched for the default images, relative to the working directory: `public` in the
 * container, and the `public` folder of fdm-app when running from `fdm-api` or the monorepo root.
 */
const DEFAULT_IMAGE_DIRS = ["public", "../fdm-app/public", "fdm-app/public"]

/**
 * Reads an image file as a data URI for report branding. A missing or unreadable file is logged
 * and left out, so reports are still generated without it.
 *
 * @param path - Path to a PNG or JPEG file.
 * @returns The image as a data URI, or `undefined` when no path is given or the file cannot be read.
 */
export async function readImage(path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined
  try {
    const mime = extname(path).toLowerCase() === ".png" ? "image/png" : "image/jpeg"
    return `data:${mime};base64,${(await readFile(path)).toString("base64")}`
  } catch (error) {
    console.warn(`[fdm-api] could not read report image ${path}:`, error)
    return undefined
  }
}

async function findDefaultImage(fileName: string, cwd: string): Promise<string | undefined> {
  for (const dir of DEFAULT_IMAGE_DIRS) {
    const candidate = resolve(cwd, dir, fileName)
    try {
      await access(candidate)
      return candidate
    } catch {
      // Not in this folder; try the next one.
    }
  }
  return undefined
}

/**
 * Loads the name and images shown in generated reports, such as the fertilizer plan.
 *
 * Each image uses its configured path when set, and otherwise the default image with the same
 * name as in fdm-app ({@link DEFAULT_REPORT_IMAGES}). An image that is found nowhere is left out.
 *
 * @param name - Name of the application, shown on the cover and in the footer.
 * @param paths - Configured image paths; relative paths are resolved against `cwd`.
 * @param cwd - Directory to resolve relative paths and search for the default images from.
 * @returns The branding of reports.
 */
export async function loadReportBranding(
  name: string,
  paths: ReportImagePaths = {},
  cwd: string = process.cwd(),
): Promise<ReportBranding> {
  const load = async (key: keyof typeof DEFAULT_REPORT_IMAGES) => {
    const configured = paths[key]
    const path = configured
      ? resolve(cwd, configured)
      : await findDefaultImage(DEFAULT_REPORT_IMAGES[key], cwd)
    return readImage(path)
  }
  const [logo, logoInverted, coverImage] = await Promise.all([
    load("logo"),
    load("logoInverted"),
    load("coverImage"),
  ])
  return { name, logo, logoInverted, coverImage }
}
