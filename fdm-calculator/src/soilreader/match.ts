import type { FieldGeometry } from "@nmi-agro/fdm-core"
import type { Point } from "geojson"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"

/** A field that a soil analysis from a lab report can be linked to. */
export interface SoilAnalysisMatchField {
  b_id: string
  b_name: string
  b_start: string | Date | null
  b_end: string | Date | null
  geometry: FieldGeometry | null
}

/** How the field of a soil analysis was found. */
export type SoilAnalysisMatchReason = "location" | "name" | "location-and-name"

/** The field found for a soil analysis from a lab report. */
export interface SoilAnalysisFieldMatch {
  /** The field, or `null` when none was found. */
  b_id: string | null
  /** How the field was found, or `null` when none was found. */
  match_reason: SoilAnalysisMatchReason | null
  /** The field the name on the report points to, when it differs from the field found by location. */
  name_conflict_b_id: string | null
}

function isActiveOn(field: SoilAnalysisMatchField, date: Date | null): boolean {
  if (!date) return true
  const start = field.b_start ? new Date(field.b_start) : null
  const end = field.b_end ? new Date(field.b_end) : null
  return (!start || start <= date) && (!end || end >= date)
}

/** Picks the field that existed on the sampling date, or else the first candidate. */
function preferActive(
  candidates: SoilAnalysisMatchField[],
  date: Date | null,
): SoilAnalysisMatchField | undefined {
  return candidates.find((field) => isActiveOn(field, date)) ?? candidates[0]
}

/**
 * Finds the field of a soil analysis read from a lab report: the field that contains the sampling
 * location, and otherwise the field with the same name as on the report. Fields that existed on the
 * sampling date go first.
 *
 * @param location - Sampling location from the report, or `null`.
 * @param reportFieldName - Field name on the report, or `null`.
 * @param samplingDate - Sampling date, or `null`.
 * @param fields - The fields to choose from.
 * @returns The field found, how it was found, and a field with the report name when that differs.
 */
export function matchSoilAnalysisToField(
  location: Point | null,
  reportFieldName: string | null,
  samplingDate: Date | null,
  fields: SoilAnalysisMatchField[],
): SoilAnalysisFieldMatch {
  let byLocation: SoilAnalysisMatchField | undefined
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
      b_id: byLocation.b_id,
      match_reason: sameField ? "location-and-name" : "location",
      name_conflict_b_id: byName && !sameField ? byName.b_id : null,
    }
  }
  if (byName) return { b_id: byName.b_id, match_reason: "name", name_conflict_b_id: null }
  return { b_id: null, match_reason: null, name_conflict_b_id: null }
}
