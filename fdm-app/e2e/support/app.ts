/**
 * Checks on the app under test, shared by the Playwright projects.
 */
import type { Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { APP_ROOT, BASE_URL } from "./env"

/** Texts of the app's error pages (`app/components/custom/error.tsx`). */
export const ERROR_TEXTS = ["Oeps, er lijkt iets mis te zijn.", "Deze pagina is niet beschikbaar"]

/**
 * Returns the latest version in the in-app changelog, so its notification can be marked as seen.
 *
 * @returns The version, such as `v0.39.0`.
 * @throws When `app/lib/changelog.ts` has no version.
 */
export function latestChangelogVersion(): string {
  const source = readFileSync(join(APP_ROOT, "app", "lib", "changelog.ts"), "utf8")
  const match = source.match(/version:\s*"(v[^"]+)"/)
  if (!match) throw new Error("Could not find the latest version in app/lib/changelog.ts")
  return match[1]
}

/** Problems that {@link guardPage} collected on a page. */
export interface PageGuard {
  /** Descriptions of every problem so far: errors in the browser and failed app requests. */
  problems(): string[]
  /** Forgets the problems so far, for example after an expected failure. */
  reset(): void
}

/**
 * Isolates a page from external services and records what goes wrong on it:
 *
 * - every request to another origin than the app is aborted, so a run never depends on map
 *   tiles, analytics or other services, and never sends them anything;
 * - errors in the browser console and uncaught exceptions are recorded, except the failed
 *   loads of the aborted external requests;
 * - responses of the app with status 500 or higher are recorded. 4xx responses are not, because
 *   pages handle those themselves (for example a lookup that finds nothing).
 *
 * Call it before the first navigation.
 *
 * @param page - The page to guard.
 * @returns The collected problems.
 */
export async function guardPage(page: Page): Promise<PageGuard> {
  let problems: string[] = []
  const blocked = new Set<string>()

  await page.route(
    (url) => url.origin !== BASE_URL,
    (route) => {
      blocked.add(route.request().url())
      return route.abort("blockedbyclient")
    },
  )

  page.on("console", (message) => {
    if (message.type() !== "error") return
    const text = message.text()
    const source = message.location().url
    // "Failed to load resource" for a request that this guard aborted.
    if (source && blocked.has(source)) return
    if (/net::ERR_BLOCKED_BY_CLIENT/.test(text)) return
    // A failed fetch reported by a library, such as a map tile, a dataset range request or an
    // elevation image (COG). The app is running, so a failed fetch is one of the aborted
    // external requests unless the message names the app. Only the first line counts: the rest
    // can be a stack trace with the app's own URLs.
    const firstLine = text.split("\n")[0]
    const isFailedFetch = /failed to fetch|failed to load|request failed/i.test(firstLine)
    if (isFailedFetch && !firstLine.includes(BASE_URL)) return
    problems.push(`Console error: ${text}`)
  })
  page.on("pageerror", (error) => problems.push(`Page error: ${error.message}`))
  page.on("response", (response) => {
    if (response.url().startsWith(BASE_URL) && response.status() >= 500) {
      problems.push(`HTTP ${response.status()} for ${response.url()}`)
    }
  })

  return {
    problems: () => [...problems],
    reset: () => {
      problems = []
    },
  }
}
