import type * as core from "@nmi-agro/fdm-core"
import type { FileStorage } from "@nmi-agro/fdm-storage"
import { z } from "@hono/zod-openapi"
import { enrichCurrentSoilDataWithNlv } from "@nmi-agro/fdm-calculator"
import {
  describeCodes,
  codeEnum,
  SELECTABLE_SOIL_ANALYSIS_SOURCES,
  SOIL_ANALYSIS_SOURCES,
} from "../codes"
import { ApiError } from "../error"
import {
  FieldIdSchema,
  SoilAnalysisIdSchema,
  type SoilParameterCode,
  soilParameterDescriptions,
  soilParameterShape,
} from "../fields"
import { assertGeoJsonCoordinates } from "../guards"
import { assertFarmSizeSupported, type LimitServices } from "../limits"
import {
  DateStringSchema,
  GeoJsonMultiPointSchema,
  GeoJsonMultiPolygonSchema,
  parseTimeframeQuery,
  SamplingZoneGeometrySchema,
  SoilAnalysisDataSchema,
  serializeDate,
  TimeframeQuerySchema,
} from "../schemas"
import { DELETED, DeletedSchema } from "./common"
import { FarmParamsSchema } from "./farms"
import { defineOperation, type OperationContext } from "./types"

/**
 * Defines the soil analysis data access functions required by the soil analysis operations.
 */
export interface SoilAnalysisServices extends LimitServices {
  /** Returns all soil analyses for a field visible to the authenticated principal. */
  getSoilAnalyses: typeof core.getSoilAnalyses
  /** Returns all soil analyses on a farm visible to the authenticated principal. */
  getSoilAnalysesForFarm: typeof core.getSoilAnalysesForFarm
  /** Returns current soil data for a field visible to the authenticated principal. */
  getCurrentSoilData: typeof core.getCurrentSoilData
  /** Returns current soil data per sampling zone for a field visible to the authenticated principal. */
  getCurrentSoilDataPerZone: typeof core.getCurrentSoilDataPerZone
  /** Returns current soil data for every field of a farm visible to the authenticated principal. */
  getCurrentSoilDataForFarm: typeof core.getCurrentSoilDataForFarm
  /** Returns a single soil analysis visible to the authenticated principal. */
  getSoilAnalysis: typeof core.getSoilAnalysis
  /** Creates a new soil analysis on an existing field. */
  addSoilAnalysis: typeof core.addSoilAnalysis
  /** Updates measurement data on an existing soil analysis. */
  updateSoilAnalysis: typeof core.updateSoilAnalysis
  /** Permanently deletes a soil analysis. */
  removeSoilAnalysis: typeof core.removeSoilAnalysis
  /** Returns the photos of a soil sampling, to delete their files with the analysis. */
  getSoilImages: typeof core.getSoilImages
  /** Returns the file storage; `undefined` when no storage is configured. */
  getStorage: () => FileStorage | undefined
}

/** A soil analysis as returned by the API, with every soil parameter (`null` when not measured). */
export const SoilAnalysisSchema = z
  .object({
    a_id: SoilAnalysisIdSchema,
    a_date: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    a_source: z
      .string()
      .describe(
        describeCodes(
          "Laboratory or dataset that produced the soil analysis.",
          SOIL_ANALYSIS_SOURCES,
        ),
      ),
    b_id_sampling: z.string().describe("Unique identifier of the soil sampling event."),
    a_depth_upper: z
      .number()
      .describe("Upper boundary of the sampled soil layer, measured from the surface (cm)."),
    a_depth_lower: z
      .number()
      .describe("Lower boundary of the sampled soil layer, measured from the surface (cm)."),
    b_sampling_date: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    ...soilParameterShape("nullable"),
    b_sampling_geometry: GeoJsonMultiPointSchema.nullable().describe(
      "Locations of the subsamples (WGS84).",
    ),
    b_sampling_geometry_zone: GeoJsonMultiPolygonSchema.nullable().describe(
      "Area the analysis represents (WGS84); null when it represents the whole field.",
    ),
    has_document: z
      .boolean()
      .describe(
        "True when the lab report (PDF) of this analysis is stored, for analyses imported with `POST /farms/{b_id_farm}/soil-analyses/import/apply`. Download it with `GET /soil-analyses/{a_id}/document`.",
      ),
  })
  .openapi("SoilAnalysis")

