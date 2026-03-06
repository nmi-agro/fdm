import bbox from "@turf/bbox"
import intersect from "@turf/intersect"
import union from "@turf/union"
import area from "@turf/area"
import { feature, featureCollection } from "@turf/helpers"
import type {
    Field,
    Cultivation,
    CultivationCatalogue,
} from "@nmi-agro/fdm-core"
import {
    type RvoField,
    RvoImportReviewStatus,
    type RvoImportReviewItem,
    type FieldDiff,
} from "./types"

// Threshold for IoU (Intersection over Union) to consider fields "the same" spatially.
// A value of 0.99 means the intersection area must be at least 99% of the union area.
const IOU_THRESHOLD = 0.99

/**
 * Calculates Intersection over Union (IoU) for two geometries.
 *
 * IoU is a standard metric for measuring the overlap between two shapes.
 * Formula: Area(Intersection) / Area(Union)
 *
 * @param geom1 - The first geometry (GeoJSON).
 * @param geom2 - The second geometry (GeoJSON).
 * @returns A number between 0 (no overlap) and 1 (perfect match). Returns 0 on error.
 */
function calculateIoU(geom1: any, geom2: any): number {
    try {
        // Cast to Polygon or MultiPolygon because Turf expects specific geometry types for intersect/union
        const f1 = feature(geom1)
        const f2 = feature(geom2)

        // Turf v7 intersect takes a FeatureCollection of polygons to intersect
        const intResult = intersect(featureCollection([f1, f2]))
        if (!intResult) return 0

        // Union also takes a FeatureCollection
        const unionResult = union(featureCollection([f1, f2]))
        if (!unionResult) return 0

        const areaInt = area(intResult)
        const areaUnion = area(unionResult)

        if (areaUnion === 0) return 0
        return areaInt / areaUnion
    } catch (e) {
        console.error("Error calculating IoU", e)
        return 0
    }
}

/**
 * Checks if two bounding boxes overlap.
 *
 * Used as a fast pre-filter before calculating expensive IoU operations.
 *
 * @param bbox1 - [minX, minY, maxX, maxY]
 * @param bbox2 - [minX, minY, maxX, maxY]
 * @returns True if boxes overlap, false otherwise.
 */
function bboxOverlap(bbox1: number[], bbox2: number[]): boolean {
    return !(
        (
            bbox1[2] < bbox2[0] || // left
            bbox1[0] > bbox2[2] || // right
            bbox1[3] < bbox2[1] || // bottom
            bbox1[1] > bbox2[3]
        ) // top
    )
}

function findActiveCultivation(
    cultivations: Cultivation[],
    calendar: number,
): Cultivation | undefined {
    const referenceDate = new Date(`${calendar}-05-15`).getTime()
    return cultivations.find((c) => {
        if (!c.b_lu_start) return false
        const start = c.b_lu_start.getTime()
        const end = c.b_lu_end ? c.b_lu_end.getTime() : Number.POSITIVE_INFINITY
        return start <= referenceDate && end >= referenceDate
    })
}

/**
 * Compares a list of local fields against a list of RVO fields to determine their import status.
 *
 * The matching strategy operates in two tiers:
 * 1. **Tier 1: ID Match**: Checks if `localField.b_id_source` matches `rvoField.CropFieldID`.
 *    This is the most reliable method for fields that have been synced before.
 * 2. **Tier 2: Spatial Match**: For fields unmatched by ID, it calculates the spatial overlap (IoU).
 *    If the overlap exceeds `IOU_THRESHOLD` (0.9), they are considered the same field.
 *
 * @param localFields - Array of fields currently in the local database.
 * @param rvoFields - Array of fields retrieved from the RVO webservice.
 * @returns An array of `RvoImportReviewItem` objects, each representing a field and its status (MATCH, CONFLICT, NEW_REMOTE, NEW_LOCAL).
 */
