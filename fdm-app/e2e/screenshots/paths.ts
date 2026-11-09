/**
 * Files of the `screenshots` project.
 */
import { join } from "node:path"
import { APP_ROOT, OUTPUT_DIR } from "../support/env"

/** Working files of a screenshot run. Not committed. */
export const RUN_DIR = join(OUTPUT_DIR, "screenshots")

/** Ids written by the seed, read by the captures. */
export const DEMO_FARM_FILE = join(RUN_DIR, "demo-farm.json")

/** Cookies and local storage of the signed-in demo user. */
export const STORAGE_STATE_FILE = join(RUN_DIR, "storage-state.json")

/** Local storage of a visitor who is not signed in, with the notices dismissed. */
export const SIGNED_OUT_STATE_FILE = join(RUN_DIR, "signed-out-state.json")

/** One result file per capture (added, changed or unchanged), read by the teardown. */
export const RESULTS_DIR = join(RUN_DIR, "results")

/** Summary of added, changed and removed images, used as the pull request body. */
export const SUMMARY_FILE = join(RUN_DIR, "summary.md")

/** Where the screenshots and their manifest are committed. */
export const SCREENSHOTS_DIR = join(APP_ROOT, "app", "content", "manual", "screenshots")
