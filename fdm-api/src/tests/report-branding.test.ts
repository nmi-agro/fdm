/**
 * Tests for the report branding of the standalone server (src/report-branding.ts).
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_REPORT_IMAGES, loadReportBranding } from "../report-branding"

const dataUri = (mime: string, content: string) =>
  `data:${mime};base64,${Buffer.from(content).toString("base64")}`

let root: string

async function writeImage(dir: string, name: string, content: string) {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, name), content)
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "fdm-api-branding-"))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

describe("loadReportBranding", () => {
  it("uses the default images from public when no paths are configured", async () => {
    const publicDir = join(root, "public")
    await writeImage(publicDir, DEFAULT_REPORT_IMAGES.logo, "logo")
    await writeImage(publicDir, DEFAULT_REPORT_IMAGES.coverImage, "cover")

    const branding = await loadReportBranding("FDM", {}, root)

    expect(branding).toEqual({
      name: "FDM",
      logo: dataUri("image/png", "logo"),
      logoInverted: dataUri("image/png", "logo"),
      coverImage: dataUri("image/jpeg", "cover"),
    })
  })

  it("falls back to fdm-app/public when running from fdm-api in the monorepo", async () => {
    const cwd = join(root, "fdm-api")
    await mkdir(cwd)
    const appPublic = join(root, "fdm-app", "public")
    await writeImage(appPublic, DEFAULT_REPORT_IMAGES.logo, "logo")
    await writeImage(appPublic, DEFAULT_REPORT_IMAGES.coverImage, "cover")

    const branding = await loadReportBranding("FDM", {}, cwd)

    expect(branding.logo).toBe(dataUri("image/png", "logo"))
    expect(branding.coverImage).toBe(dataUri("image/jpeg", "cover"))
  })

  it("falls back to fdm-app/public when running from the monorepo root", async () => {
    await writeImage(join(root, "fdm-app", "public"), DEFAULT_REPORT_IMAGES.coverImage, "cover")

    const branding = await loadReportBranding("FDM", {}, root)

    expect(branding.coverImage).toBe(dataUri("image/jpeg", "cover"))
  })

  it("uses a configured path instead of the default image", async () => {
    const publicDir = join(root, "public")
    await writeImage(publicDir, DEFAULT_REPORT_IMAGES.logo, "default logo")
    await writeImage(publicDir, DEFAULT_REPORT_IMAGES.coverImage, "default cover")
    await writeImage(join(root, "custom"), "cover.png", "custom cover")

    const branding = await loadReportBranding(
      "Custom",
      { coverImage: join(root, "custom", "cover.png") },
      root,
    )

    expect(branding.coverImage).toBe(dataUri("image/png", "custom cover"))
    expect(branding.logo).toBe(dataUri("image/png", "default logo"))
  })

  it("resolves a relative configured path against the working directory", async () => {
    await writeImage(join(root, "custom"), "logo.png", "custom logo")

    const branding = await loadReportBranding("FDM", { logo: "custom/logo.png" }, root)

    expect(branding.logo).toBe(dataUri("image/png", "custom logo"))
  })

  it("treats an empty configured path as unset", async () => {
    await writeImage(join(root, "public"), DEFAULT_REPORT_IMAGES.logo, "logo")

    const branding = await loadReportBranding("FDM", { logo: "" }, root)

    expect(branding.logo).toBe(dataUri("image/png", "logo"))
  })

  it("returns only the name when no images are found", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const branding = await loadReportBranding("FDM", {}, root)

    expect(branding).toEqual({
      name: "FDM",
      logo: undefined,
      logoInverted: undefined,
      coverImage: undefined,
    })
    expect(warn).not.toHaveBeenCalled()
  })

  it("leaves out a configured image that cannot be read, with a warning", async () => {
    await writeImage(join(root, "public"), DEFAULT_REPORT_IMAGES.coverImage, "cover")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const branding = await loadReportBranding(
      "FDM",
      { coverImage: join(root, "missing.jpg") },
      root,
    )

    expect(branding.coverImage).toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
  })
})
