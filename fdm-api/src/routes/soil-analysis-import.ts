import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { ExtractedSoilAnalysis, extractSoilAnalysesFromPdfs } from "@nmi-agro/fdm-calculator"
import type { addSoilAnalysis, FdmType, getFields } from "@nmi-agro/fdm-core"
import type { FileStorage } from "@nmi-agro/fdm-storage"
import { createRoute, z } from "@hono/zod-openapi"
import { matchSoilAnalysisToField } from "@nmi-agro/fdm-calculator"
import { InvalidUploadError, readAndValidateFileUpload } from "@nmi-agro/fdm-storage"
import { randomUUID } from "node:crypto"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import {
  type SoilParameterCode,
  FarmIdSchema,
  FieldIdSchema,
  SoilAnalysisIdSchema,
  soilParameterDescriptions,
  soilParameterShape,
} from "../fields"
import { rateLimitMiddleware } from "../rate-limit"
import {
  DateStringSchema,
  GeoJsonMultiPointSchema,
  problemResponseDefinition,
  SamplingZoneGeometrySchema,
  serializeDate,
  uploadErrorResponses,
} from "../schemas"
import { requireStorage } from "../storage"
import { assertSamplingGeometries, CreateSoilAnalysisBodySchema } from "./soil-analyses"

/** Defines the functions required by the lab report import routes. */
export interface SoilAnalysisImportServices {
  getFields: typeof getFields
  addSoilAnalysis: typeof addSoilAnalysis
  extractSoilAnalysesFromPdfs: typeof extractSoilAnalysesFromPdfs
  getNmiApiKey: () => string | undefined
  getStorage: () => FileStorage | undefined
}

const MAX_PDF_BYTES = 5 * 1024 * 1024
const MAX_PDF_FILES = 10

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const pdfFile = z.custom<File>((value) => value instanceof File, {
  message: "files must be PDF files.",
})

const FilesSchema = z
  .union([pdfFile, z.array(pdfFile).min(1).max(MAX_PDF_FILES)])
  .openapi({ type: "array", items: { type: "string", format: "binary" } })
  .describe(
    "One to ten lab reports as PDF, at most 5 MB each. Send each file as a `files` field; their order gives the `file_index`.",
  )

// The multipart bodies are inline schemas with an `encoding`, so documentation tools show
// `analyses` as a text field and `files` as file fields.
const CompareBodySchema = z.object({ files: FilesSchema })

const ImportAnalysisSchema = CreateSoilAnalysisBodySchema.extend({
  file_index: z
    .number()
    .int()
    .min(0)
    .max(MAX_PDF_FILES - 1)
    .describe("Position (0-based) of the lab report of this analysis in the `files` fields."),
  b_id: FieldIdSchema.describe("Field of the farm to save the analysis for."),
}).openapi("SoilAnalysisImportAnalysis")

const AnalysesFieldSchema = z
  .union([z.string(), z.array(z.string())])
  .openapi({ type: "string" })
  .describe(
    "The analyses to save, as JSON: one `analyses` field with an array, or one `analyses` field per analysis with an object. Each analysis has its `file_index`, the `b_id` of its field, an `a_date` and the values of a new soil analysis (the same fields as CreateSoilAnalysis). An item from the compare step can be sent back with `b_id` and `a_date` added; its other keys are ignored. Several analyses can come from one report.",
  )

const ApplyBodySchema = z.object({
  files: FilesSchema,
  analyses: AnalysesFieldSchema,
})

const multipartEncoding = {
  files: { contentType: "application/pdf" },
  analyses: { contentType: "application/json" },
}

