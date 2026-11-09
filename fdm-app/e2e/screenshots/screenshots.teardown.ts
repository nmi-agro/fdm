/**
 * Runs once after the captures: removes images without a definition, rewrites `manifest.json`
 * and writes the summary that becomes the body of the screenshot pull request.
 */

import { test as teardown } from "@playwright/test"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { captures } from "../../app/content/manual/screenshots/capture"
import { type ImageStatus, removeStaleImages, writeManifest } from "./images"
import { RESULTS_DIR, SCREENSHOTS_DIR, SUMMARY_FILE } from "./paths"

interface CaptureResult {
  id: string
  status: ImageStatus
  path: string
}

function readResults(): CaptureResult[] {
  if (!existsSync(RESULTS_DIR)) return []
  return readdirSync(RESULTS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(join(RESULTS_DIR, name), "utf8")) as CaptureResult)
    .sort((a, b) => a.id.localeCompare(b.id))
}

function list(title: string, ids: string[]): string[] {
  if (ids.length === 0) return []
  return [`### ${title} (${ids.length})`, "", ...ids.map((id) => `- \`${id}\``), ""]
}

teardown("update the manifest and summary", async () => {
  const ids = new Set(Object.keys(captures))
  const results = readResults()
  // Only remove images after a complete run, so a failed or filtered run (--grep) never deletes
  // anything. The manifest always describes the images on disk.
  const complete = [...ids].every((id) => results.some((result) => result.id === id))
  const removed = complete ? removeStaleImages(SCREENSHOTS_DIR, ids) : []
  await writeManifest(SCREENSHOTS_DIR)

  const added = results.filter((r) => r.status === "added").map((r) => r.id)
  const changed = results.filter((r) => r.status === "changed").map((r) => r.id)
  const unchanged = results.filter((r) => r.status === "unchanged").length

  const summary = [
    "Updates the screenshots of the user manual from the current app, captured with a synthetic demo farm.",
    "",
    ...list("Added", added),
    ...list("Changed", changed),
    ...list("Removed", removed),
    `${unchanged} screenshot(s) unchanged.`,
    "",
    "**Review before merging:** check every image for errors, empty states and anything that looks like real farm or personal data.",
    "",
  ]
  writeFileSync(SUMMARY_FILE, summary.join("\n"))
  console.log(summary.join("\n"))
})
