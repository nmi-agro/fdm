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
