/**
 * The fields steps of adding a farm (`farm.create.$b_id_farm.$calendar.fields`) and of adding
 * fields to a farm (`farm.$b_id_farm.$calendar.field.new.fields`) read the fields and their
 * current soil data once for the farm instead of per field. These tests check that they show the
 * same fields and soil status as the per-field reads.
 */
import {
  addFarm,
  addField,
  addSoilAnalysis,
  getField,
  getFields,
  type Field,
} from "@nmi-agro/fdm-core"
import { beforeAll, describe, expect, it } from "vitest"
import { getTimeframe } from "~/lib/calendar"
import { fdm } from "~/lib/fdm.server"
import { loader as newFieldsLoader } from "~/routes/farm.$b_id_farm.$calendar.field.new.fields"
import { loader as createFieldsLoader } from "~/routes/farm.create.$b_id_farm.$calendar.fields"
import { loaderArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

let owner: SeededUser
let calendar: string
/** The seeded fields, with a measured soil analysis each. */
let measuredFields: string[]
/** A field with only an estimated soil analysis. */
let estimatedField: string
/** A field without soil data. */
let bareField: string
/** A field of another farm of the same user, with a measured soil analysis. */
let otherFarmField: string

beforeAll(async () => {
  owner = await seedUserWithFarm("fieldsstep")
  calendar = String(owner.ids.year)
  measuredFields = Object.values(owner.ids.fields).filter((b_id): b_id is string => !!b_id)

  const { b_geometry } = await getField(fdm, owner.user.id, measuredFields[0])
  const b_start = new Date(Date.UTC(owner.ids.year - 1, 0, 1, 12))
  estimatedField = await addField(
    fdm,
    owner.user.id,
    owner.ids.farm,
    "Perceel met schatting",
    null,
    b_geometry,
    b_start,
    "nl_01",
  )
  const sampled = new Date(Date.UTC(owner.ids.year, 1, 1, 12))
  await addSoilAnalysis(fdm, owner.user.id, sampled, "nl-other-nmi", estimatedField, 30, sampled, {
    a_som_loi: 3.5,
  })
  bareField = await addField(
    fdm,
    owner.user.id,
    owner.ids.farm,
    "Perceel zonder bodemdata",
    null,
    b_geometry,
    b_start,
    "nl_01",
  )

  const otherFarm = await addFarm(fdm, owner.user.id, "Tweede bedrijf", null, null, null)
  otherFarmField = await addField(
    fdm,
    owner.user.id,
    otherFarm,
    "Perceel van ander bedrijf",
    null,
    b_geometry,
    b_start,
    "nl_01",
  )
  await addSoilAnalysis(fdm, owner.user.id, sampled, "other", otherFarmField, 30, sampled, {
    a_som_loi: 4.2,
  })
})

/** The soil status that each field should have. */
function expectedSoilStatus(b_ids: string[]) {
  const status = (b_id: string) =>
    b_id === estimatedField ? "estimated" : b_id === bareField ? "missing" : "measured"
  return Object.fromEntries(b_ids.map((b_id) => [b_id, status(b_id)]))
}

describe("fields step of adding a farm", () => {
  it("shows the fields of the year with the soil status of the per-field reads", async () => {
    signInAs(owner.user)
    const path = `/farm/create/${owner.ids.farm}/${calendar}/fields`
    const { status, data } = await runRoute(() =>
      createFieldsLoader(loaderArgs(path, { b_id_farm: owner.ids.farm, calendar })),
    )
    expect(status).toBe(200)

    const { fields, soilStatus } = data as { fields: Field[]; soilStatus: Record<string, string> }
    const expected = await getFields(fdm, owner.user.id, owner.ids.farm, getTimeframe({ calendar }))
    expect(fields).toEqual(expected)
    expect(soilStatus).toEqual(expectedSoilStatus(expected.map((field) => field.b_id)))
  })
})

describe("fields step of adding fields", () => {
  it("shows the requested fields in order, as the per-field reads return them", async () => {
    signInAs(owner.user)
    const fieldIds = [bareField, ...measuredFields, estimatedField, otherFarmField]
    const path = `/farm/${owner.ids.farm}/${calendar}/field/new/fields?fieldIds=${fieldIds.join(",")}`
    const { status, data } = await runRoute(() =>
      newFieldsLoader(loaderArgs(path, { b_id_farm: owner.ids.farm, calendar })),
    )
    expect(status).toBe(200)

    const { fields, soilStatus } = data as { fields: Field[]; soilStatus: Record<string, string> }
    const expected = await Promise.all(fieldIds.map((b_id) => getField(fdm, owner.user.id, b_id)))
    expect(fields).toEqual(expected)
    expect(soilStatus).toEqual(expectedSoilStatus(fieldIds))
  })
})
