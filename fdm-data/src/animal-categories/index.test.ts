import { describe, expect, it } from "vitest"
import { getCatalogueRvo } from "./catalogues/rvo"
import { getAnimalCategoriesCatalogue, getAnimalCategoryCatalogue } from "./index"

describe("getAnimalCategoryCatalogue", () => {
  it("returns the RVO catalogue", async () => {
    expect(await getAnimalCategoryCatalogue("rvo")).toEqual(await getCatalogueRvo())
    expect(await getAnimalCategoriesCatalogue("rvo")).toEqual(await getCatalogueRvo())
  })

  it("rejects an unsupported catalogue", async () => {
    await expect(
      // @ts-expect-error Testing runtime validation.
      getAnimalCategoryCatalogue("unsupported"),
    ).rejects.toThrowError("catalogue unsupported is not recognized")
  })
})

describe("getCatalogueRvo", () => {
  it("contains all migrated RVO animal categories with unique IDs", async () => {
    const catalogue = await getCatalogueRvo()
    const ids = catalogue.map((category) => category.l_id_category)

    expect(catalogue).toHaveLength(52)
    expect(new Set(ids)).toHaveLength(catalogue.length)
    expect(ids).toContain("rvo_100")
    expect(ids).toContain("rvo_37")
  })

  it("provides typed species, sex options and LSU values without persistence fields", async () => {
    const catalogue = await getCatalogueRvo()

    for (const category of catalogue) {
      expect(category.l_category_source).toBe("rvo")
      expect(category.l_category).toMatch(/^\d+ - /)
      expect(category.l_sex_options.length).toBeGreaterThan(0)
      expect(category.l_sex_options.every((sex) => sex === "female" || sex === "male")).toBe(true)
      expect(category.l_lsu).toBeGreaterThanOrEqual(0)
      expect(category).not.toHaveProperty("hash")
    }
  })

  it("maps representative RVO categories to their biological constraints", async () => {
    const catalogue = await getCatalogueRvo()
    const byId = new Map(catalogue.map((category) => [category.l_id_category, category]))

    expect(byId.get("rvo_100")).toMatchObject({
      l_specie: "cattle",
      l_sex_options: ["female"],
      l_lsu: 1,
    })
    expect(byId.get("rvo_104")).toMatchObject({
      l_specie: "cattle",
      l_sex_options: ["male"],
    })
    expect(byId.get("rvo_101")).toMatchObject({
      l_specie: "cattle",
      l_lsu: 0.23,
    })
    expect(byId.get("rvo_102")).toMatchObject({
      l_specie: "cattle",
      l_lsu: 0.52,
    })
    expect(byId.get("rvo_407")).toMatchObject({
      l_specie: "pig",
      l_lsu: 0.027,
    })
    expect(byId.get("rvo_312")).toMatchObject({
      l_specie: "poultry",
      l_lsu: 0.007,
    })
  })
})
