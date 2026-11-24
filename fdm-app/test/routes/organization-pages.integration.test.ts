/**
 * The organization pages read the fields of all farms of the organization at once, and the farms
 * table reads cultivations and fertilizer applications per farm instead of per field. These tests
 * check that the results are the same as those of the per-farm and per-field reads.
 *
 * Covered loaders: the organization overview (`organization.$slug._index`), the indicators table
 * and map (`organization.$slug.$calendar.indicators`, `...atlas.indicators`), the nitrogen and
 * organic matter balances (`...balance.nitrogen._index`, `...balance.organic-matter._index`) and
 * the farms table (`organization.$slug.$calendar.farms._index`).
 */
import {
  acceptInvitation,
  getCultivations,
  getFarm,
  getFertilizerApplications,
  getFertilizers,
  getFields,
  grantRoleToFarm,
  listPendingInvitationsForFarm,
  listPrincipalsForFarm,
} from "@nmi-agro/fdm-core"
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { auth } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { fdm } from "~/lib/fdm.server"
import { loader as atlasIndicatorsLoader } from "~/routes/organization.$slug.$calendar.atlas.indicators"
import { loader as nitrogenBalanceLoader } from "~/routes/organization.$slug.$calendar.balance.nitrogen._index"
import { loader as organicMatterBalanceLoader } from "~/routes/organization.$slug.$calendar.balance.organic-matter._index"
import { loader as farmsLoader } from "~/routes/organization.$slug.$calendar.farms._index"
import { loader as indicatorsLoader } from "~/routes/organization.$slug.$calendar.indicators"
import { loader as organizationLoader } from "~/routes/organization.$slug._index"
import { seedOrganization } from "../../e2e/seed/organization"
import { loaderArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

const realFetch = globalThis.fetch
// No request may leave for the NMI API. The indicator scores that stream in from it then fail,
// which the pages handle per farm; these tests only look at the fields. The integrations are
// not mocked: with `isolate: false` a module mock can outlive this file and break other files
// that use the same module (such as the farm warm-up).
const fetchStub: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.origin === "https://api.nmi-agro.nl") {
    return new Response("Not available in tests", { status: 503 })
  }
  return realFetch(input, init)
}

let owner: SeededUser
let otherOwner: SeededUser
let organization: { id: string; slug: string; name: string }
let farmIds: string[]
let calendar: string

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchStub)
  owner = await seedUserWithFarm("orgowner")
  otherOwner = await seedUserWithFarm("orgfarmer")
  calendar = String(owner.ids.year)

  // An organization of `owner` with advisor access to the farms of both users
  const slug = `test-org-${randomUUID().slice(0, 8)}`
  const seeded = await seedOrganization(
    fdm as unknown as Parameters<typeof seedOrganization>[0],
    owner.user.id,
    owner.ids.farm,
    owner.ids.year,
    { name: "Test Adviesbureau", slug },
  )
  organization = { id: seeded.id, slug, name: "Test Adviesbureau" }

  await grantRoleToFarm(fdm, otherOwner.user.id, slug, otherOwner.ids.farm, "advisor")
  const invitation = (
    await listPendingInvitationsForFarm(fdm, otherOwner.user.id, otherOwner.ids.farm)
  ).find((pending) => pending.target_principal_id === organization.id)
  if (!invitation) throw new Error("The organization has no invitation for the second farm")
  // The owner of the organization accepts on its behalf
  await acceptInvitation(fdm, invitation.invitation_id, owner.user.id)

  farmIds = [owner.ids.farm, otherOwner.ids.farm]

  // The loaders look up the organization through better-auth, with the session cookie of the
  // request. The tests have no cookie, so these calls answer for the signed-in owner.
  vi.spyOn(auth.api, "listOrganizations").mockImplementation((async () => [
    {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: null,
      createdAt: new Date(),
      metadata: undefined,
    },
  ]) as unknown as typeof auth.api.listOrganizations)
  vi.spyOn(auth.api, "listMembers").mockImplementation((async () => ({
    members: [
      {
        id: `member-${owner.user.id}`,
        organizationId: organization.id,
        userId: owner.user.id,
        role: "owner",
        createdAt: new Date(),
        user: { id: owner.user.id, email: owner.user.email, name: "Test orgowner" },
      },
    ],
    total: 1,
  })) as unknown as typeof auth.api.listMembers)
})

