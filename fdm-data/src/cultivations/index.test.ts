import { describe, expect, it } from "vitest"
import { getCatalogueBrp } from "./catalogues/brp"
import { getCultivationCatalogue } from "./index"

describe("getCultivationCatalogue", () => {
  it("should return the BRP catalogue when catalogueName is 'brp'", async () => {
    const expectedCatalogue = await getCatalogueBrp()
    const actualCatalogue = await getCultivationCatalogue("brp")
    expect(actualCatalogue).toEqual(expectedCatalogue)
  })

  it("should throw an error when an invalid catalogueName is provided", async () => {
    await expect(
      // @ts-expect-error
      getCultivationCatalogue("invalid-catalogue"),
    ).rejects.toThrowError("catalogue invalid-catalogue is not recognized")
  })

  it("should return a non-empty array for 'brp' catalogue", async () => {
    const catalogue = await getCultivationCatalogue("brp")
    expect(Array.isArray(catalogue)).toBe(true)
    expect(catalogue.length).toBeGreaterThan(0)
  })

  it("should check if all items in the brp catalogue have the correct source", async () => {
    const catalogue = await getCultivationCatalogue("brp")
    for (const item of catalogue) {
      expect(item.b_lu_source).toBe("brp")
    }
  })

  it("should check if all items in the brp catalogue have the correct b_lu_harvestable values", async () => {
    const catalogue = await getCultivationCatalogue("brp")
    for (const item of catalogue) {
      expect(["once", "multiple", "none"]).toContain(item.b_lu_harvestable)
    }
  })
})

describe("getCatalogueBrp", () => {
  it("should return an array of CatalogueCultivationItem", async () => {
    const catalogue = await getCatalogueBrp()
    expect(Array.isArray(catalogue)).toBe(true)
    for (const item of catalogue) {
      expect(typeof item).toBe("object")
      expect(item).toHaveProperty("b_lu_source")
      expect(item).toHaveProperty("b_lu_catalogue")
      expect(item).toHaveProperty("b_lu_name")
      expect(item).toHaveProperty("b_lu_name_en")
      expect(item).toHaveProperty("b_lu_harvestable")
      expect(item).toHaveProperty("b_lu_hcat3")
      expect(item).toHaveProperty("b_lu_hcat3_name")
      expect(item).toHaveProperty("b_lu_croprotation")
      expect(item).toHaveProperty("b_lu_harvestcat")
      expect(item).toHaveProperty("b_lu_yield")
      expect(item).toHaveProperty("b_lu_dm")
      expect(item).toHaveProperty("b_lu_hi")
      expect(item).toHaveProperty("b_lu_n_harvestable")
      expect(item).toHaveProperty("b_lu_n_residue")
      expect(item).toHaveProperty("b_n_fixation")
      expect(item).toHaveProperty("hash")
    }
  })

  it("should return at least one item", async () => {
    const catalogue = await getCatalogueBrp()
    expect(catalogue.length).toBeGreaterThan(0)
  })
})
