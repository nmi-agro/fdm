/**
 * Prepares a screenshot run, after the app has started:
 *
 * 1. seeds the `demo` farm into the (empty) database;
 * 2. signs in as the demo user through the magic-link flow;
 * 3. stores the session, with the cookie banner and the changelog notification dismissed.
 */

import { createFdmServer } from "@nmi-agro/fdm-core"
import { test as setup } from "@playwright/test"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import type { DemoFarmIds } from "../seed/demo-farm"
import { seedFarm } from "../seed"
import { latestChangelogVersion } from "../support/app"
import { dismissNotices, signInWithMagicLink } from "../support/auth"
import { databaseOptions } from "../support/env"
import {
  DEMO_FARM_FILE,
  RESULTS_DIR,
  RUN_DIR,
  SIGNED_OUT_STATE_FILE,
  STORAGE_STATE_FILE,
} from "./paths"

setup("seed the demo farm and sign in", async ({ page }) => {
  setup.setTimeout(300_000)
  // Locally, E2E_REUSE_SEED=1 keeps the farm of the previous run, so you can capture again
  // against a server that is still running. Without it the database must be empty.
  const reuse = process.env.E2E_REUSE_SEED === "1" && existsSync(DEMO_FARM_FILE)
  if (!reuse) {
    rmSync(RUN_DIR, { recursive: true, force: true })
    mkdirSync(RUN_DIR, { recursive: true })
  }
  rmSync(RESULTS_DIR, { recursive: true, force: true })

  let email: string
  if (reuse) {
    email = (JSON.parse(readFileSync(DEMO_FARM_FILE, "utf8")) as DemoFarmIds).email
  } else {
    const { host, port, user, password, database } = databaseOptions()
    const fdm = createFdmServer(host, port, user, password, database, 2)
    try {
      const ids = await seedFarm(fdm, { variant: "demo" })
      writeFileSync(
        DEMO_FARM_FILE,
        `${JSON.stringify(ids, null, 2)}
`,
      )
      email = ids.email
    } finally {
      await (fdm as unknown as { $client: { end: () => Promise<void> } }).$client.end()
    }
  }

  await dismissNotices(page, latestChangelogVersion())
  await page.goto("/signin")
  await page.context().storageState({ path: SIGNED_OUT_STATE_FILE })
  await signInWithMagicLink(page, email)
  await page.context().storageState({ path: STORAGE_STATE_FILE })
})
