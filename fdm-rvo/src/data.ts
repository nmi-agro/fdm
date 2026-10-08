import type { RvoClient } from "@nmi-agro/rvo-connector"
import bbox from "@turf/bbox"
import { z } from "zod"
import { type RvoField, RvoFieldSchema } from "./types"
import { bboxOverlap, calculateIoU } from "./utils"

// Minimum IoU to consider a MEST feature as matching a bedrijfsperceel.
// Set high (0.95) because both datasets represent the same physical parcel in RVO —
// geometries should be essentially identical, with only minor coordinate precision
// differences between the two RVO registration systems.
const MEST_IOU_THRESHOLD = 0.95

/**
 * Fetches agricultural fields (bedrijfspercelen) from the RVO webservice for a specific year and farm.
 *
 * This function retrieves the fields in GeoJSON format and validates them against the `RvoFieldSchema`.
 *
 * Whose fields are returned depends on `kvkNumber`:
 *
 * - **Own farm**: when a farmer logs in with the eHerkenning of their own company, omit
 *   `kvkNumber`. RVO derives the farm from the authenticated identity. Sending the farm's own
 *   KvK number in this case makes RVO reject the request with `EDI009` (Toegang geweigerd).
 * - **Machtiging**: when an advisor or intermediary logs in with the eHerkenning of their own
 *   organisation and holds a machtiging at RVO for another farm, pass that farm's KvK number.
 *   It is sent to RVO as `ThirdPartyFarmID`.
 *
 * @param rvoClient - An authenticated instance of `RvoClient` (must have a valid access token).
 * @param year - The calendar year for which to retrieve the fields (e.g., 2024).
 * @param kvkNumber - Optional. The KvK number of the farm to request data for on behalf of
 *   (machtiging). Omit it when requesting the fields of the authenticated company itself.
 * @returns A promise that resolves to an array of validated `RvoField` objects.
 * @throws Will throw a ZodError if the response from RVO does not match the expected schema.
 * @throws Will throw an error if the API request fails. SOAP faults, such as `EDI009`, are
 *   thrown as `RvoSoapFaultError`; see {@link isRvoPermissionDeniedError}.
 */
export async function fetchRvoFields(
  rvoClient: RvoClient,
  year: string,
  kvkNumber?: string,
): Promise<RvoField[]> {
  // Only send ThirdPartyFarmID when requesting data on behalf of another farm
  const farmIdOption = kvkNumber ? { farmId: kvkNumber } : {}

  // Request fields and mest fields from RVO API concurrently
  // We request the full calendar year period
  const [fieldsRaw, mestFieldsRaw] = await Promise.all([
    rvoClient.opvragenBedrijfspercelen({
      periodBeginDate: `${year}-01-01`,
      periodEndDate: `${year}-12-31`,
      ...farmIdOption,
      outputFormat: "geojson",
    }),
    rvoClient
      .opvragenRegelingspercelenMest({
        periodBeginDate: `${year}-01-01`,
        periodEndDate: `${year}-12-31`,
        ...farmIdOption,
        outputFormat: "geojson",
      })
      .catch((err) => {
        // Catching in case this endpoint fails independently so we don't break the main flow.
        console.warn("Failed to fetch RegelingspercelenMest:", err)
        return { features: [] }
      }),
  ])

  // The raw response is expected to be a GeoJSON FeatureCollection.
  // We access the 'features' array to iterate over individual fields.
  const features = (fieldsRaw as any).features || []
  const mestFeatures = (mestFieldsRaw as any).features || []

  if (Array.isArray(features)) {
    // Pre-compute bounding boxes for all MEST features (avoid recalc in inner loops)
    const mestWithBbox = Array.isArray(mestFeatures)
      ? mestFeatures
          .filter((mf: any) => mf?.geometry)
          .map((mf: any) => ({
            feature: mf,
            bbox: bbox(mf.geometry) as number[],
          }))
      : []

    const matchedMestIndices = new Set<number>()

    for (const cropFeature of features) {
      if (!cropFeature?.geometry) continue

      const cropBbox = bbox(cropFeature.geometry) as number[]
      const cropDesignator: string = cropFeature?.properties?.CropFieldDesignator ?? ""

      let mergedMestProps: any = null

      // -------------------------------------------------------
      // Tier 1: FieldDesignator name match + IoU sanity check
      // -------------------------------------------------------
      if (cropDesignator) {
        const nameMatches = mestWithBbox
          .map((m, idx) => ({ ...m, idx }))
          .filter(
            ({ feature: mf, idx }) =>
              !matchedMestIndices.has(idx) && mf?.properties?.Fielddesignator === cropDesignator,
          )

        if (nameMatches.length === 1) {
          // Only match when exactly one MEST feature has the same name.
          // Multiple matches indicate ambiguity; fall through to Tier 2 spatial matching.
          const candidate = nameMatches[0]
          const iou = calculateIoU(cropFeature.geometry, candidate.feature.geometry)
          if (iou >= MEST_IOU_THRESHOLD) {
            mergedMestProps = candidate.feature.properties
            matchedMestIndices.add(candidate.idx)
          }
        }
      }

      // -------------------------------------------------------
      // Tier 2: Spatial IoU join (bbox pre-filter)
      // -------------------------------------------------------
      if (!mergedMestProps) {
        let bestIoU = 0
        let bestIdx = -1

        for (let i = 0; i < mestWithBbox.length; i++) {
          if (matchedMestIndices.has(i)) continue
          const { feature: mf, bbox: mBbox } = mestWithBbox[i]
          if (!bboxOverlap(cropBbox, mBbox)) continue

          const iou = calculateIoU(cropFeature.geometry, mf.geometry)
          if (iou > bestIoU) {
            bestIoU = iou
            bestIdx = i
          }
        }

        if (bestIdx >= 0 && bestIoU >= MEST_IOU_THRESHOLD) {
          mergedMestProps = mestWithBbox[bestIdx].feature.properties
          matchedMestIndices.add(bestIdx)
        }
      }

      if (mergedMestProps) {
        cropFeature.properties.mestData = mergedMestProps
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
