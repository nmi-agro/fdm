import area from "@turf/area"
import bbox from "@turf/bbox"
import { feature, featureCollection } from "@turf/helpers"
import intersect from "@turf/intersect"
import union from "@turf/union"
import type { RvoImportReviewItem } from "./types"

/**
 * Generates a stable unique identifier for a review item.
 *
 * Priority:
 * 1. Local field DB id (`b_id`) — always present when `localField` exists.
 * 2. RVO crop field id (`CropFieldID`) — always present when `rvoField` exists.
 * 3. Deterministic composite from `status`, `CropFieldVersion`, and `BeginDate`
 *    — used only in the degenerate case where neither field is set.
 *
 * The returned value is stable across renders for the same item, making it
 * safe to use as a React key and for `UserChoiceMap` identity comparisons.
 *
 * @param item - The review item to generate an ID for.
 * @returns A unique string identifier for the item.
 */
export function getItemId(item: RvoImportReviewItem<any>): string {
    if (item.localField?.b_id) return item.localField.b_id
    if (item.rvoField?.properties.CropFieldID)
        return item.rvoField.properties.CropFieldID

    // Degenerate fallback: build a deterministic composite from whatever
    // stable data is available so multiple items don't collapse to the same key.
    return [
        item.status,
        item.rvoField?.properties.CropFieldVersion,
        item.rvoField?.properties.BeginDate,
        item.localField ? "local" : "remote",
    ]
        .filter(Boolean)
        .join(":")
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