export function compareFields(
    localFields: (Field & { cultivations?: Cultivation[] })[],
    rvoFields: RvoField[],
    calendar = new Date().getFullYear(),
    cultivationsCatalogue: CultivationCatalogue[] = [],
): RvoImportReviewItem<Field>[] {
    const results: RvoImportReviewItem<Field>[] = []
    const matchedRvoIds = new Set<string>()
    const matchedLocalIds = new Set<string>()

    const processMatch = (
        local: Field & { cultivations?: Cultivation[] },
        rvo: RvoField,
    ) => {
        // Detect property differences
        const diffs = detectDiffs(local, rvo)

        // Check for cultivation differences
        const localCultivation = local.cultivations
            ? findActiveCultivation(local.cultivations, calendar)
            : undefined
        const rvoCode = rvo.properties.CropTypeCode
            ? `nl_${rvo.properties.CropTypeCode}`
            : undefined

        let rvoCultivationInfo:
            | { b_lu_catalogue: string; b_lu_name: string }
            | undefined
        let localCultivationInfo:
            | {
                  b_lu_catalogue: string
                  b_lu: string
                  b_lu_name: string
              }
            | undefined

        if (localCultivation) {
            localCultivationInfo = {
                b_lu_catalogue: localCultivation.b_lu_catalogue,
                b_lu: localCultivation.b_lu,
                b_lu_name: localCultivation.b_lu_name,
            }
        }

        if (rvoCode) {
            const rvoCatalogueEntry = cultivationsCatalogue.find(
                (c) => c.b_lu_catalogue === rvoCode,
            )
            rvoCultivationInfo = {
                b_lu_catalogue: rvoCode,
                b_lu_name: rvoCatalogueEntry
                    ? rvoCatalogueEntry.b_lu_name
                    : rvoCode,
            }
        }

        // If local has active cultivation and it differs from RVO, flag it
        if (localCultivation && localCultivation.b_lu_catalogue !== rvoCode) {
            diffs.push("b_lu_catalogue")
        }

        return {
            status:
                diffs.length > 0
                    ? RvoImportReviewStatus.CONFLICT
                    : RvoImportReviewStatus.MATCH,
            localField: local,
            rvoField: rvo,
            localCultivation: localCultivationInfo,
            rvoCultivation: rvoCultivationInfo,
            diffs,
        }
    }

    // ---------------------------------------------------------
    // Tier 1: Match by Source ID (CropFieldID)
    // ---------------------------------------------------------
    for (const local of localFields) {
        if (local.b_id_source) {
            const rvoMatch = rvoFields.find(
                (r) => r.properties.CropFieldID === local.b_id_source,
            )
            if (rvoMatch) {
                matchedLocalIds.add(local.b_id)
                matchedRvoIds.add(rvoMatch.properties.CropFieldID)
                results.push(processMatch(local, rvoMatch))
            }
        }
    }

    // ---------------------------------------------------------
    // Tier 2: Spatial Match (IoU) for remaining fields
    // ---------------------------------------------------------

    // Prepare candidates: Only local fields that haven't been matched yet
    const remainingLocals = localFields
        .filter((f) => !matchedLocalIds.has(f.b_id))
        .map((f) => ({
            field: f,
            // Pre-calculate BBox for performance (avoid recalc inside loop)
            bbox: bbox(f.b_geometry as any),
        }))

    for (const rvo of rvoFields) {
        // Skip if this RVO field was already matched in Tier 1
        if (matchedRvoIds.has(rvo.properties.CropFieldID)) continue

        const rvoBbox = bbox(rvo.geometry)
        let bestMatch: (Field & { cultivations?: Cultivation[] }) | null = null
        let bestIoU = 0

        // Optimization: Fast BBox overlap check before accurate IoU
        const candidates = remainingLocals.filter((l) =>
            bboxOverlap(l.bbox, rvoBbox),
        )

        // Find the best spatial match among candidates
        for (const candidate of candidates) {
            const iou = calculateIoU(candidate.field.b_geometry, rvo.geometry)
            if (iou > bestIoU) {
                bestIoU = iou
                bestMatch = candidate.field
            }
        }

        // If the best match exceeds our threshold, link them
        if (bestMatch && bestIoU > IOU_THRESHOLD) {
            matchedRvoIds.add(rvo.properties.CropFieldID)
            matchedLocalIds.add(bestMatch.b_id)
            results.push(processMatch(bestMatch, rvo))
        } else {
            // No match found -> This is a NEW field from RVO
            const rvoCode = `nl_${rvo.properties.CropTypeCode}`
            const rvoCatalogueEntry = cultivationsCatalogue.find(
                (c) => c.b_lu_catalogue === rvoCode,
            )
            results.push({
                status: RvoImportReviewStatus.NEW_REMOTE,
                rvoField: rvo,
                rvoCultivation: {
                    b_lu_catalogue: rvoCode,
                    b_lu_name: rvoCatalogueEntry
                        ? rvoCatalogueEntry.b_lu_name
                        : rvoCode,
                },
                diffs: [],
            })
        }
    }

    // ---------------------------------------------------------
    // Identify orphaned local fields
    // ---------------------------------------------------------
    for (const local of localFields) {
        if (!matchedLocalIds.has(local.b_id)) {
            const localCultivation = local.cultivations
                ? findActiveCultivation(local.cultivations, calendar)
                : undefined

            // Check if this field should be considered "expired" (closed) instead of just new local
            // Conditions:
            // 1. Started before the current import year
            // 2. Currently open (no end date) or ends in/after this year (though if it ends in this year, it might be a match? No, if it was unmatched, it means RVO doesn't have it)
            //    Actually, if it ends *after* the start of this year, it's considered "active" in this year.
            //    If RVO doesn't have it, we should close it effectively ending it before this year starts.
            const localStart =
                local.b_start instanceof Date
                    ? local.b_start
                    : local.b_start
                      ? new Date(local.b_start)
                      : new Date(0)
            const importYearStart = new Date(calendar, 0, 1) // Jan 1st of import year
            const isStartedBeforeYear = localStart < importYearStart

            const localEnd = local.b_end
                ? local.b_end instanceof Date
                    ? local.b_end
                    : new Date(local.b_end)
                : null
            // If it has no end date, OR the end date is after the start of the import year
            const isOpenOrEndsInYear = !localEnd || localEnd >= importYearStart

            // If the field ended before the import year, it's a historical field that is already closed.
            // We should ignore it.
            if (!isOpenOrEndsInYear) {
                continue
            }

            const status =
                isStartedBeforeYear && isOpenOrEndsInYear
                    ? RvoImportReviewStatus.EXPIRED_LOCAL
                    : RvoImportReviewStatus.NEW_LOCAL

            results.push({
                status,
                localField: local,
                localCultivation: localCultivation
                    ? {
                          b_lu_catalogue: localCultivation.b_lu_catalogue,
                          b_lu: localCultivation.b_lu,
                          b_lu_name: localCultivation.b_lu_name,
                      }
                    : undefined,
                diffs: [],
            })
        }
    }

    return results
}

