import { describe, expect, it } from "vitest"
import { getCatalogueNmi } from "./catalogues/nmi"
import { feedTypeOptions, getFeedCatalogue } from "./index"

describe("getFeedCatalogue", () => {
  it("returns the 25 NMI entries in stable option order", async () => {
    const catalogue = await getFeedCatalogue("nmi")
    expect(catalogue).toHaveLength(25)
    expect(catalogue.map((item) => item.f_id_catalogue)).toEqual(
      Array.from({ length: 25 }, (_, index) => `nmi_${String(index + 1).padStart(3, "0")}`),
    )
    expect(catalogue.every((item) => item.f_source === "nmi")).toBe(true)
    expect(catalogue.at(-1)?.f_type_rvo).toBe("mineralen")
    expect(catalogue.some((item) => item.f_type_rvo === "overig")).toBe(false)
  })

  it("preserves null defaults where RVO values are unavailable", async () => {
    const catalogue = await getCatalogueNmi()
    const byType = new Map(catalogue.map((item) => [item.f_type_rvo, item]))
    expect(byType.get("aardappelen_ingekuild")?.f_dm).toBeNull()
    expect(byType.get("witlofwortelen")?.f_dm).toBeNull()
    for (const type of ["gras_vers", "krachtvoer", "mineralen"]) {
      expect(byType.get(type)).toMatchObject({ f_dm: null, f_n_dm: null, f_p_dm: null })
    }
  })

  it("exports the option values without the removed overig option", () => {
    expect(feedTypeOptions).toHaveLength(25)
    expect(feedTypeOptions.at(-1)?.value).toBe("mineralen")
    expect(feedTypeOptions.some((option) => option.value === "overig")).toBe(false)
  })

  it("rejects an unsupported catalogue", async () => {
    await expect(getFeedCatalogue("invalid" as "nmi")).rejects.toThrow(
      "catalogue invalid is not recognized",
    )
  })
})
