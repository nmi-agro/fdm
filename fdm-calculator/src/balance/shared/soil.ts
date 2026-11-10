import type { CurrentSoilData, SoilAnalysis } from "@nmi-agro/fdm-core"
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

/**
 * The soil analysis record that `currentSoilDataToSoilAnalyses` builds from the current soil data.
 *
 * It holds every soil parameter that the nitrogen and organic matter balances use, so it fits the
 * `soilAnalyses` input of both balances.
 */
export type BalanceSoilAnalysis = Pick<
  SoilAnalysis,
  | "a_id"
  | "b_sampling_date"
  | "a_c_of"
  | "a_cn_fr"
  | "a_density_sa"
  | "a_n_rt"
  | "a_som_loi"
  | "b_soiltype_agr"
  | "b_gwl_class"
>

/**
 * Converts the current soil data of a field into the `soilAnalyses` input of the balances.
 *
 * The current soil data (from `getCurrentSoilData` or `getCurrentSoilDataForFarm` in fdm-core) holds
 * the most recent value per soil parameter, so a parameter can come from an older analysis when a
 * newer analysis does not contain it. This function puts those values into a single record.
 * `a_id` and `b_sampling_date` are taken from the newest analysis that contributes to one of
 * these parameters.
 *
 * @param currentSoilData - The current soil data of a field.
 * @returns An array with one record, or an empty array when none of the parameters has a value.
 * @example
 * ```ts
 * const soilAnalyses = currentSoilDataToSoilAnalyses(
 *   await getCurrentSoilData(fdm, principal_id, b_id, timeframe),
 * )
 * ```
 */
export function currentSoilDataToSoilAnalyses(
  currentSoilData: CurrentSoilData,
): BalanceSoilAnalysis[] {
  const record: Record<string, unknown> = {}
  let newestSource: CurrentSoilData[number]["sources"][number] | undefined

  for (const prop of allEstimationProperties) {
    const item = currentSoilData.find(
      (x) => x.parameter === prop && x.value !== null && x.value !== undefined,
    )
    record[prop] = item?.value ?? null

    const source = item?.sources[0]
    if (
      source &&
      (!newestSource ||
        (source.b_sampling_date?.getTime() ?? Number.NEGATIVE_INFINITY) >
          (newestSource.b_sampling_date?.getTime() ?? Number.NEGATIVE_INFINITY))
    ) {
      newestSource = source
    }
  }

  if (!newestSource) return []

  return [
    {
      ...record,
      a_id: newestSource.a_id,
      b_sampling_date: newestSource.b_sampling_date,
    } as BalanceSoilAnalysis,
  ]
}

export function combineSoilAnalyses<T extends SoilAnalysisPicked>(
  soilAnalyses: Partial<SoilAnalysis>[],
  propertiesToExtract: (keyof T)[],
  estimateMissing = false,
): T {
  // Sort the soil analyses by date (most recent first)
  soilAnalyses.sort((a, b) => {
    if (a.b_sampling_date && b.b_sampling_date) {
      return new Date(b.b_sampling_date).getTime() - new Date(a.b_sampling_date).getTime()
    }
    return 0
  })

  const fullSoilAnalysis: Partial<NitrogenSoilAnalysisPicked> = {}

  // Extract all possible estimation properties (preserve 0 values)
  for (const prop of allEstimationProperties) {
    const value = soilAnalyses.find((x: any) => x[prop] !== null && x[prop] !== undefined)?.[prop]
    ;(fullSoilAnalysis as any)[prop] = value ?? null
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
