/**
 * Prepares a smoke run, after the app has started:
 *
 * 1. seeds the `minimal` farm into the (empty) database, an organization of its owner with
 *    access to the farm and a farm group, and a second user without a farm for the invitation
 *    flow;
 * 2. signs in as the farm's owner through the magic-link flow;
 * 3. stores the session, with the cookie banner and the changelog notification dismissed.
 */

import { createFdmServer } from "@nmi-agro/fdm-core"
import { test as setup } from "@playwright/test"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createSeedUser, seedFarm } from "../seed"
import { seedOrganization } from "../seed/organization"
import { latestChangelogVersion } from "../support/app"
import { dismissNotices, signInWithMagicLink } from "../support/auth"
import { databaseOptions } from "../support/env"
import { RUN_DIR, SIGNED_OUT_STATE_FILE, SMOKE_FARM_FILE, STORAGE_STATE_FILE } from "./paths"
import { INVITEE, type SmokeFarm } from "./smoke-farm"

setup("seed the minimal farm and sign in", async ({ page }) => {
  setup.setTimeout(300_000)
  // Locally, E2E_REUSE_SEED=1 keeps the farm of the previous run, so you can run again against
  // a server that is still running. Without it the database must be empty.
  const reuse = process.env.E2E_REUSE_SEED === "1" && existsSync(SMOKE_FARM_FILE)
  let farm: SmokeFarm
  if (reuse) {
    farm = JSON.parse(readFileSync(SMOKE_FARM_FILE, "utf8")) as SmokeFarm
  } else {
    rmSync(RUN_DIR, { recursive: true, force: true })
    mkdirSync(RUN_DIR, { recursive: true })
    const { host, port, user, password, database } = databaseOptions()
    const fdm = createFdmServer(host, port, user, password, database, 2)
    try {
      const ids = await seedFarm(fdm, { variant: "minimal" })
      const organization = await seedOrganization(fdm, ids.principalId, ids.farm, ids.year)
      await createSeedUser(fdm, INVITEE)
      farm = { ...ids, invitee: INVITEE.email, organization }
      writeFileSync(SMOKE_FARM_FILE, `${JSON.stringify(farm, null, 2)}\n`)
    } finally {
      await (fdm as unknown as { $client: { end: () => Promise<void> } }).$client.end()
    }
  }

  // Reuse the session too: the app allows only a few sign-ins per quarter of an hour.
  if (reuse && existsSync(STORAGE_STATE_FILE)) return

  await dismissNotices(page, latestChangelogVersion())
  await page.goto("/signin")
  await page.context().storageState({ path: SIGNED_OUT_STATE_FILE })
  await signInWithMagicLink(page, farm.email)
  await page.context().storageState({ path: STORAGE_STATE_FILE })
})
