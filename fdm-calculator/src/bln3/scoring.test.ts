import { describe, expect, it } from "vitest"
import type { Bln3Score } from "./types"
import {
  aggregateFarmScores,
  computeAreaWeightedAggregation,
  getFieldAggregationScore,
  getScoreTier,
  scoreToDisplay,
} from "./scoring"

const score = (aggregation: number, indicator = aggregation): Bln3Score => ({
  indicators: [
    { indicator_id: "C_N", status: 1, target: 2, index: indicator, impact: 0, score: indicator },
  ],
  aggregations: [{ aggregation_id: "S_BLN", score: aggregation }],
})

describe("scoreToDisplay", () => {
  it("should convert a normalized score to a rounded 0..100 score", () => {
    expect(scoreToDisplay(0.555)).toBe(56)
    expect(scoreToDisplay(0.554)).toBe(55)
    expect(scoreToDisplay(0)).toBe(0)
    expect(scoreToDisplay(1)).toBe(100)
  })

  it("should return 0 for missing or non-finite scores", () => {
    expect(scoreToDisplay(null)).toBe(0)
    expect(scoreToDisplay(undefined)).toBe(0)
    expect(scoreToDisplay(Number.NaN)).toBe(0)
    expect(scoreToDisplay(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe("getScoreTier", () => {
  it("should classify scores at the tier boundaries", () => {
    expect(getScoreTier(100)).toBe("green")
    expect(getScoreTier(70)).toBe("green")
    expect(getScoreTier(69)).toBe("yellow")
    expect(getScoreTier(40)).toBe("yellow")
    expect(getScoreTier(39)).toBe("red")
    expect(getScoreTier(0)).toBe("red")
  })
})

describe("getFieldAggregationScore", () => {
  it("should return the score of the aggregation", () => {
    expect(getFieldAggregationScore(score(0.4), "S_BLN")).toBe(0.4)
  })

  it("should return null when the aggregation is not available", () => {
    expect(getFieldAggregationScore(score(0.4), "S_OTHER")).toBeNull()
    expect(getFieldAggregationScore({ indicators: [] }, "S_BLN")).toBeNull()
    expect(getFieldAggregationScore(null, "S_BLN")).toBeNull()
    expect(getFieldAggregationScore(undefined, "S_BLN")).toBeNull()
  })

  it("should return null when the aggregation score is not a number", () => {
    expect(getFieldAggregationScore(score(Number.NaN), "S_BLN")).toBeNull()
  })
})

describe("computeAreaWeightedAggregation", () => {
  it("should weight the aggregation by field area", () => {
    const result = computeAreaWeightedAggregation(
      [
        { b_id: "a", score: score(0.2) },
        { b_id: "b", score: score(0.8) },
      ],
      [
        { b_id: "a", b_area: 1 },
        { b_id: "b", b_area: 3 },
      ],
      "S_BLN",
    )
    expect(result).toBeCloseTo(0.65)
  })

  it("should skip fields without a positive area or without a score", () => {
    const result = computeAreaWeightedAggregation(
      [
        { b_id: "a", score: score(0.2) },
        { b_id: "b", score: score(0.8) },
        { b_id: "c", score: score(0.1) },
        { b_id: "d", score: null },
        { b_id: "e", score: score(0.3) },
      ],
      [
        { b_id: "a", b_area: 2 },
        { b_id: "b", b_area: 0 },
        { b_id: "c", b_area: null },
        { b_id: "d", b_area: 5 },
      ],
      "S_BLN",
    )
    expect(result).toBe(0.2)
  })

  it("should return null when no field contributes", () => {
    expect(computeAreaWeightedAggregation([], [], "S_BLN")).toBeNull()
    expect(
      computeAreaWeightedAggregation(
        [{ b_id: "a", score: score(0.5) }],
        [{ b_id: "a", b_area: 0 }],
        "S_BLN",
      ),
    ).toBeNull()
  })
})

describe("aggregateFarmScores", () => {
  it("should skip non-finite indicator and aggregation scores", () => {
    const result = aggregateFarmScores([
      { b_id: "a", b_area: 1, score: score(Number.NaN, 0.4) },
      { b_id: "b", b_area: 1, score: score(0.6, Number.POSITIVE_INFINITY) },
    ])
    expect(result).toEqual({
      indicators: [{ indicator_id: "C_N", score: 0.4 }],
      aggregations: [{ aggregation_id: "S_BLN", score: 0.6 }],
    })
  })

  it("should skip fields with a non-finite area", () => {
    const result = aggregateFarmScores([
      { b_id: "a", b_area: Number.NaN, score: score(0.1) },
      { b_id: "b", b_area: 2, score: score(0.7) },
    ])
    expect(result.aggregations).toEqual([{ aggregation_id: "S_BLN", score: 0.7 }])
  })

  it("should handle scores without aggregations", () => {
    const result = aggregateFarmScores([
      { b_id: "a", b_area: 1, score: { indicators: score(0.5).indicators } },
    ])
    expect(result).toEqual({ indicators: [{ indicator_id: "C_N", score: 0.5 }], aggregations: [] })
  })
})
