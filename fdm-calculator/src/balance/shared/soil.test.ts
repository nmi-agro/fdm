import type { CurrentSoilData, CurrentSoilDataItem, SoilAnalysis } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import type { SoilAnalysisPicked as NitrogenSoilAnalysisPicked } from "../nitrogen/types"
import type { SoilAnalysisPicked as OrganicMatterSoilAnalysisPicked } from "../organic-matter/types"
import { combineSoilAnalyses, currentSoilDataToSoilAnalyses } from "./soil"

describe("combineSoilAnalyses", () => {
  const soilAnalyses: Partial<SoilAnalysis>[] = [
    {
      a_id: "soil1",
      b_sampling_date: new Date("2023-01-01"),
      a_c_of: 20,
      a_cn_fr: 10,
      a_density_sa: 1.2,
      a_n_rt: 3000,
      a_som_loi: 2,
      b_soiltype_agr: "dekzand",
      b_gwl_class: "II",
    },
    {
      a_id: "soil2",
      b_sampling_date: new Date("2023-01-05"),
      a_c_of: 22,
      a_cn_fr: 11,
      a_density_sa: 1.3,
      a_n_rt: 2000,
      a_som_loi: 3,
      b_soiltype_agr: "zeeklei",
      b_gwl_class: "II",
    },
    {
      a_id: "soil3",
      b_sampling_date: new Date("2022-12-01"),
      a_som_loi: 1.5,
    },
  ]

  it("should combine for nitrogen with estimation", () => {
    const result = combineSoilAnalyses<NitrogenSoilAnalysisPicked>(
      soilAnalyses,
      ["b_soiltype_agr", "a_n_rt", "a_c_of", "a_cn_fr", "a_density_sa", "a_som_loi", "b_gwl_class"],
      true,
    )

    expect(result).toBeDefined()
    expect(result.a_c_of).toBe(22)
    expect(result.a_cn_fr).toBe(11)
    expect(result.a_density_sa).toBe(1.3)
    expect(result.a_n_rt).toBe(2000)
    expect(result.a_som_loi).toBe(3)
    expect(result.b_soiltype_agr).toBe("zeeklei")
  })

  it("should combine for organic matter without estimation", () => {
    const result = combineSoilAnalyses<OrganicMatterSoilAnalysisPicked>(
      soilAnalyses,
      ["a_som_loi", "a_density_sa"],
      false,
    )

    expect(result).toBeDefined()
    expect(result.a_som_loi).toBe(3)
    expect(result.a_density_sa).toBe(1.3)
    expect((result as any).a_c_of).toBeUndefined()
  })

  it("should throw an error if required parameters are missing", () => {
    const incompleteAnalyses = [
      {
        a_id: "soil1",
        b_sampling_date: new Date("2023-01-01"),
        a_som_loi: 2,
      },
    ]

    expect(() =>
      combineSoilAnalyses<OrganicMatterSoilAnalysisPicked>(
        incompleteAnalyses,
        ["a_som_loi", "a_density_sa"],
        false,
      ),
    ).toThrow("Missing required soil parameters: a_density_sa")
  })
})

describe("currentSoilDataToSoilAnalyses", () => {
  const item = (
    parameter: CurrentSoilDataItem["parameter"],
    value: number | string | null,
    a_id: string,
    b_sampling_date: Date | null,
  ): CurrentSoilDataItem => ({
    parameter,
    value,
    is_aggregated: false,
    coverage: 1,
    has_coverage_warning: false,
    sources: [
      {
        a_id,
        a_source: "nl-other-nmi",
        b_sampling_date,
        a_depth_upper: 0,
        a_depth_lower: 30,
        value,
        area_fraction: 1,
      },
    ],
  })

  it("should return an empty array when there is no current soil data", () => {
    expect(currentSoilDataToSoilAnalyses([])).toEqual([])
  })

  it("should return an empty array when no balance parameter has a value", () => {
    const data: CurrentSoilData = [
      item("a_p_al", 30, "old", new Date("2020-03-01")),
      item("a_som_loi", null, "old", new Date("2020-03-01")),
    ]
    expect(currentSoilDataToSoilAnalyses(data)).toEqual([])
  })

  it("should use a value from an older analysis when the newer analysis does not have it", () => {
    const data: CurrentSoilData = [
      item("a_som_loi", 3.5, "old", new Date("2020-03-01")),
      item("b_soiltype_agr", "dekzand", "old", new Date("2020-03-01")),
      item("a_n_rt", 1500, "new", new Date("2023-03-01")),
      item("a_p_al", 30, "new", new Date("2023-03-01")),
    ]

    expect(currentSoilDataToSoilAnalyses(data)).toEqual([
      {
        a_id: "new",
        b_sampling_date: new Date("2023-03-01"),
        a_c_of: null,
        a_cn_fr: null,
        a_density_sa: null,
        a_n_rt: 1500,
        a_som_loi: 3.5,
        b_soiltype_agr: "dekzand",
        b_gwl_class: null,
      },
    ])
  })

  it("should give input that combineSoilAnalyses can complete with estimates", () => {
    const data: CurrentSoilData = [
      item("a_som_loi", 3.5, "old", new Date("2020-03-01")),
      item("b_soiltype_agr", "dekzand", "old", new Date("2020-03-01")),
    ]

    const result = combineSoilAnalyses<OrganicMatterSoilAnalysisPicked>(
      currentSoilDataToSoilAnalyses(data),
      ["a_som_loi", "a_density_sa", "b_soiltype_agr"],
      true,
    )
    expect(result.a_som_loi).toBe(3.5)
    expect(result.b_soiltype_agr).toBe("dekzand")
    expect(result.a_density_sa).toBeGreaterThan(0)
  })
})
