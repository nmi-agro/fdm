import { describe, expect, it } from "vitest"
import type { NL2025NormsInputForCultivation } from "./types"
import { determineNLHoofdteelt } from "./hoofdteelt"

describe("determineNLHoofdteelt", () => {
  it("should return the cultivation with the longest duration in the period", async () => {
    const cultivations: NL2025NormsInputForCultivation[] = [
      {
        b_lu: "Gewas A",
        b_lu_catalogue: "cat_A",
        b_lu_start: new Date("2025-05-01"),
        b_lu_end: new Date("2025-06-10"),
        b_lu_variety: null,
      },
      {
        b_lu: "Gewas B",
        b_lu_catalogue: "cat_B",
        b_lu_start: new Date("2025-06-01"),
        b_lu_end: new Date("2025-07-20"),
        b_lu_variety: null,
      },
    ]
    const result = determineNLHoofdteelt(cultivations, 2025)
    expect(result).toBe("cat_B")
  })

  it("should return the first cultivation alphabetically in case of a tie", async () => {
    const cultivations: NL2025NormsInputForCultivation[] = [
      {
        b_lu: "Gewas C",
        b_lu_catalogue: "cat_C",
        b_lu_start: new Date("2025-05-15"),
        b_lu_end: new Date("2025-06-15"),
        b_lu_variety: null,
      },
      {
        b_lu: "Gewas D",
        b_lu_catalogue: "cat_D",
        b_lu_start: new Date("2025-06-15"),
        b_lu_end: new Date("2025-07-15"),
        b_lu_variety: null,
      },
    ]
    const result = determineNLHoofdteelt(cultivations, 2025)
    expect(result).toBe("cat_C")
  })

  it("should return nl_6794 if no cultivation is within the period", async () => {
    const cultivations: NL2025NormsInputForCultivation[] = [
      {
        b_lu: "Gewas E",
        b_lu_catalogue: "cat_E",
        b_lu_start: new Date("2025-01-01"),
        b_lu_end: new Date("2025-05-14"),
        b_lu_variety: null,
      },
    ]
    const result = determineNLHoofdteelt(cultivations, 2025)
    expect(result).toBe("nl_6794")
  })

  it("should handle cultivations that partially overlap", async () => {
    const cultivations: NL2025NormsInputForCultivation[] = [
      {
        b_lu: "Gewas F",
        b_lu_catalogue: "cat_F",
        b_lu_start: new Date("2025-07-10"),
        b_lu_end: new Date("2025-08-01"),
        b_lu_variety: null,
      },
      {
        b_lu: "Gewas G",
        b_lu_catalogue: "cat_G",
        b_lu_start: new Date("2025-05-01"),
        b_lu_end: new Date("2025-05-20"),
        b_lu_variety: null,
      },
    ]
    const result = determineNLHoofdteelt(cultivations, 2025)
    expect(result).toBe("cat_F")
  })

  it("should handle an empty array of cultivations by returning nl_6794", async () => {
    const cultivations: NL2025NormsInputForCultivation[] = []
    const result = determineNLHoofdteelt(cultivations, 2025)
    expect(result).toBe("nl_6794")
  })

  it("should handle cultivation with null end date", async () => {
    const cultivations: NL2025NormsInputForCultivation[] = [
      {
        b_lu: "Gewas H",
        b_lu_catalogue: "cat_H",
        b_lu_start: new Date("2025-01-01"),
        b_lu_end: null,
        b_lu_variety: null,
      },
    ]
    const result = determineNLHoofdteelt(cultivations, 2025)
    expect(result).toBe("cat_H")
  })
})
