import { describe, expect, it } from "vitest"
import type { CultivationForHoofdteelt } from "./hoofdteelt"
import { findHoofdteelt, GROENE_BRAAK } from "./hoofdteelt"

describe("findHoofdteelt", () => {
  it("should return the cultivation with the longest duration in the period", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_A",
        b_lu_start: new Date("2025-05-01"),
        b_lu_end: new Date("2025-06-10"),
      },
      {
        b_lu_catalogue: "cat_B",
        b_lu_start: new Date("2025-06-01"),
        b_lu_end: new Date("2025-07-20"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe("cat_B")
  })

  it("should return the alphabetically first cultivation in case of a tie", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_C",
        b_lu_start: new Date("2025-05-15"),
        b_lu_end: new Date("2025-06-15"),
      },
      {
        b_lu_catalogue: "cat_D",
        b_lu_start: new Date("2025-06-15"),
        b_lu_end: new Date("2025-07-15"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe("cat_C")
  })

  it("should return GROENE_BRAAK by default if no cultivation overlaps the period", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_E",
        b_lu_start: new Date("2025-01-01"),
        b_lu_end: new Date("2025-05-14"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe(GROENE_BRAAK)
  })

  it("should return null instead of GROENE_BRAAK when returnNull is true and nothing overlaps", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_E",
        b_lu_start: new Date("2025-01-01"),
        b_lu_end: new Date("2025-05-14"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025, true)).toBeNull()
  })

  it("should still return the hoofdteelt catalogue when returnNull is true and a cultivation overlaps", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_B",
        b_lu_start: new Date("2025-06-01"),
        b_lu_end: new Date("2025-07-20"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025, true)).toBe("cat_B")
  })

  it("should handle cultivations that only partially overlap", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_F",
        b_lu_start: new Date("2025-07-10"),
        b_lu_end: new Date("2025-08-01"),
      },
      {
        b_lu_catalogue: "cat_G",
        b_lu_start: new Date("2025-05-01"),
        b_lu_end: new Date("2025-05-20"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe("cat_F")
  })

  it("should handle an empty array of cultivations by returning GROENE_BRAAK", () => {
    expect(findHoofdteelt([], 2025)).toBe(GROENE_BRAAK)
  })

  it("should handle an empty array of cultivations by returning null when returnNull is true", () => {
    expect(findHoofdteelt([], 2025, true)).toBeNull()
  })

  it("should handle a cultivation with a null end date as present through the end of the window", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_H",
        b_lu_start: new Date("2025-01-01"),
        b_lu_end: null,
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe("cat_H")
  })

  it("should skip cultivations without a b_lu_start", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_I",
        b_lu_start: undefined,
        b_lu_end: new Date("2025-06-01"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe(GROENE_BRAAK)
  })

  it("should break ties by effective (clamped) duration, not raw cultivation length", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_zz_late",
        b_lu_start: new Date("2025-07-05"),
        b_lu_end: new Date("2025-07-15"),
      },
      {
        b_lu_catalogue: "cat_aa_early",
        b_lu_start: new Date("2025-04-01"),
        b_lu_end: new Date("2025-05-25"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe("cat_aa_early")
  })

  it("should prefer the cultivation with the larger effective overlap when raw durations are equal", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_mostly_outside",
        b_lu_start: new Date("2025-04-20"),
        b_lu_end: new Date("2025-05-20"),
      },
      {
        b_lu_catalogue: "cat_fully_inside",
        b_lu_start: new Date("2025-05-20"),
        b_lu_end: new Date("2025-06-19"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe("cat_fully_inside")
  })
})