/**
 * Detects specific property differences between a matched pair of Local and RVO fields.
 *
 * Compares:
 * - Name (`b_name` vs `CropFieldDesignator`)
 * - Geometry (via IoU < 0.99)
 * - Start Date (`b_start` vs `BeginDate`)
 * - End Date (`b_end` vs `EndDate`)
 *
 * @param local - The local field object.
 * @param rvo - The RVO field object.
 * @returns An array of property names (`FieldDiff`) that differ.
 */
function detectDiffs(local: Field, rvo: RvoField): FieldDiff[] {
    const diffs: FieldDiff[] = []

    // 1. Name
    // We check if RVO has a name (designator) and if it differs from local
    if (
        local.b_name !== rvo.properties.CropFieldDesignator &&
        rvo.properties.CropFieldDesignator
    ) {
        diffs.push("b_name")
    }

    // 2. Geometry
    // We use a very strict IoU (0.99) to detect if the shape has been modified, even slightly.
    // If IoU is less than this threshold, we flag it as a geometry difference.
    // We don't require 1.0 because of potential minor floating point differences in coordinates.
    const iou = calculateIoU(local.b_geometry, rvo.geometry)
    if (iou < IOU_THRESHOLD) {
        diffs.push("b_geometry")
    }

    // 3. Dates (Start)
    const localStart =
        local.b_start instanceof Date
            ? local.b_start.toISOString().split("T")[0]
            : local.b_start
    const rvoStart = rvo.properties.BeginDate
        ? new Date(rvo.properties.BeginDate).toISOString().split("T")[0]
        : null

    if (localStart !== rvoStart) {
        diffs.push("b_start")
    }

    // 4. Dates (End)
    const localEnd =
        local.b_end instanceof Date
            ? local.b_end.toISOString().split("T")[0]
            : null
    const rvoEnd = rvo.properties.EndDate
        ? new Date(rvo.properties.EndDate).toISOString().split("T")[0]
        : null

    // Treat null/undefined as equal if both are missing
    if (localEnd !== rvoEnd && (localEnd !== null || rvoEnd !== null)) {
        diffs.push("b_end")
    }

    return diffs
}
