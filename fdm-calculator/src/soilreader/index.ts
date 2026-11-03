import type { Geometry, MultiPoint, MultiPolygon, Polygon } from "geojson"
import { wktToGeoJSON } from "@terraformer/wkt"
import proj4 from "proj4"
import { soilReaderClient } from "../nmi/client"

const SOIL_READER_URL = "https://api.nmi-agro.nl/soilreader"

// RD New (EPSG:28992), the Dutch national grid used for sample locations in lab reports.
if (!proj4.defs("EPSG:28992")) {
  proj4.defs(
    "EPSG:28992",
    "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +units=m +no_defs",
  )
}

/**
 * A soil analysis read from a lab report, before it is saved.
 */
export type ExtractedSoilAnalysis = {
  /** File name of the report, as returned by the reading service. */
  filename?: string
  /** Name of the field on the report, for matching it to a field. */
  b_name?: string
  /** Date of sampling. */
  b_sampling_date?: Date
  /** Agricultural soil type on the report. */
  b_soil_type?: string
  /** Upper boundary of the sampled layer (cm). */
  a_depth_upper?: number
  /** Lower boundary of the sampled layer (cm). */
  a_depth_lower?: number
  /** Sampling location in WGS84, for matching the analysis to a field. */
  location?: { type: "Point"; coordinates: [number, number] }
  /** Locations of the subsamples in WGS84, or `null` when the report has none. */
  b_sampling_geometry: MultiPoint | null
  /** Area the analysis represents in WGS84, or `null` when the report has none. */
  b_sampling_geometry_zone: Polygon | MultiPolygon | null
  /** Soil parameters (`a_*`) and the lab source `a_source`. */
  [parameter: `a_${string}`]: unknown
}

/**
 * Thrown when the lab report reading service rejects a request or returns no result.
 */
export class SoilReaderError extends Error {
  /** HTTP status of the reading service, when it returned one. */
  readonly status?: number

  /**
   * @param message - Description of the problem.
   * @param status - HTTP status of the reading service.
   */
  constructor(message: string, status?: number) {
    super(message)
    this.name = "SoilReaderError"
    this.status = status
  }
}

/**
 * Parses a sampling geometry from the reading service (WKT in WGS84) into GeoJSON.
 *
 * A single `POINT` is returned as a `MultiPoint` when a MultiPoint is expected. Only longitude and
 * latitude are kept, also when the WKT has a height. Missing, empty, malformed or unexpected
 * geometries and positions outside WGS84 return `null`, so a report is not rejected because of them.
 *
 * @param wkt - The WKT string.
 * @param expected - The accepted GeoJSON geometry types.
 * @returns The GeoJSON geometry, or `null`.
 */
export function parseSamplingGeometry<T extends MultiPoint | Polygon | MultiPolygon>(
  wkt: unknown,
  expected: T["type"][],
): T | null {
  if (typeof wkt !== "string" || wkt.trim() === "") return null
  try {
    let geometry = wktToGeoJSON(wkt.trim()) as Geometry
    if (geometry.type === "Point" && expected.includes("MultiPoint")) {
      geometry = { type: "MultiPoint", coordinates: [geometry.coordinates] }
    }
    if (!expected.includes(geometry.type as T["type"])) return null

    const toLonLat = (position: unknown): [number, number] | null => {
      if (!Array.isArray(position) || position.length < 2) return null
      const [lon, lat] = position as number[]
      return Number.isFinite(lon) &&
        Number.isFinite(lat) &&
        Math.abs(lon as number) <= 180 &&
        Math.abs(lat as number) <= 90
        ? [lon as number, lat as number]
        : null
    }
    const toRing = (ring: unknown): [number, number][] | null => {
      if (!Array.isArray(ring) || ring.length < 4) return null
      const positions = ring.map(toLonLat)
      return positions.every((position) => position !== null)
        ? (positions as [number, number][])
        : null
    }
    const toPolygon = (polygon: unknown): [number, number][][] | null => {
      if (!Array.isArray(polygon) || polygon.length === 0) return null
      const rings = polygon.map(toRing)
      return rings.every((ring) => ring !== null) ? (rings as [number, number][][]) : null
    }

    if (geometry.type === "MultiPoint") {
      const points = geometry.coordinates.map(toLonLat)
      if (points.length === 0 || points.some((point) => point === null)) return null
      return { type: "MultiPoint", coordinates: points as [number, number][] } as unknown as T
    }
    if (geometry.type === "Polygon") {
      const polygon = toPolygon(geometry.coordinates)
      return polygon ? ({ type: "Polygon", coordinates: polygon } as unknown as T) : null
    }
    if (geometry.type === "MultiPolygon") {
      const polygons = geometry.coordinates.map(toPolygon)
      if (polygons.length === 0 || polygons.some((polygon) => polygon === null)) return null
      return {
        type: "MultiPolygon",
        coordinates: polygons as [number, number][][][],
      } as unknown as T
    }
    return null
  } catch {
    return null
  }
}

