import { describe, expect, it } from "vitest"
import type { CatalogueAnimalCategorySource } from "./d"
import { getAnimalCategoriesCatalogue } from "./index"
import {
  getAnimalCategoryTransitionSexes,
  getAnimalCategoryTransitions,
  getAnimalCategoryTransitionsCatalogue,
} from "./transitions"

// Every catalogue source; a new source is added here as well
const sources: CatalogueAnimalCategorySource[] = ["rvo"]

describe("getAnimalCategoryTransitionsCatalogue", () => {
  it.each(sources)(
    "only moves %s categories to categories of the same catalogue and species, for sexes both allow",
    async (source) => {
      const catalogue = await getAnimalCategoriesCatalogue(source)
      const byId = new Map(catalogue.map((category) => [category.l_id_category, category]))
      const transitions = getAnimalCategoryTransitionsCatalogue(source)

      for (const [fromId, moves] of Object.entries(transitions)) {
        const from = byId.get(fromId)
        expect(from, `${fromId} is not in catalogue ${source}`).toBeDefined()
        for (const move of moves) {
          expect(move.l_sex.length).toBeGreaterThan(0)
          for (const toId of move.to) {
            const to = byId.get(toId)
            expect(to, `${fromId} -> ${toId}`).toBeDefined()
            expect(toId).not.toBe(fromId)
            expect(to?.l_specie).toBe(from?.l_specie)
            for (const sex of move.l_sex) {
              expect(from?.l_sex_options).toContain(sex)
              expect(to?.l_sex_options).toContain(sex)
            }
          }
        }
      }
    },
  )

  it("rejects an unsupported catalogue", () => {
    expect(() =>
      // @ts-expect-error Testing runtime validation.
      getAnimalCategoryTransitionsCatalogue("unsupported"),
    ).toThrowError("catalogue unsupported is not recognized")
  })
})

describe("getAnimalCategoryTransitions", () => {
  it("combines the moves of every catalogue", async () => {
    for (const source of sources) {
      for (const [fromId, moves] of Object.entries(getAnimalCategoryTransitionsCatalogue(source))) {
        expect(getAnimalCategoryTransitions(fromId).map((t) => t.l_id_category)).toEqual(
          moves.flatMap((move) => move.to),
        )
      }
    }
  })

  it("has no moves for an unknown category or a category that is an end stage", () => {
    expect(getAnimalCategoryTransitions("unknown")).toEqual([])
    expect(getAnimalCategoryTransitions("rvo_982")).toEqual([])
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
    // Piglets of both sexes move on from their sow
    expect(getAnimalCategoryTransitionSexes("rvo_401", "rvo_404")).toEqual(["female", "male"])
    expect(getAnimalCategoryTransitionSexes("rvo_401", "rvo_400")).toEqual(["female"])
    // A red deer kept for slaughter can still join the breeding stock
    expect(getAnimalCategoryTransitionSexes("rvo_973", "rvo_971")).toEqual(["female", "male"])
    expect(getAnimalCategoryTransitionSexes("rvo_974", "rvo_971")).toEqual(["female", "male"])
    // A heifer can be fattened with the red meat cattle
    expect(getAnimalCategoryTransitionSexes("rvo_102", "rvo_122")).toEqual(["female"])
    // A calf of the farm can be kept as a veal calf
    for (const veal of ["rvo_112", "rvo_115", "rvo_116", "rvo_117"]) {
      expect(getAnimalCategoryTransitionSexes("rvo_101", veal)).toEqual(["female", "male"])
    }
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
