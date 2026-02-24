import type { SoilAnalysis } from "@nmi-agro/fdm-core"
import {
    calculateBulkDensity,
    calculateCarbonNitrogenRatio,
    calculateOrganicCarbon,
    calculateOrganicMatter,
} from "../../conversions/soil"
import type { SoilAnalysisPicked as NitrogenSoilAnalysisPicked } from "../nitrogen/types"
import type { SoilAnalysisPicked as OrganicMatterSoilAnalysisPicked } from "../organic-matter/types"

type SoilAnalysisPicked =
    | NitrogenSoilAnalysisPicked
    | OrganicMatterSoilAnalysisPicked

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

export function combineSoilAnalyses<T extends SoilAnalysisPicked>(
    soilAnalyses: Partial<SoilAnalysis>[],
    propertiesToExtract: (keyof T)[],
    estimateMissing = false,
): T {
    // Sort the soil analyses by date (most recent first)
    soilAnalyses.sort((a, b) => {
        if (a.b_sampling_date && b.b_sampling_date) {
            return (
                new Date(b.b_sampling_date).getTime() -
                new Date(a.b_sampling_date).getTime()
            )
        }
        return 0
    })

    const fullSoilAnalysis: Partial<NitrogenSoilAnalysisPicked> = {}

    // Extract all possible estimation properties (preserve 0 values)
    for (const prop of allEstimationProperties) {
        const value = soilAnalyses.find(
            (x: any) => x[prop] !== null && x[prop] !== undefined,
        )?.[prop]
        ;(fullSoilAnalysis as any)[prop] = value ?? null
    }

    if (estimateMissing) {
        // When values for soil parameters are not available try to estimate them with conversion functions
        if (
            fullSoilAnalysis.a_c_of == null &&
            fullSoilAnalysis.a_som_loi != null
        ) {
            fullSoilAnalysis.a_c_of = calculateOrganicCarbon(
                fullSoilAnalysis.a_som_loi,
            )
        }

        if (
            fullSoilAnalysis.a_som_loi == null &&
            fullSoilAnalysis.a_c_of != null
        ) {
            fullSoilAnalysis.a_som_loi = calculateOrganicMatter(
                fullSoilAnalysis.a_c_of,
            )
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
        throw new Error(
            `Missing required soil parameters: ${missingParameters.join(", ")}`,
        )
    }

    return soilAnalysis
}
