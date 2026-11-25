/**
 * The soil page (`farm.$b_id_farm.$calendar.field.$b_id.soil._index`), the harvest dialog
 * (`farm.$b_id_farm.$calendar.rotation.modify_harvest`) and the page to change the applications of
 * a fertilizer (`farm.$b_id_farm.$calendar.rotation_.modify_fertilizer.$p_id`) check the write
 * permission once on the farm or field instead of once per soil analysis, harvest or application.
 * These tests check that the result is the same as that of the per-item checks, for the owner and
 * for a user who may only read the farm.
 */
import {
  acceptInvitation,
  checkPermission,
  getFertilizerApplications,
  getHarvests,
  grantRoleToFarm,
  listPendingInvitationsForPrincipal,
} from "@nmi-agro/fdm-core"
import { sql } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { loader as soilLoader } from "~/routes/farm.$b_id_farm.$calendar.field.$b_id.soil._index"
import {
  action as modifyHarvestAction,
  loader as modifyHarvestLoader,
} from "~/routes/farm.$b_id_farm.$calendar.rotation.modify_harvest"
import { loader as modifyFertilizerLoader } from "~/routes/farm.$b_id_farm.$calendar.rotation_.modify_fertilizer.$p_id"
import { loaderArgs, runRoute, type SeededUser, seedUserWithFarm, TEST_ORIGIN } from "../helpers"
import { signInAs } from "../session"

let owner: SeededUser
let researcher: SeededUser
let calendar: string
let fieldIds: string[]

beforeAll(async () => {
  owner = await seedUserWithFarm("permowner")
  researcher = await seedUserWithFarm("permresearcher")
  calendar = String(owner.ids.year)
  fieldIds = Object.values(owner.ids.fields).filter((b_id): b_id is string => !!b_id)

  // A user who may only read the farm. Only a verified address can accept an invitation.
  await fdm.execute(
    sql`update "fdm-authn"."user" set email_verified = true where id = ${researcher.user.id}`,
  )
  await grantRoleToFarm(fdm, owner.user.id, researcher.user.email, owner.ids.farm, "researcher")
  const invitations = await listPendingInvitationsForPrincipal(fdm, researcher.user.id)
  const invitation = invitations.find((candidate) => candidate.resource_id === owner.ids.farm)
  if (!invitation) throw new Error("The researcher has no invitation for the farm")
  await acceptInvitation(fdm, invitation.invitation_id, researcher.user.id)
})

/** The per-item write checks, by id. */
async function writePermissions(
  user: SeededUser,
  resource: "soil_analysis" | "harvesting" | "fertilizer_application",
  ids: string[],
) {
  const permissions = await Promise.all(
    ids.map((id) => checkPermission(fdm, resource, "write", id, user.user.id, "test", false)),
  )
  return Object.fromEntries(ids.map((id, i) => [id, permissions[i]]))
}

/** The harvests of all seeded fields. */
function seededHarvestIds() {
  return Object.values(owner.ids.records).flatMap((records) => records?.harvests ?? [])
}