afterAll(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** The total area of the fields of each farm, read per farm with `getFields`. */
async function areaPerFarm(
  principal_id: string,
  timeframe?: ReturnType<typeof getTimeframe>,
): Promise<Map<string, number>> {
  const areas = new Map<string, number>()
  for (const b_id_farm of farmIds) {
    const fields = await getFields(fdm, principal_id, b_id_farm, timeframe)
    areas.set(
      b_id_farm,
      fields.reduce((total, field) => total + (field.b_area ?? 0), 0),
    )
  }
  return areas
}

const calendarParams = () => ({ slug: organization.slug, calendar })

/** A sorted copy of a list of ids. */
const sorted = (ids: string[]) => [...ids].sort((a, b) => a.localeCompare(b))

describe("organization pages", () => {
  it("has two farms with fields in the organization", async () => {
    const areas = await areaPerFarm(organization.id, getTimeframe({ calendar }))
    expect([...areas.keys()]).toEqual(farmIds)
    for (const area of areas.values()) expect(area).toBeGreaterThan(0)
  })

  it("overview: the area per farm and in total equal the per-farm reads", async () => {
    signInAs(owner.user)
    const { status, data } = await runRoute(() =>
      organizationLoader(
        loaderArgs(`/organization/${organization.slug}?calendar=${calendar}`, {
          slug: organization.slug,
        }) as Parameters<typeof organizationLoader>[0],
      ),
    )
    expect(status).toBe(200)
    const result = data as {
      farms: { b_id_farm: string; b_area_farm: number }[]
      totalArea: number
    }

    const expected = await areaPerFarm(owner.user.id, getTimeframe({ calendar }))
    expect(sorted(result.farms.map((farm) => farm.b_id_farm))).toEqual(sorted(farmIds))
    for (const farm of result.farms) {
      expect(farm.b_area_farm).toBe(expected.get(farm.b_id_farm))
    }
    expect(result.totalArea).toBeCloseTo(
      [...expected.values()].reduce((total, area) => total + area, 0),
      10,
    )
  })

  it("indicators: the area per farm equals the per-farm reads", async () => {
    signInAs(owner.user)
    const path = `/organization/${organization.slug}/${calendar}/indicators`
    const { status, data } = await runRoute(() =>
      indicatorsLoader(
        loaderArgs(path, calendarParams()) as Parameters<typeof indicatorsLoader>[0],
      ),
    )
    expect(status).toBe(200)
    const result = data as {
      farms: { b_id: string; b_area: number }[]
      farmScoreStreams: Promise<unknown>[]
    }
    await Promise.allSettled(result.farmScoreStreams)

    const expected = await areaPerFarm(organization.id)
    expect(sorted(result.farms.map((farm) => farm.b_id))).toEqual(sorted(farmIds))
    for (const farm of result.farms) {
      expect(farm.b_area).toBe(expected.get(farm.b_id))
    }
  })

  it("indicators map: the fields equal the per-farm reads", async () => {
    signInAs(owner.user)
    const path = `/organization/${organization.slug}/${calendar}/atlas/indicators`
    const { status, data } = await runRoute(() =>
      atlasIndicatorsLoader(
        loaderArgs(path, calendarParams()) as Parameters<typeof atlasIndicatorsLoader>[0],
      ),
    )
    expect(status).toBe(200)
    const result = data as {
      fieldsGeoJSON: {
        features: { properties: { b_id_farm: string; b_id: string; b_area: number } }[]
      }
      farmScoreStreams: Promise<unknown>[]
    }
    await Promise.allSettled(result.farmScoreStreams)

    const expected = []
    for (const b_id_farm of sorted(farmIds)) {
      for (const field of await getFields(fdm, organization.id, b_id_farm)) {
        expected.push({ b_id_farm, b_id: field.b_id, b_area: field.b_area })
      }
    }
    const actual = result.fieldsGeoJSON.features.map(({ properties }) => ({
      b_id_farm: properties.b_id_farm,
      b_id: properties.b_id,
      b_area: properties.b_area,
    }))
    // Group the features by farm, keeping the order of the fields within each farm
    expect(
      sorted(farmIds).flatMap((b_id_farm) =>
        actual.filter((feature) => feature.b_id_farm === b_id_farm),
      ),
    ).toEqual(expected)
  })

  it.each([
    ["nitrogen", nitrogenBalanceLoader],
    ["organic-matter", organicMatterBalanceLoader],
  ] as const)(
    "%s balance: the area per farm equals the per-farm reads",
    async (balance, loader) => {
      signInAs(owner.user)
      const path = `/organization/${organization.slug}/${calendar}/balance/${balance}`
      const { status, data } = await runRoute(() =>
        loader(loaderArgs(path, calendarParams()) as Parameters<typeof loader>[0]),
      )
      expect(status).toBe(200)
      const asyncData = await (
        data as {
          asyncData: Promise<{
            farmIds: string[]
            farms: { b_id_farm: string; b_area_farm: number; hasFields: boolean }[]
          }>
        }
      ).asyncData

      const expected = await areaPerFarm(organization.id)
      expect(sorted(asyncData.farms.map((farm) => farm.b_id_farm))).toEqual(sorted(farmIds))
      for (const farm of asyncData.farms) {
        expect(farm.b_area_farm).toBe(expected.get(farm.b_id_farm))
        expect(farm.hasFields).toBe(true)
      }
      // Farms with fields are selected, largest first
      expect(asyncData.farmIds).toEqual(asyncData.farms.map((farm) => farm.b_id_farm))
    },
    60_000,
  )

  it("farms table: the rows equal those from the per-field reads", async () => {
    signInAs(owner.user)
    const path = `/organization/${organization.slug}/${calendar}/farms`
    const { status, data } = await runRoute(() =>
      farmsLoader(loaderArgs(path, calendarParams()) as Parameters<typeof farmsLoader>[0]),
    )
    expect(status).toBe(200)
    const rows = (data as { data: FarmRow[] }).data

    expect(sorted(rows.map((row) => row.b_id_farm))).toEqual(sorted(farmIds))
    for (const row of rows) {
      const expected = await farmRowPerField(row.b_id_farm)
      const { groups: _groups, ...actual } = row
      expect({
        ...actual,
        fields: actual.fields.map(({ groups: _fieldGroups, ...field }) => field),
      }).toEqual(expected)
    }
    // The seeded farms have crops and fertilizer applications in the calendar year
    expect(rows.every((row) => row.cultivations.length > 0)).toBe(true)
    expect(rows.every((row) => row.fertilizers.length > 0)).toBe(true)
  })
})

interface FarmRowField {
  type: string
  b_id_farm: string
  b_name_farm: string
  owner: null
  b_area: number
  cultivations: { b_lu_catalogue: string }[]
  fertilizers: { p_id: string }[]
  groups?: unknown
}

interface FarmRow {
  type: string
  b_id_farm: string
  b_name_farm: string
  owners: unknown[]
  groups: unknown
  b_area: number
  cultivations: { b_lu_catalogue: string }[]
  fertilizers: { p_id: string }[]
  fields: FarmRowField[]
}

/**
 * A row of the farms table as the loader built it before, with `getCultivations` and
 * `getFertilizerApplications` per field (without the groups).
 */
async function farmRowPerField(b_id_farm: string) {
  const timeframe = getTimeframe({ calendar })
  const principal_id = organization.id
  const farm = await getFarm(fdm, principal_id, b_id_farm)
  const fields = await getFields(fdm, principal_id, b_id_farm, timeframe)
  const fertilizers = await getFertilizers(fdm, principal_id, b_id_farm)
  const owners = (await listPrincipalsForFarm(fdm, principal_id, b_id_farm)).filter(
    (accessor) => accessor.type === "user" && accessor.role === "owner",
  )

  const fieldRows = []
  for (const field of fields) {
    const cultivations: Record<string, unknown> = {}
    for (const cultivation of await getCultivations(fdm, principal_id, field.b_id, timeframe)) {
      cultivations[cultivation.b_lu_catalogue] ??= {
        b_lu_catalogue: cultivation.b_lu_catalogue,
        b_lu_name: cultivation.b_lu_name,
        b_lu_croprotation: cultivation.b_lu_croprotation,
      }
    }
    const fieldFertilizers: Record<string, unknown> = {}
    for (const application of await getFertilizerApplications(
      fdm,
      principal_id,
      field.b_id,
      timeframe,
    )) {
      const fertilizer = fertilizers.find((candidate) => candidate.p_id === application.p_id)
      if (fertilizer) {
        fieldFertilizers[fertilizer.p_id] = {
          p_id: fertilizer.p_id,
          p_name_nl: fertilizer.p_name_nl,
          p_type: fertilizer.p_type,
          p_type_rvo: fertilizer.p_type_rvo,
        }
      }
    }
    fieldRows.push({
      type: "field",
      b_id_farm: field.b_id,
      b_name_farm: field.b_name,
      owner: null,
      b_area: field.b_area,
      cultivations: Object.values(cultivations) as { b_lu_catalogue: string }[],
      fertilizers: Object.values(fieldFertilizers) as { p_id: string }[],
    })
  }

  const cultivations: Record<string, unknown> = {}
  const farmFertilizers: Record<string, unknown> = {}
  for (const field of fieldRows) {
    for (const cultivation of field.cultivations) {
      cultivations[cultivation.b_lu_catalogue] ??= cultivation
    }
    for (const fertilizer of field.fertilizers) {
      farmFertilizers[fertilizer.p_id] ??= fertilizer
    }
  }

  return {
    type: "farm",
    b_id_farm,
    b_name_farm: farm.b_name_farm,
    owners,
    b_area: fields.reduce((total, field) => total + (field.b_area ?? 0), 0),
    cultivations: Object.values(cultivations),
    fertilizers: Object.values(farmFertilizers),
    fields: fieldRows,
  }
}
