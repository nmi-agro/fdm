/**
 * The actions of the farm measures page (`farm.$b_id_farm.$calendar.measures._index`) save all
 * changes of one submit in one transaction: either every change is saved, or none is.
 */
import {
  addMeasure,
  enableMeasureCatalogue,
  getMeasures,
  syncMeasuresCatalogueArray,
} from "@nmi-agro/fdm-core"
import { beforeAll, describe, expect, it } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { action } from "~/routes/farm.$b_id_farm.$calendar.measures._index"
import { runRoute, type SeededUser, seedUserWithFarm, TEST_ORIGIN } from "../helpers"
import { signInAs } from "../session"

/** Synthetic measures, so the tests do not depend on the real catalogue. */
const MEASURE_A = "bln_TEST_FARM_MEASURES_A"
const MEASURE_B = "bln_TEST_FARM_MEASURES_B"
const MEASURE_C = "bln_TEST_FARM_MEASURES_C"

let owner: SeededUser
let calendar: string
let fieldIds: string[]

beforeAll(async () => {
  owner = await seedUserWithFarm("measures")
  calendar = String(owner.ids.year)
  fieldIds = Object.values(owner.ids.fields).filter((b_id): b_id is string => !!b_id)
  if (fieldIds.length < 2) throw new Error("The seed has fewer than two fields")

  await syncMeasuresCatalogueArray(
    fdm,
    [MEASURE_A, MEASURE_B, MEASURE_C].map((m_id) => ({
      m_id,
      m_source: "bln",
      m_name: `Testmaatregel ${m_id}`,
      m_description: null,
      m_summary: null,
      m_source_url: null,
      m_conflicts: null,
    })),
  )
  try {
    await enableMeasureCatalogue(fdm, owner.user.id, owner.ids.farm, "bln")
  } catch {
    // Already enabled by the seed
  }
})

/** Submits the measures form with the given fields; a key may repeat. */
function submit(fields: [string, string][]) {
  const url = new URL(`/farm/${owner.ids.farm}/${calendar}/measures?index`, TEST_ORIGIN)
  return runRoute(() =>
    action({
      request: new Request(url, { method: "POST", body: new URLSearchParams(fields) }),
      url,
      params: { b_id_farm: owner.ids.farm, calendar },
      context: {},
      unstable_pattern: "",
    } as unknown as Parameters<typeof action>[0]),
  )
}

/** The measures with the given catalogue id on a field. */
async function measuresOf(b_id: string, m_id: string) {
  return (await getMeasures(fdm, owner.user.id, b_id)).filter((measure) => measure.m_id === m_id)
}

describe("farm measures actions", () => {
  it("adds a measure to every selected field in one save", async () => {
    signInAs(owner.user)
    const { status } = await submit([
      ["intent", "add"],
      ["m_id", MEASURE_A],
      ["m_start", `${calendar}-03-01`],
      ...fieldIds.map((b_id): [string, string] => ["b_id", b_id]),
    ])
    expect(status).toBe(200)
    for (const b_id of fieldIds) {
      expect(await measuresOf(b_id, MEASURE_A)).toHaveLength(1)
    }
  })

  it("keeps every measure unchanged when one of the updates fails", async () => {
    const [first, second] = fieldIds
    const early = await addMeasure(
      fdm,
      owner.user.id,
      first,
      MEASURE_B,
      new Date(`${Number(calendar) - 5}-01-01`),
    )
    const late = await addMeasure(
      fdm,
      owner.user.id,
      second,
      MEASURE_B,
      new Date(`${calendar}-06-01`),
    )

    signInAs(owner.user)
    // The end date is after the start of the early measure, but before that of the late one
    const { status } = await submit([
      ["intent", "update"],
      ["b_id_measure", early],
      ["b_id_measure", late],
      ["m_end", `${Number(calendar) - 1}-12-31`],
    ])
    expect(status).toBeGreaterThanOrEqual(400)

    const [earlyAfter] = await measuresOf(first, MEASURE_B)
    expect(earlyAfter.b_id_measure).toBe(early)
    expect(earlyAfter.m_end).toBeNull()

    // Without the failing update, the change is saved
    const updated = await submit([
      ["intent", "update"],
      ["b_id_measure", early],
      ["m_end", `${Number(calendar) - 1}-12-31`],
    ])
    expect(updated.status).toBe(200)
    expect((await measuresOf(first, MEASURE_B))[0].m_end).not.toBeNull()
  })

  it("keeps every measure when one of the removals fails", async () => {
    // Its own measure, so this test does not depend on the other tests
    const [first] = fieldIds
    const b_id_measure = await addMeasure(
      fdm,
      owner.user.id,
      first,
      MEASURE_C,
      new Date(`${calendar}-04-01`),
    )

    signInAs(owner.user)
    const { status } = await submit([
      ["intent", "delete"],
      ["b_id_measure", b_id_measure],
      ["b_id_measure", "does-not-exist"],
    ])
    expect(status).toBeGreaterThanOrEqual(400)
    expect(await measuresOf(first, MEASURE_C)).toHaveLength(1)

    // Without the failing removal, the measure is removed
    const removed = await submit([
      ["intent", "delete"],
      ["b_id_measure", b_id_measure],
    ])
    expect(removed.status).toBe(200)
    expect(await measuresOf(first, MEASURE_C)).toHaveLength(0)
  })
})
