/**
 * Files of the `smoke` project.
 */
import { join } from "node:path"
import { OUTPUT_DIR } from "../support/env"

/** Working files of a smoke run. Not committed. */
export const RUN_DIR = join(OUTPUT_DIR, "smoke")

/** Ids written by the setup, read by the tests. */
export const SMOKE_FARM_FILE = join(RUN_DIR, "farm.json")

/** Cookies and local storage of the signed-in smoke user. */
export const STORAGE_STATE_FILE = join(RUN_DIR, "storage-state.json")

/** Local storage of a visitor who is not signed in, with the notices dismissed. */
export const SIGNED_OUT_STATE_FILE = join(RUN_DIR, "signed-out-state.json")
