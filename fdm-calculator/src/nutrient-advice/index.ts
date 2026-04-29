import type { CurrentSoilData } from "@nmi-agro/fdm-core"
import { withCalculationCache } from "@nmi-agro/fdm-core"
import pkg from "../package"
import type {
    NutrientAdvice,
    NutrientAdviceInputs,
    NutrientAdviceResponse,
} from "./types"

// Requests nutrient advice from the NMI API based on provided field and soil data.
//
// @param {NutrientAdviceInputs} inputs - An object containing all necessary inputs for the nutrient advice calculation.
// @param {string} inputs.b_lu_catalogue - The BRP cultivation catalogue identifier (e.g., "nl_2014").
// @param {[number, number]} inputs.b_centroid - The centroid coordinates of the field [longitude, latitude].
// @param {CurrentSoilData} inputs.currentSoilData - Current soil data for the field, used to extract Nmin values and other soil parameters.
// @param {string | undefined} inputs.nmiApiKey - The NMI API key for authentication.
// @returns {Promise<NutrientAdvice>} A promise that resolves to an object containing the nutrient advice for the year.
// @throws {Error} If the NMI API key is not provided or if the request to the NMI API fails.
export async function requestNutrientAdvice({
    b_lu_catalogue,
    b_centroid,
    currentSoilData,
    nmiApiKey,
    b_bufferstrip,
}: NutrientAdviceInputs): Promise<NutrientAdvice> {
    try {
        const brpSegments = b_lu_catalogue.split("_")
        const brpRaw = brpSegments[brpSegments.length - 1]
        const brpCode = Number.parseInt(brpRaw ?? "", 10)

        if (b_bufferstrip || !brpRaw || Number.isNaN(brpCode)) {
            return {
                d_n_req: 0,
                d_n_norm: 0,
                d_n_norm_man: 0,
                d_p_norm: 0,
                d_p_req: 0,
                d_k_req: 0,
                d_c_req: 0,
                d_ca_req: 0,
                d_s_req: 0,
                d_mg_req: 0,
                d_cu_req: 0,
                d_zn_req: 0,
                d_co_req: 0,
                d_mn_req: 0,
                d_mo_req: 0,
                d_na_req: 0,
                d_b_req: 0,
            }
        }

        if (!nmiApiKey) {
            throw new Error("NMI API key not provided")
        }

        let a_nmin_cc_d30: number | undefined
        let a_nmin_cc_d60: number | undefined
        const soilData: Record<string, number | string> = {}
        // Extract Nmin values and other soil parameters from currentSoilData
        for (const item of currentSoilData as CurrentSoilData) {
            // Exclude 'a_nmin_cc' from soilData as it's handled separately
            if (item.parameter === "a_nmin_cc") {
                if ((item.a_depth_lower ?? 0) <= 30) {
                    a_nmin_cc_d30 = item.value as number
                } else if ((item.a_depth_lower ?? 0) <= 60) {
                    a_nmin_cc_d60 = item.value as number
                }
                continue // Skip adding a_nmin_cc to soilData
            }
            if (item.value !== null && item.value !== undefined) {
                soilData[item.parameter] = item.value as string | number
            }
        }

        // Create request body for the NMI API
        const body = {
            a_lon: b_centroid[0],
            a_lat: b_centroid[1],
            b_lu_brp: [brpCode],
            a_nmin_cc_d30: a_nmin_cc_d30,
            a_nmin_cc_d60: a_nmin_cc_d60,
            ...soilData, // Include all other soil data parameters
        }

        // Send request to NMI API
        const responseApi = await fetch(
            "https://api.nmi-agro.nl/bemestingsplan/nutrients",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${nmiApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            },
        )

        if (!responseApi.ok) {
            const errorText = await responseApi.text().catch(() => "")
            throw new Error(
                `Request to NMI API failed with status ${responseApi.status}: ${responseApi.statusText} - ${errorText}`,
            )
        }

        const result: NutrientAdviceResponse = await responseApi.json()
        const response: NutrientAdvice = result.data.year

        return response
    } catch (error) {
        console.error(
            "Error fetching nutrient advice:",
            error instanceof Error
                ? error.message
                : "An unknown error occurred",
        )
        throw error
    }
}

/**
 * Cached version of `requestNutrientAdvice`.
 * This function uses `withCalculationCache` to store and retrieve results,
 * improving performance for repeated calls with the same inputs.
 * The cache key is based on the inputs and the calculator version.
 */
export const getNutrientAdvice = withCalculationCache(
    requestNutrientAdvice,
    "requestNutrientAdvice",
    pkg.calculatorVersion,
    ["nmiApiKey"],
)