/** One soil analysis that contributes to a current soil data value. */
export const CurrentSoilDataSourceSchema = z
  .object({
    a_id: SoilAnalysisIdSchema.describe(
      "Unique identifier of the soil analysis. For a calculated value, the analysis of the newest input.",
    ),
    a_source: z
      .string()
      .describe(
        describeCodes(
          "Laboratory or dataset that produced the soil analysis, or `calculated` for a value derived from other parameters (see `d_n_supply_base` in CurrentSoilDataItem).",
          SOIL_ANALYSIS_SOURCES,
        ),
      ),
    b_sampling_date: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    a_depth_upper: z
      .number()
      .nullable()
      .describe(
        "Upper boundary of the sampled soil layer, measured from the surface (cm). `null` when unknown.",
      ),
    a_depth_lower: z
      .number()
      .nullable()
      .describe(
        "Lower boundary of the sampled soil layer, measured from the surface (cm). `null` when unknown.",
      ),
    value: z
      .union([z.number(), z.string(), z.null()])
      .describe(
        "Value of the parameter in this analysis, in the unit of that parameter. `null` when the analysis has no value.",
      ),
    area_fraction: z
      .number()
      .describe("Share of the area with a value that this analysis represents (0-1)."),
  })
  .openapi("CurrentSoilDataSource")

/** The current value of one soil parameter, with the analyses it is derived from. */
export const CurrentSoilDataItemSchema = z
  .object({
    parameter: z
      .string()
      .describe(
        "Code of the soil parameter, e.g. 'a_som_loi'. See the SoilAnalysis schema for the meaning and unit of each parameter. When no analysis has a nitrogen supplying capacity (`d_n_supply_base`, kg N/ha), it is calculated from `a_som_loi`, `a_clay_mi` and `a_cn_fr`, with one source of type `calculated` and `coverage` `null`; the web app shows the same value.",
      ),
    value: z
      .union([z.number(), z.string(), z.null()])
      .describe(
        "Area-weighted mean for numeric parameters; the value with the largest area for categorical parameters.",
      ),
    is_aggregated: z.boolean().describe("True when the value combines several sampling zones."),
    coverage: z
      .number()
      .nullable()
      .describe("Share of the field area that the sources represent (0-1)."),
    has_coverage_warning: z
      .boolean()
      .describe("True when the sampling zones cover less than 95% of the field."),
    sources: z
      .array(CurrentSoilDataSourceSchema)
      .describe("Contributing soil analyses, newest first."),
  })
  .openapi("CurrentSoilDataItem")

/** The current soil data of one field of a farm. */
export const FarmCurrentSoilDataSchema = z
  .object({
    b_id: FieldIdSchema.describe("Unique identifier of the field."),
    items: z
      .array(CurrentSoilDataItemSchema)
      .describe(
        "Current value of each soil parameter of the field. Empty when the field has no soil data.",
      ),
  })
  .openapi("FarmCurrentSoilData")

/** The current soil data of one sampling zone of a field. */
export const SoilZoneSchema = z
  .object({
    b_sampling_geometry_zone: GeoJsonMultiPolygonSchema.nullable().describe(
      "The zone clipped to the field boundary; null when the zone is the whole field.",
    ),
    b_area: z.number().nullable().describe("Area of the zone in ha."),
    a_ids: z.array(z.string()).describe("Soil analyses in this zone, newest first."),
    data: z
      .array(CurrentSoilDataItemSchema)
      .describe("Current soil data of the zone, one item per soil parameter."),
  })
  .openapi("SoilZone")

const SamplingGeometriesBodySchema = z.object({
  b_sampling_geometry: GeoJsonMultiPointSchema.nullable()
    .optional()
    .describe("Locations of the subsamples (GeoJSON MultiPoint, WGS84)."),
  b_sampling_geometry_zone: SamplingZoneGeometrySchema.nullable()
    .optional()
    .describe(
      "Area the analysis represents (GeoJSON Polygon or MultiPolygon, WGS84). Omit or null for the whole field.",
    ),
})

