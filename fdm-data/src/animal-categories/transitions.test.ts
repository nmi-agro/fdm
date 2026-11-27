import { describe, expect, it } from "vitest"
import { getCatalogueRvo } from "./catalogues/rvo"
import { getAnimalCategoryTransitionSexes, getAnimalCategoryTransitions } from "./transitions"

describe("getAnimalCategoryTransitions", () => {
  it("only moves to existing categories of the same species, for sexes both categories allow", async () => {
    const catalogue = await getCatalogueRvo()
    const byId = new Map(catalogue.map((category) => [category.l_id_category, category]))

    for (const from of catalogue) {
      for (const transition of getAnimalCategoryTransitions(from.l_id_category)) {
        const to = byId.get(transition.l_id_category)
        expect(to, `${from.l_id_category} -> ${transition.l_id_category}`).toBeDefined()
        expect(to?.l_specie).toBe(from.l_specie)
        expect(transition.l_id_category).not.toBe(from.l_id_category)
        expect(transition.l_sex.length).toBeGreaterThan(0)
        for (const sex of transition.l_sex) {
          expect(from.l_sex_options).toContain(sex)
          expect(to?.l_sex_options).toContain(sex)
        }
      }
    }
  })

  it("has no moves for an unknown category or a category that is an end stage", () => {
    expect(getAnimalCategoryTransitions("unknown")).toEqual([])
    expect(getAnimalCategoryTransitions("rvo_974")).toEqual([])
    expect(getAnimalCategoryTransitions("rvo_991")).toEqual([])
  })
})

describe("getAnimalCategoryTransitionSexes", () => {
  it("allows a move to the same category for both sexes", () => {
    expect(getAnimalCategoryTransitionSexes("rvo_100", "rvo_100")).toEqual(["female", "male"])
  })

  it("returns the sexes for which a move is possible", () => {
    expect(getAnimalCategoryTransitionSexes("rvo_101", "rvo_102")).toEqual(["female"])
    expect(getAnimalCategoryTransitionSexes("rvo_101", "rvo_104")).toEqual(["male"])
    expect(getAnimalCategoryTransitionSexes("rvo_101", "rvo_122")).toEqual(["female", "male"])
    expect(getAnimalCategoryTransitionSexes("rvo_973", "rvo_974")).toEqual(["female", "male"])
    // Young water buffalo: a cow joins the water buffalo cows, a bull the breeding bulls
    expect(getAnimalCategoryTransitionSexes("rvo_992", "rvo_991")).toEqual(["female"])
    expect(getAnimalCategoryTransitionSexes("rvo_992", "rvo_104")).toEqual(["male"])
    // The young that a category includes move on: deer calves, lambs and goat kids
    expect(getAnimalCategoryTransitionSexes("rvo_971", "rvo_973")).toEqual(["female", "male"])
    expect(getAnimalCategoryTransitionSexes("rvo_981", "rvo_982")).toEqual(["female", "male"])
    expect(getAnimalCategoryTransitionSexes("rvo_550", "rvo_552")).toEqual(["female", "male"])
    expect(getAnimalCategoryTransitionSexes("rvo_600", "rvo_601")).toEqual(["female", "male"])
    expect(getAnimalCategoryTransitionSexes("rvo_601", "rvo_600")).toEqual(["male"])
  })

  it("returns null for a move no animal can make", () => {
    // Back to a younger age group
    expect(getAnimalCategoryTransitionSexes("rvo_974", "rvo_973")).toBeNull()
    expect(getAnimalCategoryTransitionSexes("rvo_100", "rvo_101")).toBeNull()
    // Red deer to fallow deer, water buffalo to dairy cow, cattle to poultry
    expect(getAnimalCategoryTransitionSexes("rvo_974", "rvo_981")).toBeNull()
    expect(getAnimalCategoryTransitionSexes("rvo_991", "rvo_100")).toBeNull()
    expect(getAnimalCategoryTransitionSexes("rvo_100", "rvo_37")).toBeNull()
  })
})
