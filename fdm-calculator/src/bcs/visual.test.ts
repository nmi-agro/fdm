import { describe, expect, it } from "vitest"
import { BCS_VISUAL_KEYS, isBcsAnalysis } from "./visual"

describe("isBcsAnalysis", () => {
  it("is true when at least one visual score is set, also a score of 0", () => {
    expect(isBcsAnalysis({ a_ew_bcs: 2 })).toBe(true)
    expect(isBcsAnalysis({ a_rt_bcs: 0, a_ss_bcs: null })).toBe(true)
  })

  it("is false without visual scores", () => {
    expect(isBcsAnalysis({})).toBe(false)
    expect(isBcsAnalysis(Object.fromEntries(BCS_VISUAL_KEYS.map((key) => [key, null])))).toBe(false)
  })
})