const CompareItemSchema = z
  .object({
    item_id: z
      .string()
      .describe("Identifier of the analysis in this upload: `{file_index}.{index in the report}`."),
    file_index: z
      .number()
      .int()
      .describe("Position (0-based) of the report in the `files` fields."),
    filename: z.string().describe("File name of the report."),
    suggested_b_id: FieldIdSchema.nullable().describe(
      "Field of the farm the analysis belongs to: the field that contains the sampling location, or else the field with the name on the report. `null` when no field was found.",
    ),
    match_reason: z
      .enum(["location", "name", "location-and-name"])
      .nullable()
      .describe("How `suggested_b_id` was found. `null` when no field was found."),
    name_conflict_b_id: FieldIdSchema.nullable().describe(
      "Field with the name on the report, when it differs from the field found by location. Check which one is right.",
    ),
    b_name: z
      .string()
      .nullable()
      .describe("Name of the field on the report. `null` when not found."),
    a_source: z
      .string()
      .nullable()
      .describe("Laboratory that made the analysis. `null` when it could not be read."),
    b_sampling_date: DateStringSchema.nullable().describe(
      "Date of sampling in YYYY-MM-DD format. `null` when it could not be read.",
    ),
    a_depth_upper: z
      .number()
      .nullable()
      .describe("Upper boundary of the sampled soil layer (cm). `null` when it could not be read."),
    a_depth_lower: z
      .number()
      .nullable()
      .describe("Lower boundary of the sampled soil layer (cm). `null` when it could not be read."),
    ...soilParameterShape("nullable"),
    b_sampling_geometry: GeoJsonMultiPointSchema.nullable(),
    b_sampling_geometry_zone: SamplingZoneGeometrySchema.nullable(),
  })
  .openapi("SoilAnalysisImportItem")

const CompareResultSchema = z
  .object({
    b_id_farm: FarmIdSchema.describe("Unique identifier of the farm."),
    items: z
      .array(CompareItemSchema)
      .describe(
        "The soil analyses read from the reports. One report can contain several analyses.",
      ),
  })
  .openapi("SoilAnalysisImportReview")

const ApplyResultSchema = z
  .object({
    created: z
      .array(
        z.object({
          a_id: SoilAnalysisIdSchema.describe("Unique identifier of the new soil analysis."),
          b_id: FieldIdSchema.describe("Field the analysis was saved for."),
          file_index: z
            .number()
            .int()
            .describe("Position of its lab report in the `files` fields."),
        }),
      )
      .describe("The soil analyses that were saved, in the order of `analyses`."),
  })
  .openapi("SoilAnalysisImportResult")

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const compareRoute = createRoute({
  operationId: "compareSoilAnalysisImport",
  method: "post",
  path: "/farms/{b_id_farm}/soil-analyses/import/compare",
  tags: ["Soil Analyses"],
  summary: "Read lab reports and match them to fields",
  description:
    "Step 1 of a lab report import. Reads the soil analyses from lab reports (PDF) with the NMI SoilReader service and finds the field of the farm each analysis belongs to, the same as the upload in the web app. Nothing is saved. Check the values and fields, then send the same files with `POST /farms/{b_id_farm}/soil-analyses/import/apply`. Counts towards the NMI rate limit. Send the body as `multipart/form-data` and let the HTTP client set the `Content-Type` header, which includes the boundary of the parts.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    body: {
      content: {
        "multipart/form-data": {
          schema: CompareBodySchema,
          encoding: { files: multipartEncoding.files },
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "The soil analyses read from the reports.",
      content: { "application/json": { schema: CompareResultSchema } },
    },
    ...uploadErrorResponses,
    502: problemResponseDefinition(
      "Bad gateway — the lab report reading service could not read the reports.",
    ),
    503: problemResponseDefinition(
      "Service unavailable — reading lab reports is not configured on this server.",
    ),
  },
})

