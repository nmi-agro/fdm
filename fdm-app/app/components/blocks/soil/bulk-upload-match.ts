import { booleanPointInPolygon } from "@turf/turf"
import type { ProcessedAnalysis } from "./bulk-upload-review"

type Field = {
    b_id: string
    b_name: string
    geometry: any
}

/**
 * Matches extracted soil analyses to existing farm fields using geometry and name.
 */
export function matchAnalysesToFields(
    analyses: any[],
    fields: Field[],
): ProcessedAnalysis[] {
    return analyses.map((analysis) => {
        let matchedFieldId = ""
        let matchReason: "geometry" | "name" | "both" | undefined

        // Geometry matching
        if (analysis.location?.coordinates) {
            const [lon, lat] = analysis.location.coordinates
            if (typeof lon === "number" && typeof lat === "number") {
                const fieldMatch = fields.find((field) => {
                    if (!field.geometry) return false
                    try {
                        // booleanPointInPolygon handles both Polygon and MultiPolygon
                        return booleanPointInPolygon(
                            analysis.location,
                            field.geometry as any,
                        )
                    } catch (e) {
                        console.warn(
                            `Matching failed for field ${field.b_name}:`,
                            e,
                        )
                        return false
                    }
                })
                if (fieldMatch) {
                    matchedFieldId = fieldMatch.b_id
                    matchReason = "geometry"
                }
            }
        }

        // Fallback: Name matching (b_fieldname vs field name)
        const analysisName = (analysis.b_name || "").toLowerCase().trim()

        if (analysisName) {
            const fieldMatch = fields.find(
                (field) => field.b_name.toLowerCase().trim() === analysisName,
            )

            if (fieldMatch) {
                if (matchedFieldId) {
                    // Check if it's the same field
                    if (matchedFieldId === fieldMatch.b_id) {
                        matchReason = "both"
                    }
                } else {
                    matchedFieldId = fieldMatch.b_id
                    matchReason = "name"
                }
            }
        }

        return {
            ...analysis,
            matchedFieldId,
            matchReason,
        }
    })
}
