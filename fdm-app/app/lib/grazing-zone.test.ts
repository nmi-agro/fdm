import { describe, expect, it } from "vitest"
import {
  GRAZING_AREA_FIELD,
  GRAZING_ZONE_FIELD,
  parseGrazingDate,
  parseGrazingExtent,
  parseGrazingHours,
  parseGrazingZone,
} from "./grazing-zone"

/** The status of a 400 response thrown with `data()`, or the error itself. */
function statusOf(fn: () => unknown): unknown {
  try {
    fn()
  } catch (error) {
    return (error as { init?: { status?: number } }).init?.status ?? error
  }
  return "no error"
}

const square = [
  [5.0, 52.0],
  [5.01, 52.0],
  [5.01, 52.01],
  [5.0, 52.0],
]

describe("parseGrazingDate", () => {
  it("reads a date as midnight UTC", () => {
    expect(parseGrazingDate("2026-05-04")).toEqual(new Date("2026-05-04T00:00:00.000Z"))
  })

  it("treats an empty value as not given", () => {
    expect(parseGrazingDate("")).toBeUndefined()
  })

  it.each(["2026-02-30", "not-a-date", "2026-5-4", "2026-05-04T08:00"])(
    "refuses %s with a 400",
    (value) => {
      expect(statusOf(() => parseGrazingDate(value))).toBe(400)
    },
  )
})

describe("parseGrazingHours", () => {
  it("reads the hours per day", () => {
    expect(parseGrazingHours("8")).toBe(8)
    expect(parseGrazingHours("24")).toBe(24)
    expect(parseGrazingHours("0.5")).toBe(0.5)
  })

  it("treats an empty value as not given", () => {
    expect(parseGrazingHours("")).toBeUndefined()
  })

  it.each(["0", "25", "-1", "abc", "8x", "NaN"])("refuses %s with a 400", (value) => {
    expect(statusOf(() => parseGrazingHours(value))).toBe(400)
  })
})

describe("parseGrazingZone", () => {
  it("reads a Polygon and a MultiPolygon", () => {
    expect(parseGrazingZone(JSON.stringify({ type: "Polygon", coordinates: [square] }))).toEqual({
      type: "Polygon",
      coordinates: [square],
    })
    expect(
      parseGrazingZone(JSON.stringify({ type: "MultiPolygon", coordinates: [[square]] }))?.type,
    ).toBe("MultiPolygon")
  })

  it("treats an empty value as no zone", () => {
    expect(parseGrazingZone("")).toBeNull()
  })

  it.each([
    ["a ring of 3 positions", { type: "Polygon", coordinates: [square.slice(0, 3)] }],
    ["coordinates outside WGS84", { type: "Polygon", coordinates: [[[500, 52], ...square]] }],
    ["another geometry type", { type: "Point", coordinates: [5, 52] }],
    ["a polygon without rings", { type: "Polygon", coordinates: [] }],
  ])("refuses %s with a 400", (_name, zone) => {
    expect(statusOf(() => parseGrazingZone(JSON.stringify(zone)))).toBe(400)
  })

  it("refuses text that is not JSON with a 400", () => {
    expect(statusOf(() => parseGrazingZone("{"))).toBe(400)
  })
})

describe("parseGrazingExtent", () => {
  const form = (zone: string, area: string) => {
    const formData = new FormData()
    formData.set(GRAZING_ZONE_FIELD, zone)
    formData.set(GRAZING_AREA_FIELD, area)
    return formData
  }

  it("reads an area without a location", () => {
    expect(parseGrazingExtent(form("", "1.5"))).toEqual({
      l_grazing_geometry_zone: null,
      l_grazing_area: 1.5,
    })
  })

  it.each(["1,5", "1abc", "0", "-2"])("refuses the area %s with a 400", (area) => {
    expect(statusOf(() => parseGrazingExtent(form("", area)))).toBe(400)
  })
})
