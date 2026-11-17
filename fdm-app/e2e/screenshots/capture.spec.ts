/**
 * Captures one screenshot per capture definition in `app/content/manual/screenshots/capture.ts`.
 *
 * The run fails when the manual and the definitions disagree, when a page shows an error, or when
 * an element of a definition does not appear. A failing page never ends up in the manual.
 */

import { expect, type Locator, type Page, test } from "@playwright/test"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { CaptureDefinition, CaptureTarget } from "~/lib/manual/capture-types"
import type { DemoFarmIds } from "../seed/demo-farm"
import { captures } from "../../app/content/manual/screenshots/capture"
import { loadManualPagesFromDisk } from "../../app/lib/manual/load-from-disk.server"
import { collectScreenshotIds, compareScreenshotIds } from "../../app/lib/manual/screenshot-ids"
import { ERROR_TEXTS } from "../support/app"
import { APP_ROOT, BASE_URL } from "../support/env"
import { saveScreenshot } from "./images"
import { DUMMY_PDF, fixGreeting, mockSoilReader, SOIL_REPORT_FILES } from "./mocks"
import { DEMO_FARM_FILE, RESULTS_DIR, SCREENSHOTS_DIR, SIGNED_OUT_STATE_FILE } from "./paths"

/** Turns off transitions and the text cursor, which animations: "disabled" does not cover. */
const STILL_CSS = `*, *::before, *::after {
  transition: none !important;
  animation: none !important;
  caret-color: transparent !important;
}`

// Fail before capturing anything when the manual and the definitions disagree.
const referenced = collectScreenshotIds(loadManualPagesFromDisk(APP_ROOT))
const mismatch = compareScreenshotIds(referenced.keys(), Object.keys(captures))
if (mismatch.undefined.length > 0 || mismatch.unused.length > 0) {
  const lines = [
    ...mismatch.undefined.map(
      (id) =>
        `- "${id}" is used in ${referenced
          .get(id)
          ?.map((ref) => `${ref.file}:${ref.line}`)
          .join(", ")} but has no capture definition`,
    ),
    ...mismatch.unused.map((id) => `- "${id}" has a capture definition but no page uses it`),
  ]
  throw new Error(`Screenshot ids and capture definitions do not match:\n${lines.join("\n")}`)
}

// The run starts once; every capture freezes the browser clock at this moment so that the page
// shows the same day and year as the server.
const runStart = new Date()

let demoFarm: DemoFarmIds | undefined
function getDemoFarm(): DemoFarmIds {
  demoFarm ??= JSON.parse(readFileSync(DEMO_FARM_FILE, "utf8")) as DemoFarmIds
  return demoFarm
}

/**
 * Fills in `{farm}`, `{year}` and `{field:<key>}` in a route or a value.
 *
 * @param text - The route or value of a capture definition.
 * @returns The text with the demo farm's ids.
 */
function resolvePlaceholders(text: string): string {
  const ids = getDemoFarm()
  return text.replace(
    /\{(farm|year|field:([a-z0-9-]+))\}/g,
    (placeholder, name: string, key?: string) => {
      if (name === "farm") return ids.farm
      if (name === "year") return String(ids.year)
      const b_id = ids.fields[key as keyof DemoFarmIds["fields"]]
      if (!b_id) throw new Error(`Unknown demo field in ${placeholder} (variant ${ids.variant})`)
      return b_id
    },
  )
}

function locate(page: Page, target: CaptureTarget): Locator {
  const exact = target.exact
  if ("role" in target) return page.getByRole(target.role, { name: target.name, exact }).first()
  if ("text" in target) return page.getByText(target.text, { exact }).first()
  if ("label" in target) return page.getByLabel(target.label, { exact }).first()
  if ("placeholder" in target) return page.getByPlaceholder(target.placeholder, { exact }).first()
  if ("testId" in target) return page.getByTestId(target.testId).first()
  return page.locator(target.selector).first()
}

/** Waits until every map on the page has been idle for a moment. */
async function waitForMaps(page: Page): Promise<void> {
  const allIdle = () => {
    const maps = [...document.querySelectorAll("[data-map-idle]")]
    return maps.length > 0 && maps.every((map) => map.getAttribute("data-map-idle") === "true")
  }
  await page.waitForFunction(allIdle, undefined, { timeout: 60_000 })
  await page.waitForTimeout(750)
  await page.waitForFunction(allIdle, undefined, { timeout: 60_000 })
}

