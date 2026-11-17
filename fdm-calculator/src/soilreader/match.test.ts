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

describe("matchSoilAnalysisToField edge cases", () => {
  it("skips fields without or with an invalid geometry", () => {
    const odd: SoilAnalysisMatchField[] = [
      { b_id: "x", b_name: "X", b_start: null, b_end: null, geometry: null },
      {
        b_id: "y",
        b_name: "Y",
        b_start: null,
        b_end: null,
        geometry: { type: "Polygon", coordinates: [[]] } as never,
      },
    ]
    expect(matchSoilAnalysisToField(point(5), null, null, odd).b_id).toBeNull()
  })

  it("prefers the field that existed on the sampling date, else the first", () => {
    const later: SoilAnalysisMatchField = {
      b_id: "new",
      b_name: "Nieuw",
      b_start: "2020-01-01",
      b_end: null,
      geometry: square(5),
    }
    const earlier = fields[2]! // 2010 to 2015, same location
    // On a date in 2012 only the earlier field existed.
    expect(
      matchSoilAnalysisToField(point(5), null, new Date("2012-06-01"), [later, earlier]).b_id,
    ).toBe("c")
    // On a date when neither existed, the first candidate is used.
    expect(
      matchSoilAnalysisToField(point(5), null, new Date("2005-06-01"), [later, earlier]).b_id,
    ).toBe("new")
  })
})
