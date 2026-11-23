import type { MultiPolygon, Polygon } from "geojson"
import { describe, expect, it } from "vitest"
import {
  type Area,
  areaHa,
  clipFeedback,
  clipZoneToField,
  cutEqualPlots,
  cutStrip,
  cutStrips,
  hasHoles,
  intersectAreas,
  MAX_PLOTS,
  occupiedPart,
  SNAP_TOLERANCE_PX,
  snapToEdges,
  subtractAreas,
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

/** Synthetic U-shaped field: two arms in the north, joined in the south. */
const uField: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [5.0, 52.0],
      [5.01, 52.0],
      [5.01, 52.01],
      [5.007, 52.01],
      [5.007, 52.004],
      [5.003, 52.004],
      [5.003, 52.01],
      [5.0, 52.01],
      [5.0, 52.0],
    ],
  ],
}

/** Synthetic field with a hole in the middle, such as a farmyard. */
const fieldWithHole: Polygon = {
  type: "Polygon",
  coordinates: [
    field.coordinates[0],
    [
      [5.003, 52.003],
      [5.003, 52.007],
      [5.007, 52.007],
      [5.007, 52.003],
      [5.003, 52.003],
    ],
  ],
}

const rectangle = (west: number, south: number, east: number, north: number): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
})

const overlapHa = (a: Area, b: Area) => {
  const overlap = intersectAreas(a, b)
  return overlap ? areaHa(overlap) : 0
}

