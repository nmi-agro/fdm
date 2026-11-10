import { describe, expect, it } from "vitest"
import {
  AGG_IDS,
  AGGREGATIONS,
  getAggregationIdsForIndicator,
  getAggregationInfo,
  getChildren,
  getIndicatorIdsForAggregation,
  getRootAggregation,
  LEAF_AGGREGATION_IDS,
  LEAF_AGGREGATION_INDICATORS,
} from "./aggregations"

describe("aggregation hierarchy", () => {
  it("defines every aggregation id once, with a known parent", () => {
    expect(Object.keys(AGGREGATIONS).sort()).toEqual([...AGG_IDS].sort())
    for (const info of Object.values(AGGREGATIONS)) {
      if (info.parent !== null) expect(AGG_IDS).toContain(info.parent)
    }
  })

  it("has S_BLN as root, with the top-level groups as children", () => {
    expect(getRootAggregation()).toBe("S_BLN")
    expect(getChildren("S_BLN").sort()).toEqual(["S_CLIM", "S_NUT", "S_PROD", "S_WAT"])
    expect(getAggregationInfo("S_WAT").parent).toBe("S_BLN")
  })

  it("gives every leaf aggregation at least one indicator", () => {
    for (const id of LEAF_AGGREGATION_IDS) {
      expect(LEAF_AGGREGATION_INDICATORS[id].length).toBeGreaterThan(0)
    }
  })
})

describe("getIndicatorIdsForAggregation", () => {
  it("returns the direct indicators of a leaf", () => {
    expect(getIndicatorIdsForAggregation("S_CLIM")).toEqual(["CR_CSEQ"])
  })

  it("collects the unique indicators of all children of a group", () => {
    const water = getIndicatorIdsForAggregation("S_WAT")
    expect(water.sort()).toEqual(["GW_GWR", "GW_NLEA", "GW_PEST", "GW_WHC", "SW_NLEA", "SW_PLEA"])
    expect(new Set(getIndicatorIdsForAggregation("S_BLN")).size).toBe(
      getIndicatorIdsForAggregation("S_BLN").length,
    )
  })
})

describe("getAggregationIdsForIndicator", () => {
  it("finds every leaf aggregation an indicator belongs to", () => {
    expect(getAggregationIdsForIndicator("NUT_N").sort()).toEqual(["S_BBWP", "S_NUT"])
    expect(getAggregationIdsForIndicator("UNKNOWN")).toEqual([])
  })
})