const applyRoute = createRoute({
  operationId: "applySoilAnalysisImport",
  method: "post",
  path: "/farms/{b_id_farm}/soil-analyses/import/apply",
  tags: ["Soil Analyses"],
  summary: "Save soil analyses from lab reports",
  description:
    "Step 2 of a lab report import. Send the same files as in the compare step and the analyses to save, each with the field it belongs to and the checked values. The reports are not read again: the values in `analyses` are saved. Each analysis is saved with a copy of its report, all in one transaction. Download a report later with `GET /soil-analyses/{a_id}/document`. Send the body as `multipart/form-data` and let the HTTP client set the `Content-Type` header, which includes the boundary of the parts.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  "x-badges": [{ name: "New", color: "#16a34a" }],
  request: {
    params: z.object({ b_id_farm: FarmIdSchema }),
    body: {
      content: { "multipart/form-data": { schema: ApplyBodySchema, encoding: multipartEncoding } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "The soil analyses that were saved.",
      content: { "application/json": { schema: ApplyResultSchema } },
    },
    ...uploadErrorResponses,
    503: problemResponseDefinition(
      "Service unavailable — file storage is not configured on this server.",
    ),
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the `analyses` field: one JSON array, or one JSON object per field.
 *
 * @throws {ApiError} 400 when a value is not JSON.
 */
function parseAnalysesField(value: string | string[]): unknown[] {
  const values = Array.isArray(value) ? value : [value]
  return values.flatMap((text) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new ApiError(
        400,
        "validation-failed",
        "analyses must be JSON: an array, or an object per analyses field.",
      )
    }
    return Array.isArray(parsed) ? parsed : [parsed]
  })
}

async function readReports(files: File[]): Promise<{ buffer: Buffer; filename: string }[]> {
  const reports: { buffer: Buffer; filename: string }[] = []
  for (const file of files) {
    try {
      const { buffer } = await readAndValidateFileUpload(file, {
        allowedMimes: new Set(["application/pdf"]),
        maxBytes: MAX_PDF_BYTES,
      })
      reports.push({ buffer, filename: file.name || "report.pdf" })
    } catch (err) {
      if (err instanceof InvalidUploadError) {
        throw err.reason === "too-large"
          ? new ApiError(413, "payload-too-large", `'${file.name}' is larger than 5 MB.`)
          : new ApiError(415, "unsupported-media-type", `'${file.name}' is not a PDF file.`)
      }
      throw err
    }
  }
  return reports
}

function serialiseExtracted(analysis: ExtractedSoilAnalysis) {
  const parameters: Record<string, unknown> = {}
  for (const code of Object.keys(soilParameterDescriptions) as SoilParameterCode[]) {
    const value = (analysis as Record<string, unknown>)[code]
    parameters[code] = typeof value === "number" || typeof value === "string" ? value : null
  }
  if (parameters.b_soiltype_agr === null && analysis.b_soil_type) {
    parameters.b_soiltype_agr = analysis.b_soil_type
  }
  return {
    b_name: analysis.b_name ?? null,
    a_source: typeof analysis.a_source === "string" ? analysis.a_source : null,
    b_sampling_date: serializeDate(analysis.b_sampling_date ?? null),
    a_depth_upper: analysis.a_depth_upper ?? null,
    a_depth_lower: analysis.a_depth_lower ?? null,
    ...parameters,
    b_sampling_geometry: analysis.b_sampling_geometry,
    b_sampling_geometry_zone: analysis.b_sampling_geometry_zone,
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Registers the routes to import soil analyses from lab report PDFs, in two steps.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerSoilAnalysisImportRoutes(app, fdm, services)
 * ```
 */
export function registerSoilAnalysisImportRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: SoilAnalysisImportServices,
): void {
  // Compare reads the reports with the NMI API; apply is covered by the /farms/* middleware.
  app.use("/farms/:b_id_farm/soil-analyses/import/compare", (c, next) =>
    rateLimitMiddleware(fdm, "nmi")(c, next),
  )

  const compareHandler: RouteHandler<typeof compareRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const form = c.req.valid("form") as z.infer<typeof CompareBodySchema>
    const files = Array.isArray(form.files) ? form.files : [form.files]
    const nmiApiKey = services.getNmiApiKey()
    if (!nmiApiKey) {
      throw new ApiError(
        503,
        "service-unavailable",
        "Reading lab reports is not configured on this server.",
      )
    }

    // Reading the fields checks read access to the farm before the reports are sent out.
    const fields = await services.getFields(fdm, principal.effectivePrincipalId, b_id_farm)
    const matchFields = fields.map((field) => ({
      b_id: field.b_id,
      b_name: field.b_name,
      b_start: field.b_start ?? null,
      b_end: field.b_end ?? null,
      geometry: field.b_geometry ?? null,
    }))
    const reports = await readReports(files)

    const items = []
    for (const [file_index, report] of reports.entries()) {
      let analyses: ExtractedSoilAnalysis[]
      try {
        analyses = await services.extractSoilAnalysesFromPdfs(
          [{ file: new Blob([new Uint8Array(report.buffer)]), filename: report.filename }],
          nmiApiKey,
        )
      } catch (err) {
        if (err instanceof Error && err.name === "SoilReaderError") {
          throw new ApiError(
            502,
            "bad-gateway",
            `The lab report '${report.filename}' could not be read.`,
          )
        }
        throw err
      }
      for (const [index, analysis] of analyses.entries()) {
        const match = matchSoilAnalysisToField(
          (analysis.location as Parameters<typeof matchSoilAnalysisToField>[0]) ?? null,
          analysis.b_name ?? null,
          analysis.b_sampling_date ?? null,
          matchFields,
        )
        items.push({
          item_id: `${file_index}.${index}`,
          file_index,
          filename: report.filename,
          suggested_b_id: match.b_id,
          match_reason: match.match_reason,
          name_conflict_b_id: match.name_conflict_b_id,
          ...serialiseExtracted(analysis),
        })
      }
    }
    return c.json({ b_id_farm, items } as z.infer<typeof CompareResultSchema>, 200)
  }

  const applyHandler: RouteHandler<typeof applyRoute> = async (c) => {
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const form = c.req.valid("form") as z.infer<typeof ApplyBodySchema>
    const files = Array.isArray(form.files) ? form.files : [form.files]

    const parsed = z.array(ImportAnalysisSchema).min(1).safeParse(parseAnalysesField(form.analyses))
    if (!parsed.success) {
      throw new ApiError(400, "validation-failed", "analyses is not valid.", {
        errors: parsed.error.issues,
      })
    }
    const analyses = parsed.data
    for (const analysis of analyses) assertSamplingGeometries(analysis)
    const outOfRange = analyses.filter((analysis) => analysis.file_index >= files.length)
    if (outOfRange.length > 0) {
      throw new ApiError(422, "unprocessable-entity", "A file_index has no file in `files`.")
    }

    // Every analysis must belong to a field of this farm; reading the fields checks access.
    const fields = await services.getFields(fdm, principal.effectivePrincipalId, b_id_farm)
    const fieldIds = new Set(fields.map((field) => field.b_id))
    const otherFields = [
      ...new Set(analyses.map((a) => a.b_id).filter((b_id) => !fieldIds.has(b_id))),
    ]
    if (otherFields.length > 0) {
      throw new ApiError(
        422,
        "unprocessable-entity",
        `These fields are not part of the farm: ${otherFields.join(", ")}.`,
      )
    }

    const storage = requireStorage(services.getStorage)
    const reports = await readReports(files)

    // Store a copy of the report per analysis first; remove them again when saving fails.
    const paths = analyses.map(() => `soil_analysis/${randomUUID()}.pdf`)
    const uploaded: string[] = []
    try {
      for (const [index, analysis] of analyses.entries()) {
        const report = reports[analysis.file_index]
        const path = paths[index]
        if (!report || !path) continue
        await storage.upload(path, report.buffer, "application/pdf")
        uploaded.push(path)
      }

      const created = await fdm.transaction(async (tx) => {
        const results: { a_id: string; b_id: string; file_index: number }[] = []
        for (const [index, analysis] of analyses.entries()) {
          const {
            file_index,
            b_id,
            a_date,
            a_source,
            a_depth_lower,
            b_sampling_date,
            a_depth_upper,
            ...soilAnalysisData
          } = analysis
          const a_id = await services.addSoilAnalysis(
            tx,
            principal.effectivePrincipalId,
            new Date(a_date),
            a_source,
            b_id,
            a_depth_lower,
            b_sampling_date ? new Date(b_sampling_date) : null,
            { ...soilAnalysisData, a_file_path: paths[index] } as Parameters<
              typeof addSoilAnalysis
            >[7],
            a_depth_upper,
          )
          results.push({ a_id, b_id, file_index })
        }
        return results
      })
      return c.json({ created }, 201)
    } catch (err) {
      await Promise.all(uploaded.map((path) => storage.delete(path).catch(() => {})))
      throw err
    }
  }

  app.openapi(compareRoute, compareHandler)
  app.openapi(applyRoute, applyHandler)
}
