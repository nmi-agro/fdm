import type { Polygon } from "geojson"
import { describe, expect, it } from "vitest"
import { calculateGrazingMetrics } from "./calculate-grazing-metrics"
import { calculateRestBeforeUses, type FieldUse, zonesOverlap } from "./rest-periods"

/** Synthetic strip between two longitudes of a test field (latitude 52.00-52.01). */
const strip = (lonMin: number, lonMax: number): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [lonMin, 52.0],
      [lonMin, 52.01],
      [lonMax, 52.01],
      [lonMax, 52.0],
      [lonMin, 52.0],
    ],
  ],
})

const day = (d: number) => new Date(Date.UTC(2026, 4, d))

describe("zonesOverlap", () => {
  it("treats a use without a zone as the whole field", () => {
    expect(zonesOverlap(null, strip(5.0, 5.001))).toBe(true)
    expect(zonesOverlap(undefined, undefined)).toBe(true)
  })

  it("does not count adjacent strips as the same part", () => {
    expect(zonesOverlap(strip(5.0, 5.001), strip(5.001, 5.002))).toBe(false)
  })

  it("counts strips that largely overlap as the same part", () => {
    expect(zonesOverlap(strip(5.0, 5.002), strip(5.001, 5.003))).toBe(true)
  })
})

describe("calculateRestBeforeUses", () => {
  it("gives successive strips their own rest and counts a return to a strip", () => {
    const uses: FieldUse<string>[] = [
      { type: "weiden", start: day(1), end: day(1), zone: strip(5.0, 5.001), data: "a" },
      { type: "weiden", start: day(2), end: day(2), zone: strip(5.001, 5.002), data: "b" },
      { type: "weiden", start: day(3), end: day(3), zone: strip(5.002, 5.003), data: "c" },
      { type: "weiden", start: day(25), end: day(25), zone: strip(5.0, 5.001), data: "a again" },
    ]
    const rests = calculateRestBeforeUses(uses)
    expect(rests.map((r) => r.restDays)).toEqual([null, null, null, 24])
    expect(rests[3].previous?.data).toBe("a")
  })

  it("counts mowing from the most recent use of any part of the field", () => {
    const rests = calculateRestBeforeUses([
      { type: "weiden", start: day(1), end: day(1), zone: strip(5.0, 5.001) },
      { type: "weiden", start: day(2), end: day(2), zone: strip(5.001, 5.002) },
      { type: "maaien", start: day(10), end: day(10) },
    ])
    expect(rests[2].restDays).toBe(8)
  })
})

describe("calculateGrazingMetrics rest periods with strips", () => {
  it("does not flag daily strips on one field as overgrazing", () => {
    const result = calculateGrazingMetrics({
      year: 2026,
      today: new Date("2026-06-01T00:00:00.000Z"),
      herds: [{ l_id_herd: "h1", count: 50 }],
      fields: [{ b_id: "f1", b_area: 3, isGrassland: true }],
      grazings: [0, 1, 2, 3].map((i) => ({
        l_id_grazing: `g${i}`,
        l_id_herd: "h1",
        b_id: "f1",
        l_grazing_start: day(1 + i),
        l_grazing_end: day(1 + i),
        l_grazing_hours: 8,
        l_grazing_geometry_zone: strip(5.0 + i * 0.001, 5.001 + i * 0.001),
      })),
      harvests: [],
    })
    expect(result.overbeweidingAlerts).toEqual([])
  })
})
