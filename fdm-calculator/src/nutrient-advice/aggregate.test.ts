import { describe, expect, it } from "vitest"
import {
  aggregateNutrientAdviceToFarmLevel,
  type InputAggregateNutrientAdviceToFarmLevel,
} from "./aggregate"

describe("aggregateNutrientAdviceToFarmLevel", () => {
  const fields: InputAggregateNutrientAdviceToFarmLevel<"N" | "P" | "K">[] = [
    { b_area: 2, values: { N: { dose: 100, advice: 150 }, P: { dose: 30, advice: 60 } } },
    { b_area: 1, values: { N: { dose: 40, advice: 60 } } },
  ]

  it("returns the area-weighted average per hectare", () => {
    const result = aggregateNutrientAdviceToFarmLevel(fields, ["N", "P"], "per_ha")
    expect(result.N).toEqual({ dose: 80, advice: 120, b_area: 3 })
    // Only the first field has P, so only its area counts for P
    expect(result.P).toEqual({ dose: 30, advice: 60, b_area: 2 })
  })

  it("returns the total in kg", () => {
    const result = aggregateNutrientAdviceToFarmLevel(fields, ["N", "P"], "total")
    expect(result.N).toEqual({ dose: 240, advice: 360, b_area: 3 })
    expect(result.P).toEqual({ dose: 60, advice: 120, b_area: 2 })
  })

  it("returns zeros for a nutrient without contributing fields", () => {
    const result = aggregateNutrientAdviceToFarmLevel(fields, ["K"], "per_ha")
    expect(result.K).toEqual({ dose: 0, advice: 0, b_area: 0 })
  })

  it("ignores fields without a positive area", () => {
    const result = aggregateNutrientAdviceToFarmLevel(
      [
        { b_area: 0, values: { N: { dose: 500, advice: 0 } } },
        { b_area: Number.NaN, values: { N: { dose: 500, advice: 0 } } },
        { b_area: 4, values: { N: { dose: 50, advice: 100 } } },
      ],
      ["N"],
      "per_ha",
    )
    expect(result.N).toEqual({ dose: 50, advice: 100, b_area: 4 })
  })

  it("returns an empty result for an empty input", () => {
    const result = aggregateNutrientAdviceToFarmLevel([], ["N"], "total")
    expect(result.N).toEqual({ dose: 0, advice: 0, b_area: 0 })
  })
})
