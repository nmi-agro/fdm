import type { Polygon } from "geojson"
import { describe, expect, it } from "vitest"
import { herdsOfYear, zoneWithinField } from "./grazing-herds"

describe("herdsOfYear", () => {
  it("takes the herds of the census and adds ended herds that grazed, sorted by name", () => {
    const herds = herdsOfYear(
      [
        {
          l_id_herd: "h2",
          l_herd_name: "Pinken",
          l_id_category: "rvo_102",
          l_lsu: 0.5,
          count: 20,
        },
        { l_id_herd: "h1", l_herd_name: null, l_id_category: "rvo_100", l_lsu: null, count: 80 },
      ],
      [
        // An ended herd that grazed in the year
        { l_id_herd: "h3", l_herd_name: "Droge koeien", l_id_category: "rvo_100", l_lsu: 1 },
        // A herd of the census: its census values count
        { l_id_herd: "h2", l_herd_name: "Pinken", l_id_category: "rvo_102", l_lsu: 0.5 },
        // Without a category the herd cannot be counted
        { l_id_herd: "h4", l_herd_name: "Onbekend" },
      ],
    )
    expect(herds).toEqual([
      {
        l_id_herd: "h3",
        l_herd_name: "Droge koeien",
        l_id_category: "rvo_100",
        l_lsu: 1,
        count: 0,
        colorIndex: 0,
      },
      {
        l_id_herd: "h1",
        l_herd_name: "Koppel",
        l_id_category: "rvo_100",
        l_lsu: 1,
        count: 80,
        colorIndex: 1,
      },
      {
        l_id_herd: "h2",
        l_herd_name: "Pinken",
        l_id_category: "rvo_102",
        l_lsu: 0.5,
        count: 20,
        colorIndex: 2,
      },
    ])
  })
})

describe("zoneWithinField", () => {
  const square = (lonMin: number, lonMax: number): Polygon => ({
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
  const field = square(5.0, 5.01)

  it("clips a zone to the field", () => {
    const clipped = zoneWithinField(square(5.005, 5.015), field)
    const lons =
      JSON.stringify(clipped)
        .match(/5\.0\d+/g)
        ?.map(Number) ?? []
    expect(Math.max(...lons)).toBeCloseTo(5.01, 6)
  })

  it("keeps the whole field, a zone without a field and a zone outside the field", () => {
    expect(zoneWithinField(null, field)).toBeNull()
    const zone = square(5.002, 5.004)
    expect(zoneWithinField(zone, null)).toBe(zone)
    const outside = square(6.0, 6.01)
    expect(zoneWithinField(outside, field)).toBe(outside)
  })
})
