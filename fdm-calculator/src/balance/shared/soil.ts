import type { CurrentSoilData } from "@nmi-agro/fdm-core"
import type { SoilAnalysisPicked as NitrogenSoilAnalysisPicked } from "../nitrogen/types"
import type { SoilAnalysisPicked as OrganicMatterSoilAnalysisPicked } from "../organic-matter/types"
import {
  calculateBulkDensity,
  calculateCarbonNitrogenRatio,
  calculateOrganicCarbon,
  calculateOrganicMatter,
} from "../../conversions/soil"

type SoilAnalysisPicked = NitrogenSoilAnalysisPicked | OrganicMatterSoilAnalysisPicked

// All properties that can be used for estimation
const allEstimationProperties = [
  "a_c_of",
  "a_som_loi",
  "a_cn_fr",
  "a_n_rt",
  "a_density_sa",
  "b_soiltype_agr",
  "b_gwl_class",
] as const

const numericProperties = new Set<string>([
  "a_c_of",
  "a_som_loi",
  "a_cn_fr",
  "a_n_rt",
  "a_density_sa",
])

/**
 * Reads the soil parameters that a balance needs from the current soil data of a field.
 *
 * The current soil data (from `getCurrentSoilData` or `getCurrentSoilDataForFarm` in fdm-core) already
 * holds the current value per soil parameter, so the value of each parameter is taken as is. When
 * `estimateMissing` is `true`, missing values are estimated from the other parameters where possible
 * (organic carbon and organic matter from each other, the C/N ratio from organic carbon and total
 * nitrogen, and the bulk density from organic matter and soil type).
 *
 * @param currentSoilData - The current soil data of the field.
 * @param propertiesToExtract - The soil parameters to return.
 * @param estimateMissing - Whether to estimate missing values from other parameters.
 * @returns An object with a value for each requested soil parameter.
 * @throws {Error} When a requested soil parameter has no value and cannot be estimated.
 */
export function resolveSoilParameters<T extends SoilAnalysisPicked>(
  currentSoilData: CurrentSoilData,
  propertiesToExtract: (keyof T)[],
  estimateMissing = false,
): T {
  const fullSoilAnalysis: Partial<NitrogenSoilAnalysisPicked> = {}

  // Take the current value of each parameter (preserve 0 values)
  for (const prop of allEstimationProperties) {
    const value = currentSoilData.find((x) => x.parameter === prop)?.value
    const expectedType = numericProperties.has(prop) ? "number" : "string"
    ;(fullSoilAnalysis as any)[prop] = typeof value === expectedType ? value : null
  }

  if (estimateMissing) {
    // When values for soil parameters are not available try to estimate them with conversion functions
    if (fullSoilAnalysis.a_c_of == null && fullSoilAnalysis.a_som_loi != null) {
      fullSoilAnalysis.a_c_of = calculateOrganicCarbon(fullSoilAnalysis.a_som_loi)
    }

    if (fullSoilAnalysis.a_som_loi == null && fullSoilAnalysis.a_c_of != null) {
      fullSoilAnalysis.a_som_loi = calculateOrganicMatter(fullSoilAnalysis.a_c_of)
    }

    if (
      fullSoilAnalysis.a_cn_fr == null &&
      fullSoilAnalysis.a_c_of != null &&
      fullSoilAnalysis.a_n_rt != null
    ) {
      fullSoilAnalysis.a_cn_fr = calculateCarbonNitrogenRatio(
        fullSoilAnalysis.a_c_of,
        fullSoilAnalysis.a_n_rt,
      )
    }

    if (
      fullSoilAnalysis.a_density_sa == null &&
      fullSoilAnalysis.a_som_loi != null &&
      fullSoilAnalysis.b_soiltype_agr != null
    ) {
      fullSoilAnalysis.a_density_sa = calculateBulkDensity(
        fullSoilAnalysis.a_som_loi,
        fullSoilAnalysis.b_soiltype_agr,
      )
    }
  }

  const soilAnalysis: T = {} as T
  // Pick only the requested properties
  for (const prop of propertiesToExtract) {
    ;(soilAnalysis as any)[prop] = (fullSoilAnalysis as any)[prop]
  }

  // Validate if all required soil parameters are present
  const missingParameters = propertiesToExtract.filter((param) => {
    const value = (soilAnalysis as any)[param]
    return value === null || value === undefined
  })

  if (missingParameters.length > 0) {
    throw new Error(`Missing required soil parameters: ${missingParameters.join(", ")}`)
  }

  return soilAnalysis
}