/** Body of a new soil analysis; also used for each analysis of a lab report import. */
export const CreateSoilAnalysisBodySchema = z
  .object({
    a_date: DateStringSchema.describe("Date in YYYY-MM-DD format."),
    a_source: codeEnum(SELECTABLE_SOIL_ANALYSIS_SOURCES).describe(
      describeCodes(
        "Laboratory or dataset that produced the soil analysis; 'other' when it is not listed.",
        SELECTABLE_SOIL_ANALYSIS_SOURCES,
      ),
    ),
    a_depth_lower: z.number().describe("Lower sampling depth in cm."),
    b_sampling_date: DateStringSchema.nullable().describe("Date in YYYY-MM-DD format."),
    a_depth_upper: z.number().optional().describe("Upper sampling depth in cm (default 0)."),
  })
  .merge(SoilAnalysisDataSchema)
  .merge(SamplingGeometriesBodySchema)
  .openapi("CreateSoilAnalysis")

/** Body for updating a soil analysis. Only supplied fields are changed. */
export const UpdateSoilAnalysisBodySchema = z
  .object({
    a_date: DateStringSchema.optional().describe("Date in YYYY-MM-DD format."),
    a_source: codeEnum(SELECTABLE_SOIL_ANALYSIS_SOURCES)
      .optional()
      .describe(
        describeCodes(
          "Laboratory or dataset that produced the soil analysis; 'other' when it is not listed.",
          SELECTABLE_SOIL_ANALYSIS_SOURCES,
        ),
      ),
  })
  .merge(SoilAnalysisDataSchema)
  .merge(SamplingGeometriesBodySchema)
  .openapi("UpdateSoilAnalysis")

/** Path parameters that identify a field. */
export const SoilAnalysisFieldParamsSchema = z.object({ b_id: FieldIdSchema })

/** Path parameters that identify a soil analysis. */
export const SoilAnalysisParamsSchema = z.object({ a_id: SoilAnalysisIdSchema })

/** Input that identifies a farm, with an optional timeframe for the soil analyses to use. */
export const FarmSoilTimeframeInputSchema = FarmParamsSchema.extend(TimeframeQuerySchema.shape)

/** Returns every soil parameter of an analysis, with `null` for parameters without a value. */
function serialiseSoilParameters(sa: core.SoilAnalysis) {
  const source = sa as unknown as Partial<Record<SoilParameterCode, number | string | null>>
  const values: Record<string, number | string | null> = {}
  for (const code of Object.keys(soilParameterDescriptions) as SoilParameterCode[]) {
    values[code] = source[code] ?? null
  }
  return values
}

/**
 * Serialises a soil analysis. The cast is needed because the soil parameters are added by code
 * and the fdm-core types allow `null` for fields the schema documents as always present.
 */
function serialiseSoilAnalysis(sa: core.SoilAnalysis) {
  return {
    a_id: sa.a_id,
    a_date: serializeDate(sa.a_date),
    a_source: sa.a_source,
    b_id_sampling: sa.b_id_sampling,
    a_depth_upper: sa.a_depth_upper,
    a_depth_lower: sa.a_depth_lower,
    b_sampling_date: serializeDate(sa.b_sampling_date),
    ...serialiseSoilParameters(sa),
    b_sampling_geometry: sa.b_sampling_geometry ?? null,
    b_sampling_geometry_zone: sa.b_sampling_geometry_zone ?? null,
    has_document: Boolean((sa as { a_file_path?: string | null }).a_file_path),
  } as z.infer<typeof SoilAnalysisSchema>
}

/**
 * Serialises current soil data. The cast is needed because the fdm-core types allow `null` for
 * fields the schema documents as always present.
 */
function serialiseCurrentSoilData(currentSoilData: core.CurrentSoilData) {
  // Same NLV fallback as the web app, so both show the same value.
  return enrichCurrentSoilDataWithNlv(currentSoilData).map((item) => ({
    parameter: item.parameter,
    value: item.value ?? null,
    is_aggregated: item.is_aggregated,
    coverage: item.coverage,
    has_coverage_warning: item.has_coverage_warning,
    sources: item.sources.map((source) => ({
      a_id: source.a_id,
      a_source: source.a_source,
      b_sampling_date: serializeDate(source.b_sampling_date),
      a_depth_upper: source.a_depth_upper ?? null,
      a_depth_lower: source.a_depth_lower ?? null,
      value: source.value ?? null,
      area_fraction: source.area_fraction,
    })),
  })) as z.infer<typeof CurrentSoilDataItemSchema>[]
}