/** Checks that plots divide a field: no two plots overlap and together they cover the field. */
const expectPartition = (whole: Area, plots: Area[]) => {
  for (let i = 0; i < plots.length; i++) {
    for (let j = i + 1; j < plots.length; j++) {
      expect(overlapHa(plots[i], plots[j])).toBeLessThan(0.01)
    }
  }
  const total = plots.reduce((sum, plot) => sum + areaHa(plot), 0)
  expect(total).toBeCloseTo(areaHa(whole), 1)
  const uncovered = subtractAreas(whole, plots)
  expect(uncovered ? areaHa(uncovered) : 0).toBeLessThan(0.01)
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
    // The strips share a fence: the second starts where the first ends, without a gap
    const lons = (area: Area) =>
      toMultiPolygon(area)
        .coordinates.flat(2)
        .map(([lon]) => lon)
    expect(Math.min(...lons(second))).toBeCloseTo(Math.max(...lons(first)), 5)
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

describe("occupiedPart", () => {
  it("occupies the zone of a grazing and the whole field for a grazing of the whole field", () => {
    const zone = toMultiPolygon(cutStrip({ field, targetAreaHa: 2, bearing: 90 }) as Area)
    expect(occupiedPart([{ l_grazing_geometry_zone: zone }], field)).toEqual({
      occupied: [zone],
      unknown: false,
    })
    expect(occupiedPart([{ l_grazing_geometry_zone: null, l_grazing_area: null }], field)).toEqual({
      occupied: [field],
      unknown: false,
    })
  })

  it("leaves the free part unknown after a grazing with only an area", () => {
    expect(occupiedPart([{ l_grazing_area: 1.5 }], field)).toEqual({ occupied: [], unknown: true })
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

  it("snaps to the corner of the second part of a MultiPolygon field", () => {
    const twoParts: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [field.coordinates, rectangle(5.02, 52.0, 5.03, 52.01).coordinates],
    }
    expect(snapToEdges([5.0205, 52.0005], [twoParts], project)).toEqual([5.02, 52.0])
  })

  it("snaps to the edge of a hole in the field", () => {
    // 2 px north of the southern edge of the hole, 20 px from its corners
    const snapped = snapToEdges([5.005, 52.0032], [fieldWithHole], project) as number[]
    expect(snapped[0]).toBeCloseTo(5.005, 6)
    expect(snapped[1]).toBeCloseTo(52.003, 6)
  })

  it("snaps at exactly the tolerance, but not beyond it", () => {
    // Projection to whole pixels, so the distances are exact
    const identity = (x: number, y: number) => ({ x, y })
    const square = rectangle(0, 0, 100, 100)
    expect(snapToEdges([50, SNAP_TOLERANCE_PX], [square], identity)).toEqual([50, 0])
    expect(snapToEdges([50, SNAP_TOLERANCE_PX + 0.01], [square], identity)).toBeUndefined()
    expect(snapToEdges([50, 5], [square], identity, 4)).toBeUndefined()
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

  it("returns a MultiPolygon when the zone crosses a notch in the field", () => {
    // A band across both arms of the U-shaped field
    const band = rectangle(5.001, 52.006, 5.009, 52.008)
    const clipped = clipZoneToField(band, uField) as Area
    expect(clipped.type).toBe("MultiPolygon")
    expect((clipped as MultiPolygon).coordinates).toHaveLength(2)
    // Two arms of 0,002° wide each, out of a band of 0,008° wide
    expect(areaHa(clipped)).toBeCloseTo(areaHa(band) / 2, 2)
  })

  it("ignores a part outside the field below 0,5 m² as rounding", () => {
    // About 0,15 m² beyond the western edge: kept as drawn
    const sliver = rectangle(5.0 - 2e-8, 52.001, 5.002, 52.002)
    expect(clipZoneToField(sliver, field)).toBe(sliver)
    // About 7,6 m² beyond the western edge: clipped
    const strip = rectangle(5.0 - 1e-6, 52.001, 5.002, 52.002)
    const clipped = clipZoneToField(strip, field)
    expect(clipped).not.toBe(strip)
    expect(areaHa(clipped as Area)).toBeLessThan(areaHa(strip))
  })
})

describe("clipFeedback", () => {
  it("reports a zone within the field as inside", () => {
    const inside = rectangle(5.001, 52.001, 5.002, 52.002)
    expect(clipFeedback(inside, clipZoneToField(inside, field))).toBe("inside")
  })

  it("reports a zone partly outside the field as clipped", () => {
    const halfOutside = rectangle(4.995, 52.0, 5.005, 52.01)
    expect(clipFeedback(halfOutside, clipZoneToField(halfOutside, field))).toBe("clipped")
  })

  it("reports a zone entirely outside the field as outside", () => {
    const outside = rectangle(4.99, 52.0, 4.995, 52.01)
    expect(clipFeedback(outside, clipZoneToField(outside, field))).toBe("outside")
  })

  it("treats a difference below 0,5 m² as inside", () => {
    const sliver = rectangle(5.0 - 2e-8, 52.001, 5.002, 52.002)
    const clipped = intersectAreas(sliver, field)
    expect(clipFeedback(sliver, clipped)).toBe("inside")
  })
})

describe("hasHoles", () => {
  it("is false for a polygon without a hole", () => {
    expect(hasHoles(field)).toBe(false)
  })

  it("is true for a polygon with a hole", () => {
    expect(hasHoles(fieldWithHole)).toBe(true)
  })

  it("is true for a MultiPolygon with a hole in one of its parts", () => {
    expect(hasHoles(toMultiPolygon(field))).toBe(false)
    const multi: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [rectangle(4.98, 52.0, 4.99, 52.01).coordinates, fieldWithHole.coordinates],
    }
    expect(hasHoles(multi)).toBe(true)
  })
})

describe("cutEqualPlots", () => {
  it("divides a field into plots of equal size that cover the field", () => {
    const fieldArea = areaHa(field)
    const plots = cutEqualPlots({ field, plotAreaHa: 10, bearing: 90 })
    const expectedCount = Math.round(fieldArea / 10)
    expect(plots).toHaveLength(expectedCount)
    for (const plot of plots) {
      expect(areaHa(plot)).toBeCloseTo(fieldArea / expectedCount, 0)
    }
    expectPartition(field, plots)
  })

  it("divides a concave field", () => {
    const plots = cutEqualPlots({ field: lField, plotAreaHa: 8, bearing: 0 })
    const fieldArea = areaHa(lField)
    expect(plots.length).toBe(Math.round(fieldArea / 8))
    for (const plot of plots) {
      expect(areaHa(plot)).toBeCloseTo(fieldArea / plots.length, 0)
    }
    expectPartition(lField, plots)
  })

  it("cuts at most MAX_PLOTS plots for a tiny plot size", () => {
    const plots = cutEqualPlots({ field, plotAreaHa: 1e-12, bearing: 90 })
    expect(plots.length).toBe(MAX_PLOTS)
  })

  it("keeps a field smaller than one plot as one plot", () => {
    const plots = cutEqualPlots({ field, plotAreaHa: 500, bearing: 0 })
    expect(plots).toHaveLength(1)
    expect(areaHa(plots[0])).toBeCloseTo(areaHa(field), 1)
  })

  it("returns no plots for a plot size of 0", () => {
    expect(cutEqualPlots({ field, plotAreaHa: 0, bearing: 0 })).toEqual([])
  })
})
