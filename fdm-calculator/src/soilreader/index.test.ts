import { afterEach, describe, expect, it, vi } from "vitest"
import { soilReaderClient } from "../nmi/client"
import {
  extractSoilAnalysesFromPdfs,
  parseSamplingGeometry,
  parseSoilReaderField,
  SoilReaderError,
} from "./index"

describe("parseSamplingGeometry", () => {
  it("turns a POINT into a MultiPoint and drops the height", () => {
    expect(parseSamplingGeometry("POINT Z (5.1 52.1 3)", ["MultiPoint"])).toEqual({
      type: "MultiPoint",
      coordinates: [[5.1, 52.1]],
    })
  })

  it("returns null for an unexpected type, invalid WKT or coordinates outside WGS84", () => {
    expect(parseSamplingGeometry("POINT (5 52)", ["Polygon"])).toBeNull()
    expect(parseSamplingGeometry("not wkt", ["MultiPoint"])).toBeNull()
    expect(parseSamplingGeometry("MULTIPOINT ((155000 463000))", ["MultiPoint"])).toBeNull()
    expect(parseSamplingGeometry(undefined, ["MultiPoint"])).toBeNull()
  })
})

describe("parseSoilReaderField", () => {
  it("maps the soil parameters, date, depth and location", () => {
    const analysis = parseSoilReaderField({
      filename: "rapport.pdf",
      b_fieldname: "Achter de schuur",
      a_source: "nl-rva-l122",
      a_som_loi: 3.4,
      b_date: "15-03-2026",
      b_depth: "0-30",
      b_soiltype_agr: "dekzand",
      b_loc_x: 155000,
      b_loc_y: 463000,
      b_sampling_zone_ignored: "x",
    })
    expect(analysis).toMatchObject({
      filename: "rapport.pdf",
      b_name: "Achter de schuur",
      a_source: "nl-rva-l122",
      a_som_loi: 3.4,
      b_soil_type: "dekzand",
      a_depth_upper: 0,
      a_depth_lower: 30,
    })
    expect(analysis.b_sampling_date).toEqual(new Date(2026, 2, 15))
    const [lon, lat] = analysis.location?.coordinates ?? []
    // The origin of RD New lies near Amersfoort.
    expect(lon).toBeCloseTo(5.387, 2)
    expect(lat).toBeCloseTo(52.155, 2)
  })

  it("rejects an unreadable depth", () => {
    expect(() => parseSoilReaderField({ b_depth: "0-30-60" })).toThrow(SoilReaderError)
  })
})

describe("extractSoilAnalysesFromPdfs", () => {
  afterEach(() => vi.restoreAllMocks())

  const pdf = { file: new Blob(["%PDF-1.7"]), filename: "a.pdf" }

  it("returns the analyses found in the reports", async () => {
    vi.spyOn(soilReaderClient, "request").mockResolvedValue(
      new Response(JSON.stringify({ data: { fields: [{ a_source: "lab", a_som_loi: 2 }] } })),
    )
    const analyses = await extractSoilAnalysesFromPdfs([pdf], "key")
    expect(analyses).toHaveLength(1)
    expect(analyses[0]?.a_som_loi).toBe(2)
  })

  it("passes the status of a rejected request", async () => {
    vi.spyOn(soilReaderClient, "request").mockResolvedValue(
      new Response("too large", { status: 413 }),
    )
    const error = await extractSoilAnalysesFromPdfs([pdf], "key").catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SoilReaderError)
    expect((error as SoilReaderError).status).toBe(413)
  })

  it("requires an API key", async () => {
    await expect(extractSoilAnalysesFromPdfs([pdf], undefined)).rejects.toThrow(SoilReaderError)
  })
})