function serialiseSoilZones(zones: core.SoilZone[]) {
  return zones.map((zone) => ({
    b_sampling_geometry_zone: zone.b_sampling_geometry_zone,
    b_area: zone.b_area,
    a_ids: zone.a_ids,
    data: serialiseCurrentSoilData(zone.data),
  })) as z.infer<typeof SoilZoneSchema>[]
}

/**
 * Checks the sampling geometries of a soil analysis body: the coordinate count, that every
 * position is a WGS84 longitude and latitude and no geometry is empty, and that every ring of the
 * zone is closed and has at least four positions. Invalid geometries are rejected with a 422
 * instead of failing later in the soil analysis service.
 *
 * @param body - Body with optional `b_sampling_geometry` and `b_sampling_geometry_zone`.
 * @throws {ApiError} 422 when a geometry is empty, has a position outside WGS84, or has an invalid
 * polygon or ring.
 */
export function assertSamplingGeometries(body: {
  b_sampling_geometry?: unknown
  b_sampling_geometry_zone?: unknown
}): void {
  for (const [name, geometry] of [
    ["b_sampling_geometry", body.b_sampling_geometry],
    ["b_sampling_geometry_zone", body.b_sampling_geometry_zone],
  ] as const) {
    if (!geometry) continue
    assertGeoJsonCoordinates(geometry)
    const positions = collectPositions((geometry as { coordinates?: unknown }).coordinates)
    if (positions.length === 0) {
      throw new ApiError(422, "unprocessable-entity", `${name} has no coordinates.`)
    }
    const outside = positions.some(([lon, lat]) => !(Math.abs(lon) <= 180 && Math.abs(lat) <= 90))
    if (outside) {
      throw new ApiError(
        422,
        "unprocessable-entity",
        `${name} has a position outside WGS84 (longitude -180 to 180, latitude -90 to 90).`,
      )
    }
  }
  if (body.b_sampling_geometry_zone) assertPolygonRings(body.b_sampling_geometry_zone)
}

/**
 * Checks the rings of a Polygon or MultiPolygon zone: every polygon has at least one ring, and
 * every ring is closed and has at least four positions.
 *
 * @throws {ApiError} 422 when a polygon or ring is invalid.
 */
function assertPolygonRings(geometry: unknown): void {
  const { type, coordinates } = geometry as { type?: string; coordinates?: unknown }
  const polygons = (
    type === "Polygon" ? [coordinates] : Array.isArray(coordinates) ? coordinates : []
  ) as unknown[]
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      throw new ApiError(
        422,
        "unprocessable-entity",
        "b_sampling_geometry_zone has a polygon without rings.",
      )
    }
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) {
        throw new ApiError(
          422,
          "unprocessable-entity",
          "b_sampling_geometry_zone has a ring with fewer than four positions.",
        )
      }
      const first = ring[0] as unknown[]
      const last = ring[ring.length - 1] as unknown[]
      if (
        !Array.isArray(first) ||
        !Array.isArray(last) ||
        first.length !== last.length ||
        first.some((value, index) => value !== last[index])
      ) {
        throw new ApiError(
          422,
          "unprocessable-entity",
          "b_sampling_geometry_zone has a ring whose first and last positions differ.",
        )
      }
    }
  }
}

/** Collects the positions of a GeoJSON coordinate array of any depth. */
function collectPositions(coordinates: unknown): [number, number][] {
  if (!Array.isArray(coordinates)) return []
  if (typeof coordinates[0] === "number") return [coordinates as [number, number]]
  return coordinates.flatMap((child) => collectPositions(child))
}

/** Lists all soil analyses of a field. */
export const listFieldSoilAnalyses = defineOperation({
  name: "listFieldSoilAnalyses",
  kind: "read",
  bucket: "general",
  input: SoilAnalysisFieldParamsSchema,
  output: z.array(SoilAnalysisSchema),
  run: async ({ fdm, services, principal }: OperationContext<SoilAnalysisServices>, { b_id }) => {
    const analyses = await services.getSoilAnalyses(fdm, principal.effectivePrincipalId, b_id)
    return analyses.map(serialiseSoilAnalysis)
  },
})

/**
 * Lists the soil analyses of all fields of a farm, ordered by analysis date and then by ID.
 * `from` and `to` limit the list to analyses from that period.
 */
