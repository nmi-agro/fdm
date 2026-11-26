/**
 * Sampling locations and zones for the demo soil analyses, derived from the field outlines.
 */

import type { MultiPoint, MultiPolygon, Polygon } from "geojson"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"
import { featureCollection, polygon as turfPolygon } from "@turf/helpers"
import intersect from "@turf/intersect"

/**
 * Returns the bounding box of a polygon.
 *
 * @param area - The polygon.
 * @returns `[west, south, east, north]`.
 */
function bbox(area: Polygon | MultiPolygon): [number, number, number, number] {
  const rings = area.type === "Polygon" ? [area.coordinates[0]] : area.coordinates.map((p) => p[0])
  const points = rings.flat()
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

/**
 * Spreads subsample locations evenly over an area, as a sampler walking a grid would.
 *
 * @param area - The area that the soil analysis represents.
 * @param count - The number of locations to aim for (default 12).
 * @returns The locations, rounded to 6 decimals.
 */
export function samplingPoints(area: Polygon | MultiPolygon, count = 12): MultiPoint {
  const [west, south, east, north] = bbox(area)
  const round = (value: number) => Math.round(value * 1e6) / 1e6
  // Start fine and coarsen until the grid has about `count` points inside the area.
  for (let steps = 12; steps >= 2; steps--) {
    const points: [number, number][] = []
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const point: [number, number] = [
          round(west + ((i + 0.5) / steps) * (east - west)),
          round(south + ((j + 0.5) / steps) * (north - south)),
        ]
        if (booleanPointInPolygon(point, area)) points.push(point)
      }
    }
    if (points.length <= count) return { type: "MultiPoint", coordinates: points }
  }
  throw new Error("Could not place sampling points in the area")
}

/**
 * Splits a field into a western and an eastern zone, for analyses that each cover part of it.
 *
 * @param field - The field outline.
 * @returns The two zones.
 */
export function splitWestEast(field: Polygon): [Polygon | MultiPolygon, Polygon | MultiPolygon] {
  const [west, south, east, north] = bbox(field)
  const middle = (west + east) / 2
  const half = (from: number, to: number) =>
    turfPolygon([
      [
        [from, south - 1e-4],
        [to, south - 1e-4],
        [to, north + 1e-4],
        [from, north + 1e-4],
        [from, south - 1e-4],
      ],
    ])
  const zones = [half(west - 1e-4, middle), half(middle, east + 1e-4)].map((part) => {
    const zone = intersect(featureCollection([turfPolygon(field.coordinates), part]))
    if (!zone) throw new Error("Could not split the field into zones")
    return zone.geometry
  })
  return [zones[0], zones[1]]
}
