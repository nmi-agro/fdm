import type { SoilParameterEstimatesResponse } from "@nmi-agro/fdm-calculator"
/* eslint-disable typescript/no-redundant-type-constituents -- 'any' is used intentionally inside custom return types to represent raw third-party JSON properties that cannot be typed ahead of time. */
import type { FdmType, FieldGeometry } from "@nmi-agro/fdm-core"
import type { Feature, Geometry } from "geojson"
import {
  type ExtractedSoilAnalysis,
  extractSoilAnalysesFromPdfs,
  getSoilParameterEstimates,
  SoilReaderError,
} from "@nmi-agro/fdm-calculator"
import centroid from "@turf/centroid"
import { serverConfig } from "~/lib/config.server"
import { readAndValidatePdfUpload } from "~/lib/upload-utils.server"

export { parseSamplingGeometry } from "@nmi-agro/fdm-calculator"

export function getNmiApiKey() {
  if (!serverConfig.integrations.nmi) {
    return undefined
  }

  const nmiApiKey = serverConfig.integrations.nmi.api_key
  return nmiApiKey
}

/**
 * Resolves the centroid of a not-yet-persisted field geometry (e.g. a drawn or
 * imported polygon that doesn't have a `b_id` yet) and fetches the cached soil
 * parameter + BRP cultivation-history estimates for it.
 *
 * For persisted fields (with a `b_id`), prefer resolving the centroid via
 * `collectInputForSoilParameterEstimates` (from `@nmi-agro/fdm-calculator`),
 * which reuses the field's DB-computed centroid instead of recomputing it here.
 */
export async function getSoilParameterEstimatesForGeometry(
  fdm: FdmType,
  field: Feature | FieldGeometry,
  nmiApiKey: string | undefined,
): Promise<SoilParameterEstimatesResponse> {
  let geometry: Geometry
  if ("geometry" in field) {
    geometry = field.geometry
  } else {
    geometry = field
  }
  const fieldCentroid = centroid(geometry)
  const a_lon = fieldCentroid.geometry.coordinates[0]
  const a_lat = fieldCentroid.geometry.coordinates[1]

  return getSoilParameterEstimates(fdm, { a_lat, a_lon, nmiApiKey })
}

export async function extractSoilAnalysis(formData: FormData) {
  const { soilAnalysis } = await extractSoilAnalysisAndBuffer(formData)
  return soilAnalysis
}

export async function extractSoilAnalysisAndBuffer(formData: FormData) {
  const nmiApiKey = getNmiApiKey()

  if (!nmiApiKey) {
    throw new Error("NMI API key not configured")
  }

  // Validate that FormData contains a file
  const file = formData.get("soilAnalysisFile") as File
  if (!file || !(file instanceof File)) {
    throw new Error("No file provided in FormData")
  }

  const { buffer } = await readAndValidatePdfUpload(file)

  let analyses: ExtractedSoilAnalysis[]
  try {
    analyses = await extractSoilAnalysesFromPdfs([{ file, filename: file.name }], nmiApiKey)
  } catch (error) {
    if (error instanceof SoilReaderError && error.status !== undefined) {
      throw new Error("Request to NMI API failed")
    }
    throw error
  }

  const soilAnalysis = analyses[0]
  if (!soilAnalysis) {
    throw new Error("Invalid API response: no fields found")
  }
  // Check if soil parameters are returned
  if (!soilAnalysis.a_source) {
    throw new Error("Invalid soil analysis: laboratory source missing")
  }

  return { buffer, soilAnalysis: soilAnalysis as Record<string, any> }
}

export async function extractBulkSoilAnalyses(formData: FormData) {
  const nmiApiKey = getNmiApiKey()

  if (!nmiApiKey) {
    throw new Error("NMI API key not configured")
  }

  // Filter out potential non-File objects or empty slots
  const files = formData.getAll("soilAnalysisFile") as File[]
  const validFiles = files.filter((file) => file instanceof File && file.name)
  if (validFiles.length === 0) {
    throw new Error("Geen geldige bestanden gevonden in FormData")
  }

  for (const file of validFiles) {
    await readAndValidatePdfUpload(file)
  }

  const BATCH_SIZE = 10
  const MAX_BATCH_BYTES = 20 * 1024 * 1024 // 20MB

  // Group files into batches based on count and total size
  let currentBatchFiles: File[] = []
  let currentBatchSize = 0
  const batches: File[][] = []

  for (const file of validFiles) {
    if (
      currentBatchFiles.length >= BATCH_SIZE ||
      (currentBatchFiles.length > 0 && currentBatchSize + file.size > MAX_BATCH_BYTES)
    ) {
      batches.push(currentBatchFiles)
      currentBatchFiles = []
      currentBatchSize = 0
    }
    currentBatchFiles.push(file)
    currentBatchSize += file.size
  }
  if (currentBatchFiles.length > 0) {
    batches.push(currentBatchFiles)
  }

  // Process each batch sequentially to avoid overwhelming the API
  const allAnalyses: ExtractedSoilAnalysis[] = []
  for (let i = 0; i < batches.length; i++) {
    const batchFiles = batches[i]
    try {
      const analyses = await extractSoilAnalysesFromPdfs(
        batchFiles.map((file) => ({ file, filename: file.name })),
        nmiApiKey,
      )
      allAnalyses.push(...analyses)
    } catch (error) {
      if (error instanceof SoilReaderError && error.status === 413) {
        throw new Error(
          `invalid: Groep ${i + 1} van de bestanden is te groot voor de NMI API. Verklein de PDF's of upload ze in nog kleinere groepen.`,
        )
      }
      console.error(`NMI API Error (Batch ${i + 1}/${batches.length}):`, error)
      throw error
    }
  }

  return allAnalyses.map((analysis, index) => ({
    ...analysis,
    id: crypto.randomUUID(), // Used for UI matching
    filename: analysis.filename || `Analyse ${index + 1}`,
  })) as Record<string, any>[]
}
