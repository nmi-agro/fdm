import { booleanPointInPolygon, point } from "@turf/turf"
import type { Feature, GeoJsonProperties, Geometry } from "geojson"
import { deserializeFgb } from "~/components/blocks/atlas/atlas-fgb"
import { getAvailableFieldsUrl } from "~/components/blocks/atlas/atlas-url"

export async function getFieldByCentroid(
    longitude: number,
    latitude: number,
    calendar: string,
): Promise<Feature<Geometry, GeoJsonProperties> | null> {
    // Create a small bounding box around the centroid to query the FGB file
    const buffer = 0.00001 // A very small buffer to ensure the point is within the bbox
    const bbox = {
        minX: longitude - buffer,
        maxX: longitude + buffer,
        minY: latitude - buffer,
        maxY: latitude + buffer,
    }

    try {
        const availableFieldsUrl = getAvailableFieldsUrl(calendar)

        const pt = point([longitude, latitude])
        const iter = deserializeFgb(availableFieldsUrl, bbox)
        for await (const feature of iter) {
            // Verify the centroid is actually inside the polygon
            if (feature.geometry && booleanPointInPolygon(pt, feature as any)) {
                return feature
            }
        }
    } catch (error) {
        console.error("Failed to query FGB data by centroid: ", error)
    }
    return null
}
