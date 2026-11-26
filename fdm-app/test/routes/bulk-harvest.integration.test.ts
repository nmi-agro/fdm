/**
 * The bulk harvest page (`farm.$b_id_farm.$calendar.rotation_.harvest._index`) reads the
 * cultivations and harvests once for the farm instead of per field or per cultivation. These tests
 * check that the loader shows the same data as the per-item reads, and that the action still
 * replaces, adds and removes the same harvests.
 */
import {
  type Cultivation,
  getCultivations,
  getHarvests,
  getParametersForHarvestCat,
} from "@nmi-agro/fdm-core"
import { beforeEach, describe, expect, it } from "vitest"
import { getTimeframe } from "~/lib/calendar"
import { fdm } from "~/lib/fdm.server"
import { action, loader } from "~/routes/farm.$b_id_farm.$calendar.rotation_.harvest._index"
import { loaderArgs, runRoute, type SeededUser, seedUserWithFarm, TEST_ORIGIN } from "../helpers"
import { signInAs } from "../session"

/** Grassland, harvested several times a year. */
const GRASS = "nl_265"
/** Winter wheat, harvested once. */
const WHEAT = "nl_233"

/** Plausible values for the harvest parameters that a crop may require. */
const HARVEST_VALUES: Record<string, string> = {
  b_lu_yield: "8000",
  b_lu_yield_fresh: "9000",
  b_lu_yield_bruto: "9500",
  b_lu_tarra: "5",
  b_lu_dm: "850",
  b_lu_moist: "15",
  b_lu_uww: "350",
  b_lu_cp: "110",
  b_lu_n_harvestable: "150",
}

let owner: SeededUser
let calendar: string
let grassField: string
let wheatField: string

// Every test gets its own farm, as the action changes the harvests
beforeEach(async () => {
  owner = await seedUserWithFarm("harvest")
  calendar = String(owner.ids.year)
  const { "grasland-huiskavel": grass, tarwe: wheat } = owner.ids.fields
  if (!grass || !wheat) throw new Error("The seed has no grassland or wheat field")
  grassField = grass
  wheatField = wheat
  signInAs(owner.user)
})

/** The cultivations of a field as the per-field read returns them. */
function cultivationsOf(b_id: string) {
  return getCultivations(fdm, owner.user.id, b_id, getTimeframe({ calendar }))
}

/** The cultivation of a crop on a field. */
async function cultivationOf(b_id: string, b_lu_catalogue: string): Promise<Cultivation> {
  const cultivation = (await cultivationsOf(b_id)).find(
    (candidate) => candidate.b_lu_catalogue === b_lu_catalogue,
  )
  if (!cultivation) throw new Error(`Field ${b_id} has no cultivation ${b_lu_catalogue}`)
  return cultivation
}

function pagePath(cultivation: string, fieldIds?: string[]) {
  const search = new URLSearchParams({ cultivationIds: cultivation })
  if (fieldIds) search.set("fieldIds", fieldIds.join(","))
  return `/farm/${owner.ids.farm}/${calendar}/rotation/harvest?${search}`
}

async function load(cultivation: string, fieldIds?: string[]) {
  const { status, data } = await runRoute(() =>
    loader(loaderArgs(pagePath(cultivation, fieldIds), { b_id_farm: owner.ids.farm, calendar })),
  )
  expect(status).toBe(200)
  return data as {
    selectedFields: { b_id: string; cultivations: string[]; hasHarvest: boolean }[]
    fieldOptions: { b_id: string; cultivations: string[] }[]
    harvestApplication: unknown
    harvestableAnalysis: unknown
    b_lu_start: Date | undefined
  }
}

/** Runs the action with a method and, for a save, the form fields. */
function submit(
  method: "POST" | "DELETE",
  cultivation: string,
  fieldIds: string[],
  form?: Record<string, string>,
) {
  const url = new URL(pagePath(cultivation, fieldIds), TEST_ORIGIN)
  const request = new Request(url, {
    method,
    body: form ? new URLSearchParams(form) : undefined,
  })
  return runRoute(() =>
    action({
      request,
      url,
      params: { b_id_farm: owner.ids.farm, calendar },
      context: {},
      unstable_pattern: "",
    } as unknown as Parameters<typeof action>[0]),
  )
}

/** The form of a single harvest of a crop on a date, with every parameter the crop requires. */
function harvestForm(cultivation: Cultivation, date: Date) {
  const form: Record<string, string> = {
    intent: "single_harvest",
    b_lu_harvest_date: date.toISOString(),
    b_lu_harvestable: cultivation.b_lu_harvestable ?? "once",
  }
  for (const parameter of getParametersForHarvestCat(cultivation.b_lu_harvestcat)) {
    const value = HARVEST_VALUES[parameter]
    if (!value) throw new Error(`No test value for ${parameter}`)
    form[parameter] = value
  }
  return form
}