/**
 * Parses a date in the format `dd-mm-yyyy`. Any other format, such as `yyyy-mm-dd`, is not read,
 * so a date is never interpreted with day and year swapped.
 */
function parseDutchDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value.trim())
  if (!match) return undefined
  const [, day, month, year] = match.map(Number) as [number, number, number, number]
  return new Date(year, month - 1, day)
}

/**
 * Converts one result of the reading service into a soil analysis.
 *
 * @param field - One entry of `data.fields` in the response of the reading service.
 * @returns The extracted soil analysis.
 * @throws {SoilReaderError} When the sampling depth on the report cannot be read.
 */
export function parseSoilReaderField(field: Record<string, unknown>): ExtractedSoilAnalysis {
  const analysis: ExtractedSoilAnalysis = {
    b_sampling_geometry: null,
    b_sampling_geometry_zone: null,
  }
  if (typeof field.filename === "string") analysis.filename = field.filename
  if (typeof field.b_fieldname === "string") analysis.b_name = field.b_fieldname

  for (const key of Object.keys(field)) {
    if (key.startsWith("a_")) analysis[key as `a_${string}`] = field[key]
  }

  const samplingDate = parseDutchDate(field.b_date)
  if (samplingDate) analysis.b_sampling_date = samplingDate
  if (typeof field.b_soiltype_agr === "string") analysis.b_soil_type = field.b_soiltype_agr

  const depth =
    typeof field.b_depth === "string" || typeof field.b_depth === "number"
      ? String(field.b_depth)
      : undefined
  if (depth) {
    const parts = depth.split("-")
    if (parts.length !== 2) {
      throw new SoilReaderError(`Invalid depth format: ${depth}`)
    }
    const upper = Number(parts[0])
    const lower = Number(parts[1])
    if (Number.isNaN(upper) || Number.isNaN(lower)) {
      throw new SoilReaderError(`Invalid numeric depth values: ${depth}`)
    }
    analysis.a_depth_upper = upper
    analysis.a_depth_lower = lower
  }

  // The sampling location is in RD New (EPSG:28992).
  const x = Number(field.b_loc_x)
  const y = Number(field.b_loc_y)
  if (field.b_loc_x && field.b_loc_y && !Number.isNaN(x) && !Number.isNaN(y)) {
    try {
      const [lon, lat] = proj4("EPSG:28992", "EPSG:4326", [x, y])
      analysis.location = { type: "Point", coordinates: [lon, lat] }
    } catch {
      // Without a location the analysis can still be matched by field name.
    }
  }
  // Fallback for a location given directly in WGS84.
  if (!analysis.location) {
    const lat = Number(field.a_lat ?? field.latitude ?? field.lat)
    const lon = Number(field.a_lon ?? field.longitude ?? field.lon)
    const hasLatLon =
      (field.a_lat ?? field.latitude ?? field.lat) != null &&
      (field.a_lon ?? field.longitude ?? field.lon) != null
    if (hasLatLon && !Number.isNaN(lat) && !Number.isNaN(lon)) {
      analysis.location = { type: "Point", coordinates: [lon, lat] }
    }
  }

  analysis.b_sampling_geometry = parseSamplingGeometry<MultiPoint>(field.b_sampling_geometry, [
    "MultiPoint",
  ])
  analysis.b_sampling_geometry_zone = parseSamplingGeometry<Polygon | MultiPolygon>(
    field.b_sampling_geometry_zone,
    ["Polygon", "MultiPolygon"],
  )
  return analysis
}

/**
 * Reads the soil analyses from lab report PDFs with the NMI SoilReader service.
 *
 * All files are sent in one request. Check the files (type, size) before calling this.
 *
 * @param files - The PDF files, with their file names.
 * @param nmiApiKey - The NMI API key.
 * @returns The soil analyses found in the reports. One report can contain several analyses.
 * @throws {SoilReaderError} When the API key is missing, the service rejects the request
 *   (`status` is set) or the response has no results.
 */
export async function extractSoilAnalysesFromPdfs(
  files: { file: Blob; filename: string }[],
  nmiApiKey: string | undefined,
): Promise<ExtractedSoilAnalysis[]> {
  if (!nmiApiKey) throw new SoilReaderError("NMI API key not provided")
  if (files.length === 0) return []

  const body = new FormData()
  for (const { file, filename } of files) {
    body.append("soilAnalysisFile", file, filename)
  }

  const response = await soilReaderClient.request(SOIL_READER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${nmiApiKey}` },
    body,
  })
  if (!response.ok) {
    throw new SoilReaderError(
      `Request to NMI API failed: ${response.status} ${response.statusText}`,
      response.status,
    )
  }

  const result = (await response.json()) as { data?: { fields?: unknown } }
  const fields = result?.data?.fields
  if (!Array.isArray(fields)) {
    throw new SoilReaderError("Invalid API response: no fields found")
  }
  return fields.map((field) => parseSoilReaderField(field as Record<string, unknown>))
}
