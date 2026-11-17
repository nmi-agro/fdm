import type { Polygon } from "geojson"
import { describe, expect, it } from "vitest"
import {
  type Area,
  areaHa,
  clipZoneToField,
  cutStrip,
  cutStrips,
  intersectAreas,
  snapToEdges,
  toMultiPolygon,
  zoneAreaWithinField,
} from "./grazing-strip"

/** Synthetic rectangular field of roughly 76 ha. */
const field: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [5.0, 52.0],
      [5.01, 52.0],
      [5.01, 52.01],
      [5.0, 52.01],
      [5.0, 52.0],
    ],
  ],
}

/** Synthetic L-shaped field, to check a concave outline. */
const lField: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [5.0, 52.0],
      [5.01, 52.0],
      [5.01, 52.004],
      [5.004, 52.004],
      [5.004, 52.01],
      [5.0, 52.01],
      [5.0, 52.0],
    ],
  ],
}

const overlapHa = (a: Area, b: Area) => {
  const overlap = intersectAreas(a, b)
  return overlap ? areaHa(overlap) : 0
}

describe("cutStrip", () => {
  it.each([0, 45, 90, 180, 300])("cuts a strip of the intended area at bearing %i", (bearing) => {
    const strip = cutStrip({ field, targetAreaHa: 2, bearing })
    expect(strip).not.toBeNull()
    expect(areaHa(strip as Area)).toBeCloseTo(2, 1)
    // The strip lies within the field
    expect(zoneAreaWithinField(strip as Area, field)).toBeCloseTo(areaHa(strip as Area), 2)
  })

  it("starts at the back of the field, seen in the direction of advance", () => {
    const eastwards = cutStrip({ field, targetAreaHa: 2, bearing: 90 }) as Area
    const lons = toMultiPolygon(eastwards)
      .coordinates.flat(2)
      .map(([lon]) => lon)
    expect(Math.min(...lons)).toBeCloseTo(5.0, 4)
    expect(Math.max(...lons)).toBeLessThan(5.002)
  })

  it("connects the next strip to the previous one without overlap", () => {
    const first = cutStrip({ field, targetAreaHa: 3, bearing: 90 }) as Area
    const second = cutStrip({ field, occupied: [first], targetAreaHa: 3, bearing: 90 }) as Area
    expect(areaHa(second)).toBeCloseTo(3, 1)
    expect(overlapHa(first, second)).toBeLessThan(0.01)
  })

  it("returns the free remainder when it is smaller than the intended area", () => {
    const fieldArea = areaHa(field)
    const most = cutStrip({ field, targetAreaHa: fieldArea - 1, bearing: 0 }) as Area
    const rest = cutStrip({ field, occupied: [most], targetAreaHa: 5, bearing: 0 }) as Area
    expect(areaHa(rest)).toBeCloseTo(fieldArea - areaHa(most), 1)
    expect(areaHa(rest)).toBeLessThan(5)
    expect(cutStrip({ field, occupied: [field], targetAreaHa: 5, bearing: 0 })).toBeNull()
  })

  it("handles a concave field", () => {
    const strip = cutStrip({ field: lField, targetAreaHa: 4, bearing: 0 }) as Area
    expect(areaHa(strip)).toBeCloseTo(4, 1)
    expect(zoneAreaWithinField(strip, lField)).toBeCloseTo(4, 1)
  })

  it("returns null for an intended area of 0", () => {
    expect(cutStrip({ field, targetAreaHa: 0, bearing: 0 })).toBeNull()
  })
})

describe("cutStrips", () => {
  it("cuts successive strips and starts again when the field is used up", () => {
    const fieldArea = areaHa(field)
    const perStrip = fieldArea / 3
    const strips = cutStrips({ field, targetAreaHa: perStrip, bearing: 90 }, 4)
    expect(strips).toHaveLength(4)
    expect(overlapHa(strips[0], strips[1])).toBeLessThan(0.01)
    expect(overlapHa(strips[1], strips[2])).toBeLessThan(0.01)
    // The fourth strip is the first one again
    expect(overlapHa(strips[0], strips[3])).toBeCloseTo(perStrip, 0)
  })
})

describe("zoneAreaWithinField", () => {
  it("only counts the part of the zone within the field", () => {
    const halfOutside: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [4.995, 52.0],
          [5.005, 52.0],
          [5.005, 52.01],
          [4.995, 52.01],
          [4.995, 52.0],
        ],
      ],
    }
    expect(zoneAreaWithinField(halfOutside, field)).toBeCloseTo(areaHa(field) / 2, 0)
  })
})

describe("snapToEdges", () => {
  // A simple linear projection: 0.0001 degree is 1 pixel
  const project = (lng: number, lat: number) => ({ x: lng * 10_000, y: -lat * 10_000 })

  it("snaps to a corner of the field within the tolerance", () => {
    expect(snapToEdges([5.0005, 52.0005], [field], project)).toEqual([5.0, 52.0])
  })

  it("snaps to the nearest point on an edge when no corner is near", () => {
    const snapped = snapToEdges([5.005, 52.0008], [field], project) as number[]
    expect(snapped[0]).toBeCloseTo(5.005, 6)
    expect(snapped[1]).toBeCloseTo(52.0, 6)
  })

  it("prefers a corner over a nearer edge", () => {
    // 6 px from the corner, 1 px from the southern edge
    expect(snapToEdges([5.0006, 51.9999], [field], project)).toEqual([5.0, 52.0])
  })

  it("does not snap beyond the tolerance", () => {
    expect(snapToEdges([5.005, 52.005], [field], project)).toBeUndefined()
  })

  it("also snaps to other areas, such as earlier strips", () => {
    const strip: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [5.0, 52.0],
          [5.002, 52.0],
          [5.002, 52.01],
          [5.0, 52.01],
          [5.0, 52.0],
        ],
      ],
    }
    const snapped = snapToEdges([5.0021, 52.005], [field, strip], project) as number[]
    expect(snapped[0]).toBeCloseTo(5.002, 6)
  })
})

describe("clipZoneToField", () => {
  it("keeps a zone within the field unchanged", () => {
    const inside: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [5.001, 52.001],
          [5.002, 52.001],
          [5.002, 52.002],
          [5.001, 52.002],
          [5.001, 52.001],
        ],
      ],
    }
    expect(clipZoneToField(inside, field)).toBe(inside)
  })

  it("cuts off the part outside the field", () => {
    const halfOutside: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [4.995, 52.0],
          [5.005, 52.0],
          [5.005, 52.01],
          [4.995, 52.01],
          [4.995, 52.0],
        ],
      ],
    }
    const clipped = clipZoneToField(halfOutside, field) as Area
    expect(areaHa(clipped)).toBeCloseTo(areaHa(field) / 2, 0)
    expect(zoneAreaWithinField(clipped, field)).toBeCloseTo(areaHa(clipped), 2)
  })

  it("returns null for a zone entirely outside the field", () => {
    const outside: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [4.99, 52.0],
          [4.995, 52.0],
          [4.995, 52.01],
          [4.99, 52.01],
          [4.99, 52.0],
        ],
      ],
    }
    expect(clipZoneToField(outside, field)).toBeNull()
  })
})
