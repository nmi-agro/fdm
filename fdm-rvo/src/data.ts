import { RvoClient } from "@nmi-agro/rvo-connector"
import { RvoFieldSchema, type RvoField } from "./types"
import { z } from "zod"

/**
 * Fetches agricultural fields (bedrijfspercelen) from the RVO webservice for a specific year and farm.
 *
 * This function retrieves the fields in GeoJSON format and validates them against the `RvoFieldSchema`.
 *
 * @param rvoClient - An authenticated instance of `RvoClient` (must have a valid access token).
 * @param year - The calendar year for which to retrieve the fields (e.g., 2024).
 * @param kvkNumber - The Chamber of Commerce (KvK) number of the farm/organization. This acts as the identifier for the data request.
 * @returns A promise that resolves to an array of validated `RvoField` objects.
 * @throws Will throw a ZodError if the response from RVO does not match the expected schema.
 * @throws Will throw an error if the API request fails.
 */
export async function fetchRvoFields(
    rvoClient: RvoClient,
    year: string,
    kvkNumber: string,
): Promise<RvoField[]> {
    // Request fields and mest fields from RVO API concurrently
    // We request the full calendar year period
    const [fieldsRaw, mestFieldsRaw] = await Promise.all([
        rvoClient.opvragenBedrijfspercelen({
            periodBeginDate: `${year}-01-01`,
            periodEndDate: `${year}-12-31`,
            farmId: kvkNumber,
            outputFormat: "geojson",
        }),
        rvoClient.opvragenRegelingspercelenMest({
            periodBeginDate: `${year}-01-01`,
            periodEndDate: `${year}-12-31`,
            farmId: kvkNumber,
            outputFormat: "geojson",
        }).catch(err => {
            // Catching in case this endpoint fails independently so we don't break the main flow.
            console.warn("Failed to fetch RegelingspercelenMest:", err)
            return { features: [] }
        })
    ])

    // The raw response is expected to be a GeoJSON FeatureCollection.
    // We access the 'features' array to iterate over individual fields.
    const features = (fieldsRaw as any).features || []
    const mestFeatures = (mestFieldsRaw as any).features || []

    if (Array.isArray(features)) {
        // Create a lookup for MEST fields by CropFieldID
        const mestLookup = new Map<string, any>()
        if (Array.isArray(mestFeatures)) {
            for (const mf of mestFeatures) {
                if (mf?.properties?.CropFieldID) {
                    mestLookup.set(String(mf.properties.CropFieldID), mf.properties)
                }
            }
        }

        // Merge MEST data into Bedrijfspercelen features
        for (const feature of features) {
            if (feature?.properties?.CropFieldID) {
                const cropFieldId = String(feature.properties.CropFieldID)
                if (mestLookup.has(cropFieldId)) {
                    feature.properties.mestData = mestLookup.get(cropFieldId)
                }
            }
        }

        // Define a schema for an array of fields and parse the data.
        // This ensures runtime type safety and filters out malformed records if configured.
        const RvoFieldsArraySchema = z.array(RvoFieldSchema)
        return RvoFieldsArraySchema.parse(features)
    }

    // Return empty array if the response format is unexpected or contains no features.
    return []
}
