import type { CurrentSoilData } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import { enrichCurrentSoilDataWithNlv } from "./current-soil-data"
import { calculateNlv } from "./nlv-supply"

function item(parameter: string, value: number | null, date: string) {
  return {
    parameter,
    value,
    is_aggregated: false,
    coverage: 1,
    has_coverage_warning: false,
    sources: [
      {
        a_id: `a-${parameter}`,
        b_sampling_date: new Date(date),
        a_source: "nl-other-lab",
        value,
        area_fraction: 1,
      },
    ],
  }
}

describe("enrichCurrentSoilDataWithNlv", () => {
  it("adds a calculated NLV when it is missing", () => {
    const data = [
      item("a_som_loi", 3, "2024-01-01"),
      item("a_clay_mi", 20, "2025-03-01"),
      item("a_cn_fr", 10, "2023-05-01"),
    ] as unknown as CurrentSoilData

    const result = enrichCurrentSoilDataWithNlv(data)
    const nlv = result.find((i) => i.parameter === "d_n_supply_base")
    const expected =
      Math.round(calculateNlv({ a_som_loi: 3, a_clay_mi: 20, a_cn_fr: 10 }) * 10) / 10

    expect(nlv?.value).toBe(expected)
    expect(nlv?.coverage).toBeNull()
    expect(nlv?.sources).toHaveLength(1)
    expect(nlv?.sources[0]?.a_source).toBe("calculated")
    // Dated like the newest input.
    expect(nlv?.sources[0]?.b_sampling_date).toEqual(new Date("2025-03-01"))
  })

  it("keeps a measured NLV", () => {
    const data = [
      item("a_som_loi", 3, "2024-01-01"),
      item("a_clay_mi", 20, "2024-01-01"),
      item("a_cn_fr", 10, "2024-01-01"),
      item("d_n_supply_base", 99, "2024-01-01"),
    ] as unknown as CurrentSoilData

    const result = enrichCurrentSoilDataWithNlv(data)
    const nlv = result.filter((i) => i.parameter === "d_n_supply_base")
    expect(nlv).toHaveLength(1)
    expect(nlv[0]?.value).toBe(99)
  })

  it("drops an empty NLV and adds nothing when an input is missing", () => {
    const data = [
      item("a_som_loi", 3, "2024-01-01"),
      item("a_clay_mi", 20, "2024-01-01"),
      item("d_n_supply_base", null, "2024-01-01"),
    ] as unknown as CurrentSoilData

    const result = enrichCurrentSoilDataWithNlv(data)
    expect(result.some((i) => i.parameter === "d_n_supply_base")).toBe(false)
    expect(result).toHaveLength(2)
  })
})
