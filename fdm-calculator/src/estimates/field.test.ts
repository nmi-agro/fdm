import { describe, expect, it } from "vitest"
import { getGeometryCentroid } from "./field"

describe("getGeometryCentroid", () => {
  it("averages the vertices of a polygon without the closing vertex", () => {
    const [lon, lat] = getGeometryCentroid({
      type: "Polygon",
      coordinates: [
        [
          [5, 52],
          [6, 52],
          [6, 53],
          [5, 53],
          [5, 52],
        ],
      ],
    })
    expect(lon).toBeCloseTo(5.5)
    expect(lat).toBeCloseTo(52.5)
  })

  it("includes every polygon of a multipolygon", () => {
    const [lon] = getGeometryCentroid({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
        [
          [
            [3, 0],
            [4, 0],
            [4, 1],
            [3, 0],
          ],
        ],
      ],
    })
    expect(lon).toBeCloseTo((0 + 1 + 1 + 3 + 4 + 4) / 6)
  })

  it("throws for an empty geometry", () => {
    expect(() => getGeometryCentroid({ type: "Polygon", coordinates: [] })).toThrow()
  })
})
