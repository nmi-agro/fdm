import { describe, expect, it } from "vitest"
import { type CultivationForHoofdteelt, findHoofdteelt, GROENE_BRAAK } from "./hoofdteelt"

describe("findHoofdteelt", () => {
  it("returns the cultivation present the longest within the May 15–July 15 window", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_A",
        b_lu_start: new Date("2025-04-01"),
        b_lu_end: new Date("2025-06-01"),
      },
      {
        b_lu_catalogue: "cat_B",
        b_lu_start: new Date("2025-06-01"),
        b_lu_end: new Date("2025-08-01"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe("cat_B")
  })

  it("breaks ties on equal duration by the alphabetically first b_lu_catalogue", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_Z",
        b_lu_start: new Date("2025-05-15"),
        b_lu_end: new Date("2025-07-15"),
      },
      {
        b_lu_catalogue: "cat_A",
        b_lu_start: new Date("2025-05-15"),
        b_lu_end: new Date("2025-07-15"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe("cat_A")
  })

  it("treats a missing b_lu_end as present through the end of the window", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_H",
        b_lu_start: new Date("2025-01-01"),
        b_lu_end: null,
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe("cat_H")
  })

  it("skips cultivations without a b_lu_start", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_NoStart",
        b_lu_start: null,
        b_lu_end: new Date("2025-07-01"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025)).toBe(GROENE_BRAAK)
  })

  describe("fallback behaviour when nothing overlaps the window", () => {
    const nonOverlapping: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_Early",
        b_lu_start: new Date("2025-01-01"),
        b_lu_end: new Date("2025-05-14"),
      },
    ]

    it("defaults to the regulatory GROENE_BRAAK code", () => {
      expect(findHoofdteelt(nonOverlapping, 2025)).toBe(GROENE_BRAAK)
      expect(findHoofdteelt([], 2025)).toBe(GROENE_BRAAK)
    })

    it("returns the GROENE_BRAAK code when fallback is not disabled", () => {
      expect(findHoofdteelt(nonOverlapping, 2025, {})).toBe(GROENE_BRAAK)
    })

    it("returns null instead of GROENE_BRAAK when fallback is false", () => {
      expect(findHoofdteelt(nonOverlapping, 2025, { fallback: false })).toBeNull()
      expect(findHoofdteelt([], 2025, { fallback: false })).toBeNull()
    })
  })

  it("still returns the overlapping cultivation even when fallback is false", () => {
    const cultivations: CultivationForHoofdteelt[] = [
      {
        b_lu_catalogue: "cat_C",
        b_lu_start: new Date("2025-05-15"),
        b_lu_end: new Date("2025-07-15"),
      },
    ]
    expect(findHoofdteelt(cultivations, 2025, { fallback: false })).toBe("cat_C")
  })
})
