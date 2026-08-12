import { describe, expect, it } from "vitest"
import {
  isVanggewas,
  isWinterteelt,
  isVanggewasEnWinterteelt,
  getWinterCropCondition,
  getCatchCrops,
} from "./vanggewas-winterteelt"

describe("Vanggewas & Winterteelt crop-code classification", () => {
  it("asserts exact count and official RVO codes for Table 6 catch crops", () => {
    // RVO Table 6 contains exactly 59 official crop codes
    expect(getCatchCrops(2025).size).toBe(59)
    expect(getCatchCrops(2026).size).toBe(59)

    // Previously missing codes
    expect(isVanggewas("nl_6748")).toBe(true) // beemdlangbloem groenbemesting
    expect(isVanggewas("nl_6752")).toBe(true) // festulolium graszaad
    expect(isVanggewas("nl_6786")).toBe(true) // timothee graszaad
    expect(isVanggewas("nl_6787")).toBe(true) // timothee groenbemesting

    // Previously extra codes that should NOT be on Table 6
    expect(isVanggewas("nl_427")).toBe(false)
    expect(isVanggewas("nl_1915")).toBe(false)
    expect(isVanggewas("nl_1916")).toBe(false)
    expect(isVanggewas("nl_1917")).toBe(false)
    expect(isVanggewas("nl_1918")).toBe(false)
    expect(isVanggewas("nl_1919")).toBe(false)
    expect(isVanggewas("nl_1920")).toBe(false)
    expect(isVanggewas("nl_2030")).toBe(false)
    expect(isVanggewas("nl_2031")).toBe(false)
    expect(isVanggewas("nl_3506")).toBe(false)
    expect(isVanggewas("nl_3512")).toBe(false)
    expect(isVanggewas("nl_3513")).toBe(false)
    expect(isVanggewas("nl_3516")).toBe(false)
    expect(isVanggewas("nl_3523")).toBe(false)
    expect(isVanggewas("nl_3807")).toBe(false)
    expect(isVanggewas("nl_3808")).toBe(false)
    expect(isVanggewas("nl_6769")).toBe(false)
    expect(isVanggewas("nl_6806")).toBe(false)
    expect(isVanggewas("nl_382")).toBe(false)
  })

  it("asserts official RVO Table 7 winter crop code membership", () => {
    // Previously missing Table 7 codes
    expect(isWinterteelt("nl_332")).toBe(true) // natuurlijk grasland (natuur)
    expect(isWinterteelt("nl_2017")).toBe(true) // zetmeelaardappelen
    expect(isWinterteelt("nl_2711")).toBe(true) // asperges opkweek
    expect(isWinterteelt("nl_2712")).toBe(true) // asperges zaden
    expect(isWinterteelt("nl_3504")).toBe(true) // bladrammenas
    expect(isWinterteelt("nl_3521")).toBe(true) // stoppelknollen
    expect(isWinterteelt("nl_6762")).toBe(true) // rode klaver vanggewas
    expect(isWinterteelt("nl_6763")).toBe(true) // rode klaver zaad
    expect(isWinterteelt("nl_375")).toBe(true) // hop
    expect(isWinterteelt("nl_516")).toBe(true) // miscanthus
    expect(isWinterteelt("nl_670")).toBe(true) // japanse haver
  })

  it("correctly classifies maize variants (P7/P12)", () => {
    // Silage maize (nl_259) is NOT a winterteelt
    expect(isWinterteelt("nl_259")).toBe(false)

    // Grain maize variants are candidate winterteelten (met onderzaai)
    expect(getWinterCropCondition("nl_316")).toEqual({ type: "requires_undersowing" })
    expect(getWinterCropCondition("nl_317")).toEqual({ type: "requires_undersowing" })
    expect(getWinterCropCondition("nl_1935")).toEqual({ type: "requires_undersowing" })
    expect(getWinterCropCondition("nl_2032")).toEqual({ type: "requires_undersowing" })
    expect(getWinterCropCondition("nl_814")).toEqual({ type: "requires_undersowing" })

    // Without cultivation/undersowing passed, returns false
    expect(isWinterteelt("nl_316")).toBe(false)

    // With undersowing passed, returns true
    const maizeCultivation = { b_lu_catalogue: "nl_316", b_lu_end: new Date(2024, 9, 1) }
    const undersownCatchCrop = {
      b_lu_catalogue: "nl_428", // Gele mosterd (vanggewas)
      b_lu_start: new Date(2024, 5, 1), // Sown in June during maize
      b_lu_end: new Date(2025, 1, 1), // Stands until Feb 1
    }
    expect(isWinterteelt("nl_316", 2025, maizeCultivation, [maizeCultivation, undersownCatchCrop])).toBe(true)
  })

  it("correctly classifies beet harvest date conditions", () => {
    expect(getWinterCropCondition("nl_256")).toEqual({
      type: "harvest_date_on_or_after",
      month: 11,
      day: 1,
    })

    // Sugar beet harvested on Nov 5 -> qualifies as winterteelt
    const beetLate = { b_lu_catalogue: "nl_256", b_lu_end: new Date(2024, 10, 5) }
    expect(isWinterteelt("nl_256", 2025, beetLate)).toBe(true)

    // Sugar beet harvested on Oct 10 -> does NOT qualify as winterteelt
    const beetEarly = { b_lu_catalogue: "nl_256", b_lu_end: new Date(2024, 9, 10) }
    expect(isWinterteelt("nl_256", 2025, beetEarly)).toBe(false)
  })

  it("correctly classifies triticale", () => {
    // Triticale (nl_314) is a winterteelt but NOT a vanggewas
    expect(isWinterteelt("nl_314")).toBe(true)
    expect(isVanggewas("nl_314")).toBe(false)
  })

  it("correctly classifies stubble turnips", () => {
    // Stubble turnips (nl_3521) IS a vanggewas
    expect(isVanggewas("nl_3521")).toBe(true)
  })

  it("correctly classifies cauliflower variants", () => {
    // Only winter cauliflower (nl_2795) is a winterteelt
    expect(isWinterteelt("nl_2795")).toBe(true)
    expect(isWinterteelt("nl_2713")).toBe(false)
    expect(isWinterteelt("nl_2714")).toBe(false)
  })

  it("correctly classifies field bean variants", () => {
    // Only winter field bean (nl_311) is a winterteelt
    expect(isWinterteelt("nl_311")).toBe(true)
    expect(isWinterteelt("nl_665")).toBe(false)
    expect(isWinterteelt("nl_853")).toBe(false)
  })

  it("correctly classifies umbrella rows", () => {
    // In Akkerbouwgewassen overig: buckwheat (nl_3510) is a vanggewas, nl_1927 is not
    expect(isVanggewas("nl_3510")).toBe(true)
    expect(isVanggewas("nl_1927")).toBe(false)
    expect(isVanggewas("nl_2652")).toBe(false)

    // In Buitenbloemen overig: sunflower (nl_515) is a vanggewas, nl_174 is not
    expect(isVanggewas("nl_515")).toBe(true)
    expect(isVanggewas("nl_174")).toBe(false)
  })

  it("correctly identifies crop overlap (winter cereals & grasses)", () => {
    // Winter wheat (nl_233), winter barley (nl_235), winter rye (nl_237) are both
    expect(isVanggewasEnWinterteelt("nl_233")).toBe(true)
    expect(isVanggewasEnWinterteelt("nl_235")).toBe(true)
    expect(isVanggewasEnWinterteelt("nl_237")).toBe(true)
  })
})