export const listFarmSoilAnalyses = defineOperation({
  name: "listFarmSoilAnalyses",
  kind: "read",
  bucket: "general",
  input: FarmSoilTimeframeInputSchema,
  output: z.array(SoilAnalysisSchema),
  run: async (
    { fdm, services, principal }: OperationContext<SoilAnalysisServices>,
    { b_id_farm, ...timeframe },
  ) => {
    await assertFarmSizeSupported(fdm, services, principal.effectivePrincipalId, b_id_farm)
    const analysesByField = await services.getSoilAnalysesForFarm(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      parseTimeframeQuery(timeframe),
    )
    const analyses = Array.from(analysesByField.values()).flat()
    analyses.sort((a, b) => {
      // Compare YYYY-MM-DD, which sorts by date; String(Date) starts with the weekday.
      const dateA = serializeDate(a.a_date) ?? ""
      const dateB = serializeDate(b.a_date) ?? ""
      return dateA < dateB
        ? -1
        : dateA > dateB
          ? 1
          : String(a.a_id ?? "").localeCompare(String(b.a_id ?? ""))
    })
    return analyses.map(serialiseSoilAnalysis)
  },
})

/**
 * Returns the current value of each soil parameter of a field. Sampling zones sampled within one
 * month are combined by area.
 */
export const getFieldCurrentSoilData = defineOperation({
  name: "getFieldCurrentSoilData",
  kind: "read",
  bucket: "general",
  input: SoilAnalysisFieldParamsSchema,
  output: z.array(CurrentSoilDataItemSchema),
  run: async ({ fdm, services, principal }: OperationContext<SoilAnalysisServices>, { b_id }) => {
    const currentSoilData = await services.getCurrentSoilData(
      fdm,
      principal.effectivePrincipalId,
      b_id,
    )
    if (currentSoilData.length === 0) {
      throw new ApiError(404, "not-found", `Current soil data for field '${b_id}' not found.`)
    }
    return serialiseCurrentSoilData(currentSoilData)
  },
})

/**
 * Returns the current soil data of every field of a farm, ordered by field ID. `from` and `to`
 * limit the data to analyses from that period.
 */
export const getFarmCurrentSoilData = defineOperation({
  name: "getFarmCurrentSoilData",
  kind: "read",
  bucket: "general",
  input: FarmSoilTimeframeInputSchema,
  output: z.array(FarmCurrentSoilDataSchema),
  run: async (
    { fdm, services, principal }: OperationContext<SoilAnalysisServices>,
    { b_id_farm, ...timeframe },
  ) => {
    await assertFarmSizeSupported(fdm, services, principal.effectivePrincipalId, b_id_farm)
    const soilDataByField = await services.getCurrentSoilDataForFarm(
      fdm,
      principal.effectivePrincipalId,
      b_id_farm,
      parseTimeframeQuery(timeframe),
    )
    return [...soilDataByField]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([b_id, currentSoilData]) => ({
        b_id,
        items: serialiseCurrentSoilData(currentSoilData),
      }))
  },
})

/** Returns the current soil data of a field per sampling zone, with the zone clipped to the field. */
export const getFieldCurrentSoilDataPerZone = defineOperation({
  name: "getFieldCurrentSoilDataPerZone",
  kind: "read",
  bucket: "general",
  input: SoilAnalysisFieldParamsSchema,
  output: z.array(SoilZoneSchema),
  run: async ({ fdm, services, principal }: OperationContext<SoilAnalysisServices>, { b_id }) => {
    const zones = await services.getCurrentSoilDataPerZone(
      fdm,
      principal.effectivePrincipalId,
      b_id,
    )
    if (zones.length === 0) {
      throw new ApiError(404, "not-found", `Current soil data for field '${b_id}' not found.`)
    }
    return serialiseSoilZones(zones)
  },
})

