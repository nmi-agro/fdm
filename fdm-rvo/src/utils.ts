import bbox from "@turf/bbox"
import intersect from "@turf/intersect"
import union from "@turf/union"
import area from "@turf/area"
import { feature, featureCollection } from "@turf/helpers"
import type { RvoImportReviewItem } from "./types"

/**
 * Generates a stable unique identifier for a review item.
 *
 * This ID is used to key items in the UI (e.g., for React lists) and to map user choices.
 * It prioritizes the local field ID (`b_id`), falling back to the RVO field ID (`CropFieldID`)
 * if the item represents a new remote field.
 *
 * @param item - The review item to generate an ID for.
 * @returns A unique string identifier for the item.
 */
export function getItemId(item: RvoImportReviewItem<any>): string {
    return (
        item.localField?.b_id ||
        item.rvoField?.properties.CropFieldID ||
        "unknown"
    )
}

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
export function calculateIoU(geom1: any, geom2: any): number {
    try {
        const f1 = feature(geom1)
        const f2 = feature(geom2)

        const intResult = intersect(featureCollection([f1, f2]))
        if (!intResult) return 0

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
export function bboxOverlap(bbox1: number[], bbox2: number[]): boolean {
    return !(
        bbox1[2] < bbox2[0] ||
        bbox1[0] > bbox2[2] ||
        bbox1[3] < bbox2[1] ||
        bbox1[1] > bbox2[3]
    )
}

/**
 * Pre-computes the bounding box of a GeoJSON geometry.
 *
 * @param geometry - The GeoJSON geometry.
 * @returns The bounding box as [minX, minY, maxX, maxY].
 */
export function computeBbox(geometry: any): number[] {
    return bbox(geometry)
}
