import { describe, expect, it } from "vitest"
import { filterGrazingCategories, isGrazingCategory } from "./livestock-categories"

const categories = [
  { l_id_category: "rvo_100", l_specie: "cattle" },
  { l_id_category: "rvo_sheep", l_specie: "sheep" },
  { l_id_category: "rvo_goat", l_specie: "goat" },
  { l_id_category: "rvo_horse", l_specie: "horse" },
  { l_id_category: "rvo_pony", l_specie: "pony" },
  { l_id_category: "rvo_pig", l_specie: "pig" },
  { l_id_category: "rvo_poultry", l_specie: "poultry" },
  { l_id_category: "rvo_turkey", l_specie: "turkey" },
  { l_id_category: "rvo_duck", l_specie: "duck" },
  { l_id_category: "rvo_other", l_specie: "other" },
] as const

describe("filterGrazingCategories", () => {
  it("keeps cattle, sheep, goat, horse and pony only", () => {
    expect(filterGrazingCategories([...categories]).map((c) => c.l_id_category)).toEqual([
      "rvo_100",
      "rvo_sheep",
      "rvo_goat",
      "rvo_horse",
      "rvo_pony",
    ])
  })
})

describe("isGrazingCategory", () => {
  it("accepts a grazing category", () => {
    expect(isGrazingCategory([...categories], "rvo_sheep")).toBe(true)
  })

  it("rejects other species and unknown IDs", () => {
    expect(isGrazingCategory([...categories], "rvo_pig")).toBe(false)
    expect(isGrazingCategory([...categories], "rvo_unknown")).toBe(false)
  })
})
