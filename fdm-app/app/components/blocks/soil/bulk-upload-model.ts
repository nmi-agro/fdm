/**
 * Model of a bulk upload of soil analysis PDFs: one row per analysis read from a PDF (a PDF can
 * hold the analyses of several fields), plus one row per PDF that could not be read. The status of
 * a row is derived from its values, its field and the other rows, so that the summary, the filters
 * and the save button always agree.
 */
import type { FieldGeometry } from "@nmi-agro/fdm-core"
import type { MultiPoint, MultiPolygon, Point, Polygon } from "geojson"
import { TZDate } from "@date-fns/tz"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"
import { getRangeWarning, ReviewedUploadFormSchema } from "./formschema"
import { REQUIRED_SAMPLING_PARAMETERS } from "./parameter-groups"

/** A field of the farm that an analysis can be linked to. */
export interface BulkField {
  b_id: string
  b_name: string
  b_area: number | null
  b_start: string | Date | null
  b_end: string | Date | null
  geometry: FieldGeometry | null
}

/** A soil analysis that is already stored for a field of the farm. */
export interface ExistingSoilAnalysis {
  b_id: string
  /** Sampling date as `yyyy-MM-dd`. */
  date: string | null
  a_depth_lower: number | null
}

/** How the field of a row was chosen. */
export type MatchReason = "location" | "name" | "location-and-name" | "manual"

/** One analysis of the upload, or one PDF that could not be read. */
export interface BulkRow {
  id: string
  /** Name of the PDF the row comes from; unique within the upload. */
  fileName: string
  kind: "analysis" | "readFailed"
  /** The values of the soil analysis form; dates as ISO strings. */
  values: Record<string, string | number>
  /** Values read from the PDF that are not on the form; saved as read. */
  extra: Record<string, string | number>
  geometries: {
    b_sampling_geometry: MultiPoint | null
    b_sampling_geometry_zone: Polygon | MultiPolygon | null
  }
  /** Sampling location from the report, used to find the field. */
  location: Point | null
  /** Field name as written in the report. */
  reportFieldName: string | null
  fieldId: string | null
  matchReason: MatchReason | null
  /** The field the report name points to, when it differs from the field found by location. */
  nameConflictFieldId: string | null
  /** Whether the user chose to save the row; `null` means the default for its status. */
  include: boolean | null
  /** Set once the row has been saved. */
  saved: { a_id: string; pdfStored: boolean } | null
  /** Why reading or saving failed. */
  error: string | null
}

/** The status of a row, in the order in which rows are shown. */
export type BulkRowStatus = "failed" | "incomplete" | "check" | "ready" | "saved"

/** Something about a row that the user should know or fix. */
export interface BulkRowIssue {
  kind: "missing" | "invalid" | "unmatched" | "duplicate" | "exists" | "range" | "nameConflict"
  message: string
  /** Whether the row cannot be saved until this is fixed. */
  blocking: boolean
}

const FORM_KEYS = new Set(Object.keys(ReviewedUploadFormSchema.shape))