describe("bulk harvest loader", () => {
  it("lists every field with the cultivations of the per-field read", async () => {
    const data = await load(WHEAT)
    expect(data.fieldOptions.map((field) => field.b_id).sort()).toEqual(
      [grassField, wheatField].sort(),
    )
    for (const field of data.fieldOptions) {
      const cultivations = await cultivationsOf(field.b_id)
      expect(field.cultivations).toEqual(cultivations.map((c) => c.b_lu_catalogue))
    }
  })

  it("prefills a crop harvested once with its latest harvest", async () => {
    const data = await load(WHEAT)
    expect(data.selectedFields.map((field) => field.b_id)).toEqual([wheatField])
    expect(data.selectedFields[0].hasHarvest).toBe(true)

    const wheat = await cultivationOf(wheatField, WHEAT)
    const harvests = await getHarvests(fdm, owner.user.id, wheat.b_lu)
    expect(harvests.length).toBeGreaterThan(0)
    expect(data.harvestApplication).toEqual(harvests[0])
    expect(data.harvestableAnalysis).toEqual(harvests[0].harvestable.harvestable_analyses[0])
    expect(data.b_lu_start).toEqual(wheat.b_lu_start)
  })

  it("marks only the selected fields that have a harvest of the crop", async () => {
    const data = await load(GRASS, [grassField, wheatField])
    const hasHarvest = Object.fromEntries(
      data.selectedFields.map((field) => [field.b_id, field.hasHarvest]),
    )
    expect(hasHarvest).toEqual({ [grassField]: true, [wheatField]: false })
  })
})

describe("bulk harvest action", () => {
  it("replaces the harvest of a crop harvested once", async () => {
    const wheat = await cultivationOf(wheatField, WHEAT)
    const before = await getHarvests(fdm, owner.user.id, wheat.b_lu)
    expect(before).toHaveLength(1)

    const date = new Date(Date.UTC(owner.ids.year, 6, 25, 12))
    const { status } = await submit("POST", WHEAT, [wheatField], harvestForm(wheat, date))
    expect(status).toBe(302)

    const after = await getHarvests(fdm, owner.user.id, wheat.b_lu)
    expect(after).toHaveLength(1)
    expect(after[0].b_id_harvesting).not.toBe(before[0].b_id_harvesting)
    expect(after[0].b_lu_harvest_date).toEqual(date)
  })

  it("adds a cut to grassland without removing the earlier cuts", async () => {
    const grass = await cultivationOf(grassField, GRASS)
    const before = await getHarvests(fdm, owner.user.id, grass.b_lu)

    const date = new Date(Date.UTC(owner.ids.year, 10, 1, 12))
    const { status } = await submit("POST", GRASS, [grassField], harvestForm(grass, date))
    expect(status).toBe(302)

    const after = await getHarvests(fdm, owner.user.id, grass.b_lu)
    expect(after).toHaveLength(before.length + 1)
    expect(after.map((harvest) => harvest.b_id_harvesting)).toEqual(
      expect.arrayContaining(before.map((harvest) => harvest.b_id_harvesting)),
    )
  })

  it("saves nothing when a selected field lacks the crop", async () => {
    const wheat = await cultivationOf(wheatField, WHEAT)
    const before = await getHarvests(fdm, owner.user.id, wheat.b_lu)

    const date = new Date(Date.UTC(owner.ids.year, 6, 25, 12))
    const { status } = await submit(
      "POST",
      WHEAT,
      [wheatField, grassField],
      harvestForm(wheat, date),
    )
    expect(status).toBe(200)
    expect(await getHarvests(fdm, owner.user.id, wheat.b_lu)).toEqual(before)
  })

  it("removes every harvest of the crop on the selected fields", async () => {
    const grass = await cultivationOf(grassField, GRASS)
    const wheat = await cultivationOf(wheatField, WHEAT)
    expect((await getHarvests(fdm, owner.user.id, grass.b_lu)).length).toBeGreaterThan(1)
    const wheatHarvests = await getHarvests(fdm, owner.user.id, wheat.b_lu)

    const { status } = await submit("DELETE", GRASS, [grassField])
    expect(status).toBe(302)

    expect(await getHarvests(fdm, owner.user.id, grass.b_lu)).toEqual([])
    // The other crop keeps its harvests
    expect(await getHarvests(fdm, owner.user.id, wheat.b_lu)).toEqual(wheatHarvests)
  })
})