describe("parseSamplingGeometry with polygons", () => {
  const ring = "5 52, 5.01 52, 5.01 52.01, 5 52.01, 5 52"

  it("reads a polygon and a multipolygon", () => {
    expect(parseSamplingGeometry(`POLYGON ((${ring}))`, ["Polygon", "MultiPolygon"])).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [5, 52],
          [5.01, 52],
          [5.01, 52.01],
          [5, 52.01],
          [5, 52],
        ],
      ],
    })
    expect(
      parseSamplingGeometry(`MULTIPOLYGON (((${ring})), ((${ring})))`, ["Polygon", "MultiPolygon"])
        ?.type,
    ).toBe("MultiPolygon")
  })

  it.each([
    ["a ring with fewer than four positions", "POLYGON ((5 52, 5.01 52, 5 52))"],
    ["a position outside WGS84", "POLYGON ((155000 463000, 5.01 52, 5.01 52.01, 155000 463000))"],
    ["an empty polygon", "POLYGON EMPTY"],
    ["an empty multipolygon", "MULTIPOLYGON EMPTY"],
    ["a multipolygon with a bad part", `MULTIPOLYGON (((${ring})), ((5 52, 6 52, 5 52)))`],
    ["an unexpected type", "LINESTRING (5 52, 6 52)"],
    ["an empty string", "  "],
  ])("returns null for %s", (_, wkt) => {
    expect(parseSamplingGeometry(wkt, ["Polygon", "MultiPolygon"])).toBeNull()
  })

  it("returns null for an empty multipoint", () => {
    expect(parseSamplingGeometry("MULTIPOINT EMPTY", ["MultiPoint"])).toBeNull()
  })
})

describe("parseSoilReaderField edge cases", () => {
  it.each([
    ["a_lat / a_lon", { a_lat: 52.1, a_lon: 5.2 }],
    ["latitude / longitude", { latitude: 52.1, longitude: 5.2 }],
    ["lat / lon", { lat: "52.1", lon: "5.2" }],
  ])("uses a WGS84 location from %s", (_, location) => {
    expect(parseSoilReaderField(location).location).toEqual({
      type: "Point",
      coordinates: [5.2, 52.1],
    })
  })

  it("has no location without coordinates or with invalid ones", () => {
    expect(parseSoilReaderField({}).location).toBeUndefined()
    expect(parseSoilReaderField({ a_lat: "x", a_lon: 5 }).location).toBeUndefined()
    expect(parseSoilReaderField({ b_loc_x: "x", b_loc_y: 1 }).location).toBeUndefined()
  })

  it("accepts a numeric depth and rejects non-numeric values", () => {
    expect(parseSoilReaderField({ b_depth: "10-20" })).toMatchObject({
      a_depth_upper: 10,
      a_depth_lower: 20,
    })
    expect(() => parseSoilReaderField({ b_depth: "0-x" })).toThrow(SoilReaderError)
    expect(parseSoilReaderField({ b_depth: { from: 0 } }).a_depth_lower).toBeUndefined()
  })

  it("ignores a sampling date that cannot be read", () => {
    expect(parseSoilReaderField({ b_date: "2026-03-15" }).b_sampling_date).toBeUndefined()
    expect(parseSoilReaderField({ b_date: "aa-bb-cccc" }).b_sampling_date).toBeUndefined()
    expect(parseSoilReaderField({ b_date: 20260315 }).b_sampling_date).toBeUndefined()
  })

  it("leaves out a file name and field name that are not text", () => {
    const analysis = parseSoilReaderField({ filename: 1, b_fieldname: null, b_soiltype_agr: 2 })
    expect(analysis.filename).toBeUndefined()
    expect(analysis.b_name).toBeUndefined()
    expect(analysis.b_soil_type).toBeUndefined()
  })
})

describe("extractSoilAnalysesFromPdfs edge cases", () => {
  afterEach(() => vi.restoreAllMocks())

  it("returns nothing without files", async () => {
    expect(await extractSoilAnalysesFromPdfs([], "key")).toEqual([])
  })

  it("rejects a response without fields", async () => {
    vi.spyOn(soilReaderClient, "request").mockResolvedValue(
      new Response(JSON.stringify({ data: {} })),
    )
    await expect(
      extractSoilAnalysesFromPdfs([{ file: new Blob(["%PDF"]), filename: "a.pdf" }], "key"),
    ).rejects.toThrow(SoilReaderError)
  })
})
