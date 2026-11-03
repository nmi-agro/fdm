import { describe, expect, it } from "vitest"
import { matchSoilAnalysisToField, type SoilAnalysisMatchField } from "./match"

const square = (x: number) => ({
  type: "Polygon" as const,
  coordinates: [
    [
      [x, 52],
      [x + 0.01, 52],
      [x + 0.01, 52.01],
      [x, 52.01],
      [x, 52],
    ],
  ],
})

const fields: SoilAnalysisMatchField[] = [
  { b_id: "a", b_name: "Achter", b_start: null, b_end: null, geometry: square(5) },
  { b_id: "b", b_name: "Voor", b_start: null, b_end: null, geometry: square(6) },
  { b_id: "c", b_name: "Oud", b_start: "2010-01-01", b_end: "2015-01-01", geometry: square(5) },
]
const point = (x: number) => ({ type: "Point" as const, coordinates: [x + 0.005, 52.005] })

describe("matchSoilAnalysisToField", () => {
  it("prefers the field that contains the location and existed on the sampling date", () => {
    expect(matchSoilAnalysisToField(point(5), "Achter", new Date("2026-03-01"), fields)).toEqual({
      b_id: "a",
      match_reason: "location-and-name",
      name_conflict_b_id: null,
    })
  })

  it("reports a field with the report name when it differs from the location", () => {
    expect(matchSoilAnalysisToField(point(5), "voor ", new Date("2026-03-01"), fields)).toEqual({
      b_id: "a",
      match_reason: "location",
      name_conflict_b_id: "b",
    })
  })

  it("falls back to the name and returns nothing without a match", () => {
    expect(matchSoilAnalysisToField(null, "Voor", null, fields).b_id).toBe("b")
    expect(matchSoilAnalysisToField(null, "Onbekend", null, fields)).toEqual({
      b_id: null,
      match_reason: null,
      name_conflict_b_id: null,
    })
  })
})