async function capture(page: Page, id: string, definition: CaptureDefinition): Promise<void> {
  const problems: string[] = []
  page.on("pageerror", (error) => problems.push(`Page error: ${error.message}`))
  page.on("response", (response) => {
    if (response.url().startsWith(BASE_URL) && response.status() >= 400) {
      problems.push(`HTTP ${response.status()} for ${response.url()}`)
    }
  })

  if (definition.viewport) await page.setViewportSize(definition.viewport)
  await fixGreeting(page)
  if (definition.mock === "soil-reader") await mockSoilReader(page, getDemoFarm())
  await page.clock.setFixedTime(runStart)

  const path = resolvePlaceholders(definition.route)
  await page.goto(path, { waitUntil: "networkidle" })
  if (!definition.signedOut) {
    expect(new URL(page.url()).pathname, "The demo user should stay signed in").not.toMatch(
      /^\/(signin|welcome)/,
    )
  }
  await page.addStyleTag({ content: STILL_CSS })

  await expect(locate(page, definition.ready)).toBeVisible()
  // Only now, after hydration: a clock that differs from the server's breaks hydration. The steps
  // then open the page that marks today with a client-side navigation.
  if (definition.clock)
    await page.clock.setFixedTime(new Date(resolvePlaceholders(definition.clock)))
  for (const step of definition.steps ?? []) {
    if ("click" in step) await locate(page, step.click).click()
    else if ("hover" in step) await locate(page, step.hover).hover()
    else if ("fill" in step) await locate(page, step.fill).fill(resolvePlaceholders(step.value))
    else if ("type" in step) await page.keyboard.type(step.type)
    else if ("upload" in step) {
      if (definition.mock !== "soil-reader") throw new Error(`${id}: upload needs a mock`)
      await locate(page, step.upload).setInputFiles(
        SOIL_REPORT_FILES.map((name) => ({ name, mimeType: "application/pdf", buffer: DUMMY_PDF })),
      )
    } else if ("press" in step) await page.keyboard.press(step.press)
    else if ("waitFor" in step) await expect(locate(page, step.waitFor)).toBeVisible()
    else await expect(locate(page, step.waitForHidden)).toBeHidden()
  }

  await page.waitForLoadState("networkidle")
  if (definition.map) await waitForMaps(page)
  await page.evaluate(() => document.fonts.ready)

  for (const text of ERROR_TEXTS) {
    await expect(page.getByText(text)).toHaveCount(0)
  }
  expect(problems, "The page should load without errors").toEqual([])

  const target = definition.element ? locate(page, definition.element) : undefined
  const png = target
    ? await target.screenshot({ animations: "disabled", type: "png" })
    : await page.screenshot({
        animations: "disabled",
        type: "png",
        fullPage: definition.fullPage ?? false,
      })

  // Where the maps are in the screenshot, so tile noise there does not count as a change.
  const origin = (await target?.boundingBox()) ?? { x: 0, y: 0 }
  const scroll = definition.fullPage ? await page.evaluate(() => [scrollX, scrollY]) : [0, 0]
  const maps = definition.map
    ? (
        await page.locator(".maplibregl-canvas").evaluateAll((canvases) =>
          canvases.map((canvas) => {
            const box = canvas.getBoundingClientRect()
            return { x: box.x, y: box.y, width: box.width, height: box.height }
          }),
        )
      ).map((box) => ({
        x: box.x + scroll[0] - origin.x,
        y: box.y + scroll[1] - origin.y,
        width: box.width,
        height: box.height,
      }))
    : []

  const status = await saveScreenshot(SCREENSHOTS_DIR, id, png, maps)
  mkdirSync(RESULTS_DIR, { recursive: true })
  writeFileSync(join(RESULTS_DIR, `${id}.json`), JSON.stringify({ id, status, path }))
}

const definitions = Object.entries(captures) as [string, CaptureDefinition][]

for (const [id, definition] of definitions.filter(([, d]) => !d.signedOut)) {
  test(id, async ({ page }) => {
    await capture(page, id, definition)
  })
}

test.describe("signed out", () => {
  test.use({ storageState: SIGNED_OUT_STATE_FILE })
  for (const [id, definition] of definitions.filter(([, d]) => d.signedOut)) {
    test(id, async ({ page }) => {
      await capture(page, id, definition)
    })
  }
})