/** Turns a date-like value into `yyyy-MM-dd`, or `null` when it is not a valid date. */
export function toDateKey(value: unknown): string | null {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null
  if (!date || value === "") return null
  if (Number.isNaN(date.getTime())) return null
  // A fixed time zone, so that the server and every browser derive the same key
  const zoned = new TZDate(date.getTime(), "Europe/Amsterdam")
  const year = zoned.getFullYear()
  const month = String(zoned.getMonth() + 1).padStart(2, "0")
  const day = String(zoned.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function isActiveOn(field: BulkField, date: Date | null): boolean {
  if (!date) return true
  const start = field.b_start ? new Date(field.b_start) : null
  const end = field.b_end ? new Date(field.b_end) : null
  return (!start || start <= date) && (!end || end >= date)
}

/** Picks the field that existed on the sampling date, or else the first candidate. */
function preferActive(candidates: BulkField[], date: Date | null): BulkField | undefined {
  return candidates.find((field) => isActiveOn(field, date)) ?? candidates[0]
}

/**
 * Finds the field of an analysis: the field that contains the sampling location, and otherwise the
 * field with the same name as in the report. Fields that existed on the sampling date go first.
 */
export function matchField(
  location: Point | null,
  reportFieldName: string | null,
  samplingDate: Date | null,
  fields: BulkField[],
): Pick<BulkRow, "fieldId" | "matchReason" | "nameConflictFieldId"> {
  let byLocation: BulkField | undefined
  if (location) {
    byLocation = preferActive(
      fields.filter((field) => {
        if (!field.geometry) return false
        try {
          return booleanPointInPolygon(location, field.geometry)
        } catch {
          return false
        }
      }),
      samplingDate,
    )
  }

  const name = reportFieldName?.toLowerCase().trim()
  const byName = name
    ? preferActive(
        fields.filter((field) => field.b_name.toLowerCase().trim() === name),
        samplingDate,
      )
    : undefined

  if (byLocation) {
    const sameField = byName?.b_id === byLocation.b_id
    return {
      fieldId: byLocation.b_id,
      matchReason: sameField ? "location-and-name" : "location",
      nameConflictFieldId: byName && !sameField ? byName.b_id : null,
    }
  }
  if (byName) return { fieldId: byName.b_id, matchReason: "name", nameConflictFieldId: null }
  return { fieldId: null, matchReason: null, nameConflictFieldId: null }
}

/**
 * Creates the rows for the analyses read from one PDF.
 *
 * @param fileName - Name of the PDF.
 * @param analyses - The analyses as returned by the soil analysis reader.
 * @param fields - The fields of the farm, to find the field of each analysis.
 */
export function createRowsFromAnalyses(
  fileName: string,
  analyses: Record<string, unknown>[],
  fields: BulkField[],
): BulkRow[] {
  return analyses.map((analysis) => {
    const values: Record<string, string | number> = {}
    const extra: Record<string, string | number> = {}
    for (const [key, value] of Object.entries(analysis)) {
      if (value === null || value === undefined || value === "") continue
      if (FORM_KEYS.has(key)) {
        if (key === "b_sampling_date") {
          const date =
            value instanceof Date || typeof value === "string" || typeof value === "number"
              ? new Date(value)
              : null
          if (date && !Number.isNaN(date.getTime())) values[key] = date.toISOString()
        } else if (typeof value === "number" || typeof value === "string") {
          values[key] = value
        }
      } else if (
        /^a_[a-z0-9_]+$/.test(key) &&
        key !== "a_id" &&
        key !== "a_file_path" &&
        (typeof value === "number" || typeof value === "string")
      ) {
        extra[key] = value
      }
    }

    const location = (analysis.location as Point | undefined) ?? null
    const reportFieldName = typeof analysis.b_name === "string" ? analysis.b_name : null
    const samplingDate = values.b_sampling_date ? new Date(values.b_sampling_date) : null

    return {
      id: typeof analysis.id === "string" ? analysis.id : crypto.randomUUID(),
      fileName,
      kind: "analysis",
      values,
      extra,
      geometries: {
        b_sampling_geometry: (analysis.b_sampling_geometry as MultiPoint | undefined) ?? null,
        b_sampling_geometry_zone:
          (analysis.b_sampling_geometry_zone as Polygon | MultiPolygon | undefined) ?? null,
      },
      location,
      reportFieldName,
      ...matchField(location, reportFieldName, samplingDate, fields),
      include: null,
      saved: null,
      error: null,
    }
  })
}

/** Creates the row for a PDF that could not be read. */
export function createReadFailedRow(fileName: string, message: string): BulkRow {
  return {
    id: `failed:${fileName}`,
    fileName,
    kind: "readFailed",
    values: {},
    extra: {},
    geometries: { b_sampling_geometry: null, b_sampling_geometry_zone: null },
    location: null,
    reportFieldName: null,
    fieldId: null,
    matchReason: null,
    nameConflictFieldId: null,
    include: false,
    saved: null,
    error: message,
  }
}

/** Context needed to judge a row: the other rows, the fields and the analyses already stored. */
export interface BulkRowContext {
  fieldsById: Map<string, BulkField>
  /** Rows per `field|date|depth` key, for finding doubles within the upload. */
  rowsByKey: Map<string, BulkRow[]>
  existingKeys: Set<string>
  parameterNames: Map<string, string>
}

function duplicateKey(fieldId: string | null, values: BulkRow["values"]): string | null {
  const date = toDateKey(values.b_sampling_date)
  if (!fieldId || !date) return null
  return `${fieldId}|${date}|${values.a_depth_lower ?? ""}`
}

/** Builds the context to judge the rows with {@link getRowIssues}. */
export function createRowContext(
  rows: BulkRow[],
  fields: BulkField[],
  existing: ExistingSoilAnalysis[],
  parameterNames: Map<string, string>,
): BulkRowContext {
  const rowsByKey = new Map<string, BulkRow[]>()
  for (const row of rows) {
    // Analyses of different sampling zones on one field and date are expected, not doubles
    if (row.kind !== "analysis" || row.saved || row.geometries.b_sampling_geometry_zone) continue
    const key = duplicateKey(row.fieldId, row.values)
    if (!key) continue
    rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), row])
  }
  const existingKeys = new Set(
    existing.map((analysis) => `${analysis.b_id}|${analysis.date}|${analysis.a_depth_lower ?? ""}`),
  )
  return {
    fieldsById: new Map(fields.map((field) => [field.b_id, field])),
    rowsByKey,
    existingKeys,
    parameterNames,
  }
}