describe.each([
  ["owner", () => owner, true],
  ["researcher", () => researcher, false],
] as const)("as %s", (_label, user, canWrite) => {
  it("gives each soil analysis the permission of the per-analysis check", async () => {
    signInAs(user().user)
    for (const b_id of fieldIds) {
      const path = `/farm/${owner.ids.farm}/${calendar}/field/${b_id}/soil`
      const { status, data } = await runRoute(() =>
        soilLoader(loaderArgs(path, { b_id_farm: owner.ids.farm, calendar, b_id })),
      )
      expect(status).toBe(200)

      const { soilAnalyses, soilAnalysisWritePermissions } = data as {
        soilAnalyses: { a_id: string }[]
        soilAnalysisWritePermissions: Record<string, boolean>
      }
      expect(soilAnalyses.length).toBeGreaterThan(0)
      const expected = await writePermissions(
        user(),
        "soil_analysis",
        soilAnalyses.map((analysis) => analysis.a_id),
      )
      expect(soilAnalysisWritePermissions).toEqual(expected)
      expect(Object.values(expected).every((allowed) => allowed === canWrite)).toBe(true)
    }
  })

  it("lets the harvest dialog edit the harvests as the per-harvest checks allow", async () => {
    signInAs(user().user)
    const harvestingIds = seededHarvestIds()
    const path = `/farm/${owner.ids.farm}/${calendar}/rotation/modify_harvest?harvestingIds=${harvestingIds[0]}`
    const { status, data } = await runRoute(() =>
      modifyHarvestLoader(
        loaderArgs(path, { b_id_farm: owner.ids.farm, calendar }) as Parameters<
          typeof modifyHarvestLoader
        >[0],
      ),
    )
    expect(status).toBe(200)

    const expected = await writePermissions(user(), "harvesting", [harvestingIds[0]])
    expect((data as { harvestingWritePermission: boolean }).harvestingWritePermission).toBe(
      expected[harvestingIds[0]],
    )
    expect(expected[harvestingIds[0]]).toBe(canWrite)
  })

  it("marks each application as changeable as the per-application checks do", async () => {
    signInAs(user().user)
    const applications = (
      await Promise.all(fieldIds.map((b_id) => getFertilizerApplications(fdm, owner.user.id, b_id)))
    ).flat()
    const p_id = applications[0].p_id
    const path = `/farm/${owner.ids.farm}/${calendar}/rotation/modify_fertilizer/${p_id}?fieldIds=${fieldIds.join(",")}`
    const { status, data } = await runRoute(() =>
      modifyFertilizerLoader(
        loaderArgs(path, { b_id_farm: owner.ids.farm, calendar, p_id }) as Parameters<
          typeof modifyFertilizerLoader
        >[0],
      ),
    )
    expect(status).toBe(200)

    const shown = (data as { applications: { p_app_id: string; canModify: boolean }[] })
      .applications
    expect(shown.length).toBeGreaterThan(0)
    const expected = await writePermissions(
      user(),
      "fertilizer_application",
      shown.map((app) => app.p_app_id),
    )
    expect(Object.fromEntries(shown.map((app) => [app.p_app_id, app.canModify]))).toEqual(expected)
    expect(Object.values(expected).every((allowed) => allowed === canWrite)).toBe(true)
  })
})

describe("harvest dialog", () => {
  it("edits only the harvests the user may change, also from another farm", async () => {
    const stranger = await seedUserWithFarm("permstranger")
    const strangerHarvests = Object.values(stranger.ids.records).flatMap(
      (records) => records?.harvests ?? [],
    )
    const ownHarvests = seededHarvestIds()
    signInAs(owner.user)

    const harvestingIds = [strangerHarvests[0], ...ownHarvests]
    const path = `/farm/${owner.ids.farm}/${calendar}/rotation/modify_harvest?harvestingIds=${harvestingIds.join(",")}`
    const { status, data } = await runRoute(() =>
      modifyHarvestLoader(
        loaderArgs(path, { b_id_farm: owner.ids.farm, calendar }) as Parameters<
          typeof modifyHarvestLoader
        >[0],
      ),
    )
    expect(status).toBe(200)
    const expected = await writePermissions(owner, "harvesting", harvestingIds)
    expect(expected[strangerHarvests[0]]).toBe(false)
    const modifiable = harvestingIds.filter((id) => expected[id])
    expect(data).toMatchObject({
      harvestingWritePermission: modifiable.length > 0,
      partial: modifiable.length > 1,
    })
  })

  it("refuses a user who may only read the farm to remove harvests", async () => {
    const [b_id_harvesting] = seededHarvestIds()
    const b_lu = Object.values(owner.ids.records).find((records) =>
      records?.harvests.includes(b_id_harvesting),
    )?.cultivations[0]
    if (!b_lu) throw new Error("The harvest has no cultivation")
    const before = await getHarvests(fdm, owner.user.id, b_lu)

    signInAs(researcher.user)
    const url = new URL(
      `/farm/${owner.ids.farm}/${calendar}/rotation/modify_harvest?harvestingIds=${b_id_harvesting}`,
      TEST_ORIGIN,
    )
    const { status } = await runRoute(() =>
      modifyHarvestAction({
        request: new Request(url, { method: "DELETE" }),
        url,
        params: { b_id_farm: owner.ids.farm, calendar },
        context: {},
        unstable_pattern: "",
      } as unknown as Parameters<typeof modifyHarvestAction>[0]),
    )
    expect(status).toBe(403)
    expect(await getHarvests(fdm, owner.user.id, b_lu)).toEqual(before)
  })
})
