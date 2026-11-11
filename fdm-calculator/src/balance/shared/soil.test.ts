import type { CurrentSoilData } from "@nmi-agro/fdm-core"
import { describe, expect, it } from "vitest"
import type { SoilAnalysisPicked as NitrogenSoilAnalysisPicked } from "../nitrogen/types"
import type { SoilAnalysisPicked as OrganicMatterSoilAnalysisPicked } from "../organic-matter/types"
import { resolveSoilParameters } from "./soil"
import { currentSoilDataFixture } from "./soil.test-helpers"

describe("resolveSoilParameters", () => {
  const currentSoilData = currentSoilDataFixture({
    a_c_of: 22,
    a_cn_fr: 11,
    a_density_sa: 1.3,
    a_n_rt: 2000,
    a_som_loi: 3,
    b_soiltype_agr: "zeeklei",
    b_gwl_class: "II",
    a_p_al: 30,
  })

  it("should read the parameters for nitrogen", () => {
    const result = resolveSoilParameters<NitrogenSoilAnalysisPicked>(
      currentSoilData,
      ["b_soiltype_agr", "a_n_rt", "a_c_of", "a_cn_fr", "a_density_sa", "a_som_loi", "b_gwl_class"],
      true,
    )

    expect(result).toEqual({
      a_c_of: 22,
      a_cn_fr: 11,
      a_density_sa: 1.3,
      a_n_rt: 2000,
      a_som_loi: 3,
      b_soiltype_agr: "zeeklei",
      b_gwl_class: "II",
    })
  })

  it("should return only the requested parameters", () => {
    const result = resolveSoilParameters<OrganicMatterSoilAnalysisPicked>(
      currentSoilData,
      ["a_som_loi", "a_density_sa"],
      false,
    )

    expect(result).toEqual({ a_som_loi: 3, a_density_sa: 1.3 })
  })

  it("should combine values that come from different analyses", () => {
    const data: CurrentSoilData = [
      ...currentSoilDataFixture(
        { a_som_loi: 3.5, b_soiltype_agr: "dekzand" },
        { a_id: "old", b_sampling_date: new Date("2020-03-01") },
      ),
      ...currentSoilDataFixture(
        { a_density_sa: 1.4 },
        { a_id: "new", b_sampling_date: new Date("2023-03-01") },
      ),
    ]

    const result = resolveSoilParameters<OrganicMatterSoilAnalysisPicked>(
      data,
      ["a_som_loi", "a_density_sa", "b_soiltype_agr"],
      false,
    )
    expect(result).toEqual({ a_som_loi: 3.5, a_density_sa: 1.4, b_soiltype_agr: "dekzand" })
  })

  it("should keep values of 0", () => {
    const result = resolveSoilParameters<OrganicMatterSoilAnalysisPicked>(
      currentSoilDataFixture({ a_som_loi: 0, a_density_sa: 1.2 }),
      ["a_som_loi", "a_density_sa"],
      false,
    )
    expect(result.a_som_loi).toBe(0)
  })

  it("should estimate missing values when requested", () => {
    const result = resolveSoilParameters<NitrogenSoilAnalysisPicked>(
      currentSoilDataFixture({ a_som_loi: 3.5, a_n_rt: 1500, b_soiltype_agr: "dekzand" }),
      ["a_c_of", "a_som_loi", "a_cn_fr", "a_density_sa"],
      true,
    )

    expect(result.a_som_loi).toBe(3.5)
    expect(result.a_c_of).toBeGreaterThan(0)
    expect(result.a_cn_fr).toBeGreaterThan(0)
    expect(result.a_density_sa).toBeGreaterThan(0)
  })

  it("should ignore a value of the wrong type", () => {
    const data = currentSoilDataFixture({ a_som_loi: "3", b_soiltype_agr: 1, a_density_sa: 1.2 })

    expect(() =>
      resolveSoilParameters<OrganicMatterSoilAnalysisPicked>(
        data,
        ["a_som_loi", "a_density_sa", "b_soiltype_agr"],
        false,
      ),
    ).toThrow("Missing required soil parameters: a_som_loi, b_soiltype_agr")
  })

  it("should throw an error if required parameters are missing", () => {
    expect(() =>
      resolveSoilParameters<OrganicMatterSoilAnalysisPicked>(
        currentSoilDataFixture({ a_som_loi: 2 }),
        ["a_som_loi", "a_density_sa"],
        false,
      ),
    ).toThrow("Missing required soil parameters: a_density_sa")
  })

  it("should throw an error when there is no current soil data", () => {
    expect(() =>
      resolveSoilParameters<OrganicMatterSoilAnalysisPicked>([], ["a_som_loi"], true),
    ).toThrow("Missing required soil parameters: a_som_loi")
  })
})
