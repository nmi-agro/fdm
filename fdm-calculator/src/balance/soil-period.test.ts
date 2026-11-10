import type { FdmServerType } from "@nmi-agro/fdm-core"
import { addFarm, addField, addSoilAnalysis, createFdmServer } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import { beforeAll, describe, expect, inject, it, vi } from "vitest"
import { collectInputForNitrogenBalance } from "./nitrogen/input"
import { collectInputForOrganicMatterBalance } from "./organic-matter/input"

// Deposition is read from a remote raster; it is not relevant for the soil data.
vi.mock("./nitrogen/supply/deposition", () => ({
  calculateAllFieldsNitrogenSupplyByDeposition: vi.fn(
    async (fields: { b_id: string }[]) =>
      new Map(fields.map((field) => [field.b_id, { total: new Decimal(0) }])),
  ),
}))

/**
 * The balances use the most recent soil data up to the end of the period, also when it was
 * sampled before the start of the period. Analyses sampled after the period are not used.
 */
describe("soil data in the balance input", () => {
  const principal_id = "test-user-soil-period"
  const timeframe = {
    start: new Date("2025-01-01T00:00:00Z"),
    end: new Date("2025-12-31T23:59:59Z"),
  }
  const geometry = {
    type: "Polygon" as const,
    coordinates: [
      [
        [30, 10],
        [40, 40],
        [20, 40],
        [10, 20],
        [30, 10],
      ],
    ],
  }

  let fdm: FdmServerType
  let b_id_farm: string
  let b_id_older: string
  let b_id_older_and_newer: string
  let b_id_after: string

  beforeAll(async () => {
    fdm = createFdmServer(
      inject("host"),
      inject("port"),
      inject("user"),
      inject("password"),
      inject("database"),
    )
    b_id_farm = await addFarm(fdm, principal_id, "soil period farm", "12345678", "address", "1234AB")

    const addTestField = (name: string) =>
      addField(
        fdm,
        principal_id,
        b_id_farm,
        name,
        `${name}-source`,
        geometry,
        new Date("2020-01-01T00:00:00Z"),
        "nl_01",
      )
    b_id_older = await addTestField("older analysis only")
    b_id_older_and_newer = await addTestField("older and newer analysis")
    b_id_after = await addTestField("analysis after the period")

    // Field 1: only an analysis from before the period
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2023-03-01T00:00:00Z"),
      "nl-other-nmi",
      b_id_older,
      30,
      new Date("2023-03-01T00:00:00Z"),
      { a_som_loi: 3.5, b_soiltype_agr: "dekzand" },
    )

    // Field 2: an older and a newer analysis before the end of the period. The newer one has no
    // soil type, so that value still comes from the older analysis.
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2022-03-01T00:00:00Z"),
      "nl-other-nmi",
      b_id_older_and_newer,
      30,
      new Date("2022-03-01T00:00:00Z"),
      { a_som_loi: 2.0, b_soiltype_agr: "rivierklei" },
    )
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2025-03-01T00:00:00Z"),
      "nl-other-nmi",
      b_id_older_and_newer,
      30,
      new Date("2025-03-01T00:00:00Z"),
      { a_som_loi: 4.0 },
    )

    // Field 3: only an analysis from after the period
    await addSoilAnalysis(
      fdm,
      principal_id,
      new Date("2026-03-01T00:00:00Z"),
      "nl-other-nmi",
      b_id_after,
      30,
      new Date("2026-03-01T00:00:00Z"),
      { a_som_loi: 5.0, b_soiltype_agr: "zeeklei" },
    )
  })

  const expectSoilData = (
    fields: { field: { b_id: string }; soilAnalyses: Record<string, unknown>[] }[],
  ) => {
    const byField = new Map(fields.map((f) => [f.field.b_id, f.soilAnalyses]))

    expect(byField.get(b_id_older)).toEqual([
      expect.objectContaining({ a_som_loi: 3.5, b_soiltype_agr: "dekzand" }),
    ])
    expect(byField.get(b_id_older_and_newer)).toEqual([
      expect.objectContaining({
        a_som_loi: 4.0,
        b_soiltype_agr: "rivierklei",
        b_sampling_date: new Date("2025-03-01T00:00:00Z"),
      }),
    ])
    expect(byField.get(b_id_after)).toEqual([])
  }

  it("organic matter balance: farm level", async () => {
    const input = await collectInputForOrganicMatterBalance(
      fdm,
      principal_id,
      b_id_farm,
      timeframe,
    )
    expectSoilData(input.fields)
  })

  it("organic matter balance: single field", async () => {
    const single = await collectInputForOrganicMatterBalance(
      fdm,
      principal_id,
      b_id_farm,
      timeframe,
      b_id_older,
    )
    expect(single.fields[0].soilAnalyses).toEqual([
      expect.objectContaining({ a_som_loi: 3.5, b_soiltype_agr: "dekzand" }),
    ])
  })

  it("nitrogen balance: farm level", async () => {
    const input = await collectInputForNitrogenBalance(fdm, principal_id, b_id_farm, timeframe)
    expectSoilData(input.fields)
  })

  it("nitrogen balance: single field", async () => {
    const older = await collectInputForNitrogenBalance(
      fdm,
      principal_id,
      b_id_farm,
      timeframe,
      b_id_older,
    )
    expect(older.fields[0].soilAnalyses).toEqual([
      expect.objectContaining({ a_som_loi: 3.5, b_soiltype_agr: "dekzand" }),
    ])

    const after = await collectInputForNitrogenBalance(
      fdm,
      principal_id,
      b_id_farm,
      timeframe,
      b_id_after,
    )
    expect(after.fields[0].soilAnalyses).toEqual([])
  })
})
