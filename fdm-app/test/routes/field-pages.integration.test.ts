/**
 * The field pages read their data per farm instead of per field or per cultivation: the fields
 * table (`farm.$b_id_farm.$calendar.field`), the field dashboard
 * (`farm.$b_id_farm.$calendar.field.$b_id._index`) and the cultivation page
 * (`farm.$b_id_farm.$calendar.field.$b_id.cultivation`). These tests check that the results are
 * the same as those of the per-item reads.
 */
import {
  acceptInvitation,
  addSoilAnalysis,
  getCultivations,
  getHarvests,
  grantRoleToFarm,
  listPendingInvitationsForPrincipal,
} from "@nmi-agro/fdm-core"
import { sql } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"
import { deriveBcsScores } from "~/lib/bcs-derived.server"
import { computeBcs } from "~/lib/bcs.server"
import { getTimeframe } from "~/lib/calendar"
import { fdm } from "~/lib/fdm.server"
import { loader as fieldsTableLoader } from "~/routes/farm.$b_id_farm.$calendar.field"
import { loader as fieldDashboardLoader } from "~/routes/farm.$b_id_farm.$calendar.field.$b_id._index"
import { loader as cultivationLoader } from "~/routes/farm.$b_id_farm.$calendar.field.$b_id.cultivation"
import { loaderArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

const BCS_SCORES = {
  a_cc_bcs: 2,
  a_rd_bcs: 1,
  a_sc_bcs: 1,
  a_ew_bcs: 1,
  a_ss_bcs: 1,
  a_gs_bcs: 2,
  a_p_bcs: 1,
  a_c_bcs: 0,
  a_rt_bcs: 1,
}

let owner: SeededUser
let researcher: SeededUser
let calendar: string
let fieldIds: string[]
let bcsField: string
let bcsDate: Date

beforeAll(async () => {
  owner = await seedUserWithFarm("fields")
  researcher = await seedUserWithFarm("researcher")
  calendar = String(owner.ids.year)
  fieldIds = Object.values(owner.ids.fields).filter((b_id): b_id is string => !!b_id)

  // A BCS assessment on one field, so the table derives a lab context from its soil data
  bcsField = fieldIds[0]
  bcsDate = new Date(Date.UTC(owner.ids.year, 3, 15, 12))
  await addSoilAnalysis(fdm, owner.user.id, bcsDate, "other", bcsField, 25, bcsDate, BCS_SCORES)

  // A second user who may only read the farm. Only a verified address can accept an invitation.
  await fdm.execute(
    sql`update "fdm-authn"."user" set email_verified = true where id = ${researcher.user.id}`,
  )
  await grantRoleToFarm(fdm, owner.user.id, researcher.user.email, owner.ids.farm, "researcher")
  const invitations = await listPendingInvitationsForPrincipal(fdm, researcher.user.id)
  const invitation = invitations.find((candidate) => candidate.resource_id === owner.ids.farm)
  if (!invitation) throw new Error("The researcher has no invitation for the farm")
  await acceptInvitation(fdm, invitation.invitation_id, researcher.user.id)
})

/** The timeframe of the calendar year, as the loaders build it. */
function calendarTimeframe() {
  return getTimeframe({ calendar })
}

/** The harvests of a field as the per-cultivation reads return them. */
async function harvestsPerCultivation(principal_id: string, b_id: string) {
  const timeframe = calendarTimeframe()
  const cultivations = await getCultivations(fdm, principal_id, b_id, timeframe)
  const harvests = await Promise.all(
    cultivations.map((cultivation) => getHarvests(fdm, principal_id, cultivation.b_lu, timeframe)),
  )
  return { cultivations, harvests: harvests.flat() }
}

interface FieldsTableRow {
  b_id: string
  has_write_permission: boolean
  bcs: { a_id: string; d_bcs: number; scoreLabel: string } | null
}

async function loadFieldsTable(user: SeededUser) {
  signInAs(user.user)
  const path = `/farm/${owner.ids.farm}/${calendar}/field`
  const { status, data } = await runRoute(() =>
    fieldsTableLoader(loaderArgs(path, { b_id_farm: owner.ids.farm, calendar })),
  )
  expect(status).toBe(200)
  return (data as { fieldsExtended: FieldsTableRow[] }).fieldsExtended
}

describe("fields table", () => {
  it("gives the owner write permission on every field", async () => {
    const rows = await loadFieldsTable(owner)
    expect(rows.map((row) => row.b_id).sort()).toEqual([...fieldIds].sort())
    expect(rows.every((row) => row.has_write_permission)).toBe(true)
  })

  it("gives a researcher no write permission on any field", async () => {
    const rows = await loadFieldsTable(researcher)
    expect(rows).toHaveLength(fieldIds.length)
    expect(rows.some((row) => row.has_write_permission)).toBe(false)
  })

  it("scores the BCS with the same lab context as the per-field read", async () => {
    const rows = await loadFieldsTable(owner)
    const { labContext } = await deriveBcsScores(fdm, owner.user.id, bcsField, bcsDate)
    // The seeded soil analysis has pH and SOM, so the score depends on the lab context
    expect(labContext).not.toBeNull()
    const expected = computeBcs(BCS_SCORES, labContext ?? undefined)

    const row = rows.find((candidate) => candidate.b_id === bcsField)
    expect(row?.bcs?.d_bcs).toBe(expected.d_bcs)
    expect(row?.bcs?.scoreLabel).toBe(expected.scoreLabel)
    for (const other of rows.filter((candidate) => candidate.b_id !== bcsField)) {
      expect(other.bcs).toBeNull()
    }
  })
})

describe("cultivation page", () => {
  it("lists the same harvests as the per-cultivation reads", async () => {
    signInAs(owner.user)
    for (const b_id of fieldIds) {
      const path = `/farm/${owner.ids.farm}/${calendar}/field/${b_id}/cultivation`
      const { status, data } = await runRoute(() =>
        cultivationLoader(loaderArgs(path, { b_id_farm: owner.ids.farm, calendar, b_id })),
      )
      expect(status).toBe(200)

      const expected = await harvestsPerCultivation(owner.user.id, b_id)
      expect(expected.harvests.length).toBeGreaterThan(0)
      expect((data as { harvests: unknown[] }).harvests).toEqual(expected.harvests)
    }
  })
})

describe("field dashboard", () => {
  it("shows the same harvests of the main cultivation as the per-cultivation read", async () => {
    signInAs(owner.user)
    for (const b_id of fieldIds) {
      const path = `/farm/${owner.ids.farm}/${calendar}/field/${b_id}`
      const { status, data } = await runRoute(() =>
        fieldDashboardLoader(loaderArgs(path, { b_id_farm: owner.ids.farm, calendar, b_id })),
      )
      expect(status).toBe(200)

      const active = (
        data as { cultivation: { active: { id: string; harvests: { id: string }[] } | null } }
      ).cultivation.active
      expect(active).not.toBeNull()
      if (!active) continue
      const harvests = await getHarvests(fdm, owner.user.id, active.id, calendarTimeframe())
      expect(active.harvests.map((harvest) => harvest.id).sort()).toEqual(
        harvests.map((harvest) => harvest.b_id_harvesting).sort(),
      )
    }
  })
})