/** Creates a soil analysis on a field from the supplied values. */
export const createSoilAnalysis = defineOperation({
  name: "createSoilAnalysis",
  kind: "create",
  bucket: "write",
  input: SoilAnalysisFieldParamsSchema.extend(CreateSoilAnalysisBodySchema.shape),
  output: SoilAnalysisSchema,
  run: async (
    { fdm, services, principal }: OperationContext<SoilAnalysisServices>,
    { b_id, ...body },
  ) => {
    assertSamplingGeometries(body)
    const { a_date, a_source, a_depth_lower, b_sampling_date, a_depth_upper, ...soilAnalysisData } =
      body
    const a_id = await services.addSoilAnalysis(
      fdm,
      principal.effectivePrincipalId,
      new Date(a_date),
      a_source,
      b_id,
      a_depth_lower,
      b_sampling_date ? new Date(b_sampling_date) : null,
      soilAnalysisData as Parameters<typeof core.addSoilAnalysis>[7],
      a_depth_upper,
    )
    const analysis = await services.getSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)
    if (!analysis?.a_id) {
      throw new ApiError(500, "internal-error", "Soil analysis created but could not be retrieved.")
    }
    return serialiseSoilAnalysis(analysis)
  },
})

/** Returns a single soil analysis. */
export const getSoilAnalysis = defineOperation({
  name: "getSoilAnalysis",
  kind: "read",
  bucket: "general",
  input: SoilAnalysisParamsSchema,
  output: SoilAnalysisSchema,
  run: async ({ fdm, services, principal }: OperationContext<SoilAnalysisServices>, { a_id }) => {
    const analysis = await services.getSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)
    if (!analysis?.a_id) {
      throw new ApiError(404, "not-found", `Soil analysis '${a_id}' not found.`)
    }
    return serialiseSoilAnalysis(analysis)
  },
})

/** Changes the supplied fields of a soil analysis and keeps the others. */
export const updateSoilAnalysis = defineOperation({
  name: "updateSoilAnalysis",
  kind: "update",
  bucket: "write",
  input: SoilAnalysisParamsSchema.extend(UpdateSoilAnalysisBodySchema.shape),
  output: SoilAnalysisSchema,
  run: async (
    { fdm, services, principal }: OperationContext<SoilAnalysisServices>,
    { a_id, ...body },
  ) => {
    assertSamplingGeometries(body)
    const definedFields = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    )
    if (Object.keys(definedFields).length === 0) {
      throw new ApiError(400, "validation-failed", "At least one field must be provided.")
    }
    const { a_date, a_source, ...measurementData } = definedFields
    const soilAnalysisData: Record<string, unknown> = { ...measurementData }
    if (a_date !== undefined) soilAnalysisData.a_date = new Date(a_date as string)
    if (a_source !== undefined) soilAnalysisData.a_source = a_source
    await services.updateSoilAnalysis(
      fdm,
      principal.effectivePrincipalId,
      a_id,
      soilAnalysisData as Parameters<typeof core.updateSoilAnalysis>[3],
    )
    const analysis = await services.getSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)
    if (!analysis?.a_id) {
      throw new ApiError(404, "not-found", `Soil analysis '${a_id}' not found.`)
    }
    return serialiseSoilAnalysis(analysis)
  },
})

/**
 * Permanently deletes a soil analysis, and the stored files of its lab report and soil sampling
 * photos. A file that cannot be deleted from storage is only logged.
 */
export const deleteSoilAnalysis = defineOperation({
  name: "deleteSoilAnalysis",
  kind: "delete",
  bucket: "write",
  input: SoilAnalysisParamsSchema,
  output: DeletedSchema,
  run: async ({ fdm, services, principal }: OperationContext<SoilAnalysisServices>, { a_id }) => {
    // Collect the files of the analysis (lab report and BCS photos) before it is removed.
    const analysis = await services.getSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)
    const files: string[] = []
    const reportPath = (analysis as { a_file_path?: string | null } | undefined)?.a_file_path
    if (reportPath) files.push(reportPath)
    if (analysis?.b_id_sampling) {
      const images = await services.getSoilImages(
        fdm,
        principal.effectivePrincipalId,
        analysis.b_id_sampling,
      )
      files.push(...images.map((image) => image.a_image_path))
    }

    await services.removeSoilAnalysis(fdm, principal.effectivePrincipalId, a_id)

    // The analysis is removed; a file that cannot be deleted is only logged.
    const storage = services.getStorage()
    if (storage) {
      await Promise.all(
        files.map((path) =>
          storage.delete(path).catch((err: unknown) => {
            console.warn(`[fdm-api] could not delete ${path} of soil analysis ${a_id}:`, err)
          }),
        ),
      )
    }
    return DELETED
  },
})