/** Lists what the user should know or fix about a row. */
export function getRowIssues(row: BulkRow, context: BulkRowContext): BulkRowIssue[] {
  if (row.kind !== "analysis" || row.saved) return []
  const issues: BulkRowIssue[] = []

  const missing = REQUIRED_SAMPLING_PARAMETERS.filter((parameter) => {
    const value = row.values[parameter]
    return (
      value === undefined || value === "" || (parameter === "b_sampling_date" && !toDateKey(value))
    )
  })
  if (missing.length > 0) {
    issues.push({
      kind: "missing",
      message: `${missing.map((parameter) => context.parameterNames.get(parameter) ?? parameter).join(", ")} ontbreekt`,
      blocking: true,
    })
  }

  // The same check as when saving, so that a row marked ready is not rejected by the server
  const parsed = ReviewedUploadFormSchema.safeParse(row.values)
  if (!parsed.success) {
    const invalid = parsed.error.issues.flatMap((issue) => {
      const parameter = String(issue.path[0] ?? "")
      if ((missing as readonly string[]).includes(parameter)) return []
      return [`${context.parameterNames.get(parameter) ?? parameter}: ${issue.message}`]
    })
    if (invalid.length > 0) {
      issues.push({ kind: "invalid", message: invalid.join("; "), blocking: true })
    }
  }

  if (!row.fieldId) {
    issues.push({ kind: "unmatched", message: "Geen perceel gekoppeld", blocking: true })
  } else if (row.nameConflictFieldId && row.matchReason === "location") {
    const nameField = context.fieldsById.get(row.nameConflictFieldId)
    issues.push({
      kind: "nameConflict",
      message: `Volgens de naam in het rapport hoort deze analyse bij ${nameField?.b_name ?? "een ander perceel"}`,
      blocking: false,
    })
  }

  const key = row.geometries.b_sampling_geometry_zone ? null : duplicateKey(row.fieldId, row.values)
  if (key) {
    const others = (context.rowsByKey.get(key) ?? []).filter((other) => other.id !== row.id)
    if (others.length > 0) {
      issues.push({
        kind: "duplicate",
        message: `Zelfde perceel, datum en diepte als ${others[0].fileName}`,
        blocking: false,
      })
    }
    if (context.existingKeys.has(key)) {
      issues.push({
        kind: "exists",
        message: "Er is al een analyse met deze datum en diepte voor dit perceel",
        blocking: false,
      })
    }
  }

  const unusual = Object.entries(row.values).filter(
    ([parameter, value]) => getRangeWarning(parameter, value) !== undefined,
  )
  if (unusual.length > 0) {
    issues.push({
      kind: "range",
      message: `Ongebruikelijke waarde: ${unusual.map(([parameter]) => context.parameterNames.get(parameter) ?? parameter).join(", ")}`,
      blocking: false,
    })
  }

  return issues
}

/** The status of a row, given its issues. */
export function getRowStatus(row: BulkRow, issues: BulkRowIssue[]): BulkRowStatus {
  if (row.saved) return "saved"
  if (row.kind === "readFailed" || row.error) return "failed"
  if (issues.some((issue) => issue.blocking)) return "incomplete"
  if (issues.length > 0) return "check"
  return "ready"
}

/**
 * Whether a row will be saved. Rows that can be saved are included unless the user leaves them
 * out; analyses that already exist are left out unless the user includes them.
 */
export function isRowIncluded(row: BulkRow, issues: BulkRowIssue[]): boolean {
  if (row.kind !== "analysis" || row.saved) return false
  if (issues.some((issue) => issue.blocking)) return false
  return row.include ?? !issues.some((issue) => issue.kind === "exists")
}
