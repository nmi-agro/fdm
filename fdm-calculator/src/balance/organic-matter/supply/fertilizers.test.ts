import Decimal from "decimal.js"
import { describe, expect, it } from "vitest"
import type { FertilizerDetail, FieldInput } from "../types"
import { calculateOrganicMatterSupplyByFertilizers } from "./fertilizers"

describe("calculateOrganicMatterSupplyByFertilizers", () => {
  const fertilizerDetailsMap = new Map<string, FertilizerDetail>([
    [
      "manure-1",
      {
        p_id_catalogue: "manure-1",
        p_type: "manure",
        p_eom: 20, // g EOM / kg product
      },
    ],
    [
      "compost-1",
      {
        p_id_catalogue: "compost-1",
        p_type: "compost",
        p_eom: 150, // g EOM / kg product
      },
    ],
    [
      "other-1",
      {
        p_id_catalogue: "other-1",
        p_type: "other",
        p_eom: 5, // g EOM / kg product
      },
    ],
    [
      "mineral-1",
      {
        p_id_catalogue: "mineral-1",
        p_type: "mineral",
        p_eom: null, // No organic matter
      },
    ],
  ])

  it("should calculate EOM supply correctly for a single manure application", () => {
    const fertilizerApplications: FieldInput["fertilizerApplications"] = [
      { p_id: "app1", p_id_catalogue: "manure-1", p_app_amount: 1500 }, // 1500 kg/ha
    ] as FieldInput["fertilizerApplications"]

    const result = calculateOrganicMatterSupplyByFertilizers(
      fertilizerApplications,
      fertilizerDetailsMap,
    )

    const expected = new Decimal(1500).times(20).dividedBy(1000) // 30 kg EOM/ha
    expect(result.manure.total.toNumber()).toBeCloseTo(expected.toNumber())
    expect(result.total.toNumber()).toBeCloseTo(expected.toNumber())
    expect(result.compost.total.toNumber()).toBe(0)
    expect(result.other.total.toNumber()).toBe(0)
  })

  it("should calculate EOM supply for multiple categories", () => {
    const fertilizerApplications: FieldInput["fertilizerApplications"] = [
      { p_id: "app1", p_id_catalogue: "manure-1", p_app_amount: 2000 }, // 2000 kg/ha
      { p_id: "app2", p_id_catalogue: "compost-1", p_app_amount: 1000 }, // 1000 kg/ha
      { p_id: "app3", p_id_catalogue: "other-1", p_app_amount: 500 }, // 500 kg/ha
    ] as FieldInput["fertilizerApplications"]

    const result = calculateOrganicMatterSupplyByFertilizers(
      fertilizerApplications,
      fertilizerDetailsMap,
    )

    const expectedManure = new Decimal(2000).times(20).dividedBy(1000) // 40
    const expectedCompost = new Decimal(1000).times(150).dividedBy(1000) // 150
    const expectedOther = new Decimal(500).times(5).dividedBy(1000) // 2.5
    const expectedTotal = expectedManure.plus(expectedCompost).plus(expectedOther) // 192.5

    expect(result.manure.total.toNumber()).toBeCloseTo(expectedManure.toNumber())
    expect(result.compost.total.toNumber()).toBeCloseTo(expectedCompost.toNumber())
    expect(result.other.total.toNumber()).toBeCloseTo(expectedOther.toNumber())
    expect(result.total.toNumber()).toBeCloseTo(expectedTotal.toNumber())
  })

  it("should ignore mineral fertilizers without p_eom", () => {
    const fertilizerApplications: FieldInput["fertilizerApplications"] = [
      { p_id: "app1", p_id_catalogue: "mineral-1", p_app_amount: 100 },
    ] as FieldInput["fertilizerApplications"]

    const result = calculateOrganicMatterSupplyByFertilizers(
      fertilizerApplications,
      fertilizerDetailsMap,
    )

    expect(result.total.toNumber()).toBe(0)
  })

  it("should return zero for empty applications list", () => {
    const fertilizerApplications: FieldInput["fertilizerApplications"] = []
    const result = calculateOrganicMatterSupplyByFertilizers(
      fertilizerApplications,
      fertilizerDetailsMap,
    )
    expect(result.total.toNumber()).toBe(0)
    expect(result.manure.total.toNumber()).toBe(0)
    expect(result.compost.total.toNumber()).toBe(0)
    expect(result.other.total.toNumber()).toBe(0)
  })

  it("should throw an error if fertilizer details are not found", () => {
    const fertilizerApplications: FieldInput["fertilizerApplications"] = [
      {
        p_app_id: "app1",
        p_id_catalogue: "non-existent",
        p_app_amount: 100,
      },
    ] as FieldInput["fertilizerApplications"]

    expect(() =>
      calculateOrganicMatterSupplyByFertilizers(fertilizerApplications, fertilizerDetailsMap),
    ).toThrow("Fertilizer application app1 has no fertilizerDetails")
  })
})
