import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { captures } from "~/content/manual/screenshots/capture"
import type { CaptureDefinition } from "./capture-types"
import { manualPages } from "./content.server"
import { loadManualPagesFromDisk } from "./load-from-disk.server"
import { collectScreenshotIds, compareScreenshotIds, SCREENSHOT_ID_PATTERN } from "./screenshot-ids"

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const screenshotsDir = resolve(appRoot, "app/content/manual/screenshots")
const referenced = collectScreenshotIds(manualPages)
const definitions = captures as Record<string, CaptureDefinition>

describe("manual screenshots", () => {
  it("has a capture definition for every screenshot id, and no unused ones", () => {
    const { undefined: missing, unused } = compareScreenshotIds(
      referenced.keys(),
      Object.keys(definitions),
    )
    expect(
      missing.map(
        (id) =>
          `${id} (${(referenced.get(id) ?? []).map((r) => `${r.file}:${r.line}`).join(", ")})`,
      ),
      "Voeg een capture-definitie toe in app/content/manual/screenshots/capture.ts",
    ).toEqual([])
    expect(unused, "Verwijder capture-definities die geen pagina gebruikt").toEqual([])
  })

  it("uses lowercase, hyphenated ids", () => {
    const invalid = [...referenced.keys()].filter((id) => !SCREENSHOT_ID_PATTERN.test(id))
    expect(invalid).toEqual([])
  })

  it("only uses known placeholders in routes", () => {
    const invalid = Object.entries(definitions)
      .filter(([, d]) => {
        const placeholders = d.route.match(/\{[^}]*\}/g) ?? []
        return (
          !d.route.startsWith("/") ||
          placeholders.some((p) => !/^\{(farm|year|field:[a-z0-9-]+)\}$/.test(p))
        )
      })
      .map(([id]) => id)
    expect(invalid).toEqual([])
  })

  it("sets the browser clock to a valid moment", () => {
    const invalid = Object.entries(definitions)
      .filter(([, d]) => d.clock !== undefined)
      .filter(([, d]) => Number.isNaN(new Date(d.clock?.replace("{year}", "2026") ?? "").getTime()))
      .map(([id]) => id)
    expect(invalid).toEqual([])
  })

  it("only commits images that the manual uses, each listed in the manifest", () => {
    if (!existsSync(screenshotsDir)) return
    const images = readdirSync(screenshotsDir)
      .filter((name) => name.endsWith(".webp"))
      .map((name) => name.slice(0, -".webp".length))
    expect(images.filter((id) => !referenced.has(id))).toEqual([])

    const manifestFile = resolve(screenshotsDir, "manifest.json")
    const manifest: Record<string, unknown> = existsSync(manifestFile)
      ? JSON.parse(readFileSync(manifestFile, "utf8"))
      : {}
    expect(Object.keys(manifest).sort()).toEqual([...images].sort())
  })

  it("finds the same pages from disk as through the app's loader", () => {
    const fromDisk = loadManualPagesFromDisk(appRoot)
    expect(fromDisk.map((p) => p.file).sort()).toEqual(manualPages.map((p) => p.file).sort())
    expect([...collectScreenshotIds(fromDisk).keys()]).toEqual([...referenced.keys()])
  })
})
