import { describe, expect, it } from "vitest"
import type { Bln3Score } from "./types"
import { computeMinimumScores } from "./scoring"

function score(agg: number, ind: number, index: number): Bln3Score {
  return {
    aggregations: [{ aggregation_id: "S_WAT", score: agg }],
    indicators: [{ indicator_id: "I_C_N", score: ind, index, status: 1, target: 1, impact: 1 }],
  } as Bln3Score
}

describe("computeMinimumScores", () => {
  it("keeps the lowest aggregation and indicator score with the matching index", () => {
    const result = computeMinimumScores([score(0.8, 0.6, 0.55), null, score(0.4, 0.9, 0.95)])
    expect(result.aggregations).toEqual([{ aggregation_id: "S_WAT", score: 0.4 }])
    expect(result.indicators).toEqual([
      { indicator_id: "I_C_N", score: 0.6, index: 0.55, status: 0, target: 0, impact: 0 },
    ])
  })

  it("returns empty lists without scores", () => {
    expect(computeMinimumScores([null, undefined])).toEqual({ aggregations: [], indicators: [] })
  })

  it("skips missing aggregations and scores, and uses the score when the index is missing", () => {
    const result = computeMinimumScores([
      { indicators: [] } as unknown as Bln3Score,
      {
        aggregations: [{ aggregation_id: "S_WAT", score: Number.NaN }],
        indicators: [
          { indicator_id: "I_C_N", score: null, index: 0.1, status: 0, target: 0, impact: 0 },
          { indicator_id: "I_P", score: 0.7, status: 0, target: 0, impact: 0 },
        ],
      } as unknown as Bln3Score,
    ])
    expect(result.aggregations).toEqual([])
    expect(result.indicators).toEqual([
      { indicator_id: "I_P", score: 0.7, index: 0.7, status: 0, target: 0, impact: 0 },
    ])
  })
})
