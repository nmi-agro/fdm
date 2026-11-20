/**
 * The data of a smoke run: the `minimal` demo farm and a second user.
 */
import { readFileSync } from "node:fs"
import type { DemoFarmIds, SeedUser } from "../seed/demo-farm"
import type { SeededOrganization } from "../seed/organization"
import { SMOKE_FARM_FILE } from "./paths"

/** A second synthetic user without a farm, who is invited to the demo farm in the flows. */
export const INVITEE: SeedUser = {
  email: "adviseur@example.com",
  username: "adviseur",
  firstname: "Ada",
  surname: "Adviseur",
}

/** What the smoke setup seeded. */
export interface SmokeFarm extends DemoFarmIds {
  /** The e-mail address of {@link INVITEE}. */
  invitee: string
  /** An organization of the farm's owner, with advisor access to the farm and a farm group. */
  organization: SeededOrganization
}

let cached: SmokeFarm | undefined

/**
 * Reads the ids that the smoke setup wrote.
 *
 * @returns The seeded farm and users.
 */
export function readSmokeFarm(): SmokeFarm {
  cached ??= JSON.parse(readFileSync(SMOKE_FARM_FILE, "utf8")) as SmokeFarm
  return cached
}
