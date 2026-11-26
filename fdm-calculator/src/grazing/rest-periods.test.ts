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
    // Strip a is free from 2 May; 2 to 24 May are 23 growth days
    expect(rests.map((r) => r.restDays)).toEqual([null, null, null, 23])
    expect(rests[3].previous?.data).toBe("a")
  })

  it("counts uses of the same part at the same time as one use", () => {
    const zone = strip(5.0, 5.001)
    const rests = calculateRestBeforeUses([
      // Two herds on the same strip, overlapping
      { type: "weiden", start: day(1), end: day(5), zone, data: "herd A" },
      { type: "weiden", start: day(3), end: day(8), zone, data: "herd B" },
      // The same strip twice on one day
      { type: "weiden", start: day(20), end: day(20), zone, data: "morning" },
      { type: "weiden", start: day(20), end: day(20), zone, data: "afternoon" },
      // A return the next day continues the grazing period of 20 May
      { type: "weiden", start: day(21), end: day(21), zone, data: "next day" },
    ])
    expect(rests.map((r) => [r.use.data, r.restDays, r.previous?.data ?? null])).toEqual([
      ["herd A", null, null],
      ["herd B", null, null],
      ["morning", 11, "herd B"],
      ["afternoon", 11, "herd B"],
      ["next day", 11, "herd B"],
    ])
  })

  it("treats a chain of overlapping uses as one continuous use", () => {
    const zone = strip(5.0, 5.001)
    const rests = calculateRestBeforeUses([
      { type: "weiden", start: day(1), end: day(5), zone, data: "A" },
      { type: "weiden", start: day(3), end: day(8), zone, data: "B" },
      { type: "weiden", start: day(6), end: day(10), zone, data: "C" },
      { type: "weiden", start: day(22), end: day(22), zone, data: "D" },
    ])
    expect(rests.map((r) => [r.use.data, r.restDays, r.previous?.data ?? null])).toEqual([
      ["A", null, null],
      ["B", null, null],
      // Grazed without a break since 1 May, so no rest before C
      ["C", null, null],
      // The chain ended on 10 May; 11 to 21 May are 11 growth days
      ["D", 11, "C"],
    ])
  })

  it("builds the chain of a use only from uses of its own part", () => {
    const west = strip(5.0, 5.001)
    const east = strip(5.001, 5.002)
    const rests = calculateRestBeforeUses([
      { type: "weiden", start: day(1), end: day(12), zone: west, data: "west" },
      { type: "weiden", start: day(1), end: day(1), zone: east, data: "east 1 May" },
      { type: "weiden", start: day(6), end: day(9), data: "whole field" },
      { type: "weiden", start: day(8), end: day(10), zone: east, data: "east 8 May" },
    ])
    // The east strip was grazed on 1 May and as part of the whole field from 6 May on. The chain
    // of the west strip (from 1 May) does not run over the east strip, so the rest is 4 days.
    expect(rests[3].use.data).toBe("east 8 May")
    expect(rests[3].previous?.data).toBe("east 1 May")
    expect(rests[3].restDays).toBe(4)
  })

  it("counts mowing from the most recent use of any part of the field", () => {
    const rests = calculateRestBeforeUses([
      { type: "weiden", start: day(1), end: day(1), zone: strip(5.0, 5.001) },
      { type: "weiden", start: day(2), end: day(2), zone: strip(5.001, 5.002) },
      { type: "maaien", start: day(10), end: day(10) },
    ])
    expect(rests[2].restDays).toBe(7)
  })

  it("treats grazing on successive days as one grazing period", () => {
    const rests = calculateRestBeforeUses<string>([
      // Omweiden: a few hours a day on the whole field, recorded day by day
      { type: "weiden", start: day(1), end: day(1), data: "1 May" },
      { type: "weiden", start: day(2), end: day(2), data: "2 May" },
      { type: "weiden", start: day(3), end: day(3), data: "3 May" },
      { type: "weiden", start: day(4), end: day(4), data: "4 May" },
      // Free on 5 May, so a new use after 1 growth day
      { type: "weiden", start: day(6), end: day(6), data: "6 May" },
    ])
    expect(rests.map((r) => [r.use.data, r.restDays, r.previous?.data ?? null])).toEqual([
      ["1 May", null, null],
      ["2 May", null, null],
      ["3 May", null, null],
      ["4 May", null, null],
      ["6 May", 1, "4 May"],
    ])
  })

  it("does not join mowing to a grazing on the day before or after", () => {
    const rests = calculateRestBeforeUses<string>([
      { type: "weiden", start: day(1), end: day(4), data: "grazing" },
      { type: "maaien", start: day(5), end: day(5), data: "mowing" },
      { type: "weiden", start: day(6), end: day(6), data: "next grazing" },
    ])
    expect(rests.map((r) => [r.use.data, r.restDays, r.previous?.data ?? null])).toEqual([
      ["grazing", null, null],
      ["mowing", 0, "grazing"],
      ["next grazing", 0, "mowing"],
    ])
  })
})

describe("calculateGrazingMetrics rest periods with strips", () => {
  it("gives daily strips on one field no rest period", () => {
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
    expect(result.rustperiodes).toEqual([])
  })

  it("treats omweiden on a field for several days in a row as one grazing period", () => {
    const result = calculateGrazingMetrics({
      year: 2026,
      today: new Date("2026-06-01T00:00:00.000Z"),
      herds: [{ l_id_herd: "h1", count: 100 }],
      fields: [{ b_id: "f1", b_area: 6, isGrassland: true }],
      // A few hours a day on the whole field, recorded day by day, and back on 26 May
      grazings: [1, 2, 3, 4, 26].map((d) => ({
        l_id_grazing: `g${d}`,
        l_id_herd: "h1",
        b_id: "f1",
        l_grazing_start: day(d),
        l_grazing_end: day(d),
        l_grazing_hours: 4,
      })),
      harvests: [],
    })
    // One rest only: 5 to 25 May are 21 growth days before the next grazing
    expect(result.rustperiodes.map((r) => r.restDays)).toEqual([21])
  })
})
