/**
 * @packageDocumentation
 * @module mineralization/assessment
 *
 * Soil data completeness assessment for the Mineralisatie module.
 *
 * Before calling the NMI nsupply API, the completeness of available soil data
 * is assessed for the chosen mineralization method. This lets the UI communicate
 * data quality and guide users towards improving their soil data.
 */

import type { DataCompleteness, NSupplyMethod } from "./types"

// ─── Method requirements ──────────────────────────────────────────────────────

/**
 * Defines the required and optional soil parameters for each N supply method.
 *
 * **Required** parameters must be present for the API to compute a result.
 * **Optional** parameters improve the estimate but are estimated by the API
 * when absent.
 *
 * @see {@link NSupplyMethod}
 */
export const methodRequirements: Record<
    NSupplyMethod,
    { required: string[]; optional: string[] }
> = {
    /**
     * MINIP — organic matter decomposition model.
     * Requires organic matter (`a_som_loi`), clay fraction (`a_clay_mi`),
     * and silt fraction (`a_silt_mi`).
     */
    minip: {
        required: ["a_som_loi", "a_clay_mi", "a_silt_mi"],
        optional: ["a_sand_mi", "b_soiltype_agr"],
    },
    /**
     * PMN — Potentially Mineralizable Nitrogen incubation method.
     * Requires measured PMN (`a_n_pmn`) and clay fraction (`a_clay_mi`).
     */
    pmn: {
        required: ["a_n_pmn", "a_clay_mi"],
        optional: ["a_sand_mi", "b_soiltype_agr"],
    },
    /**
     * CENTURY — carbon cycling model.
     * Requires organic carbon (`a_c_of`), C:N ratio (`a_cn_fr`),
     * clay fraction (`a_clay_mi`), and silt fraction (`a_silt_mi`).
     */
    century: {
        required: ["a_c_of", "a_cn_fr", "a_clay_mi", "a_silt_mi"],
        optional: ["a_sand_mi", "b_soiltype_agr"],
    },
}

// ─── Assessment ───────────────────────────────────────────────────────────────

/**
 * Evaluates which soil parameters are available, missing, or will be estimated
 * for the chosen mineralization method, and returns a 0–100 completeness score.
 *
 * **Score calculation:**
 * - Required parameters contribute up to **80 points** (proportional to fraction present).
 * - Optional parameters contribute up to **20 points** (proportional to fraction present).
 * - Parameters measured by NMI (`source === "nl-other-nmi"`) are treated as absent
 *   for scoring purposes, since they represent API estimates rather than field data.
 *
 * @example
 * ```typescript
 * const completeness = assessDataCompleteness(
 *   { a_som_loi: 3.5, a_clay_mi: 12, a_silt_mi: 18, a_sand_mi: 70 },
 *   "minip",
 * )
 * // completeness.score === 100 (all required + all optional present)
 * ```
 *
 * @param soilData - Flat key-value map of soil parameters (from `getCurrentSoilData`).
 *   Keys are FDM parameter names (e.g. `"a_som_loi"`).
 * @param method - The mineralization method determining which parameters are needed.
 * @param soilMeta - Optional metadata per parameter: measurement source identifier
 *   and sampling date. Used to distinguish lab measurements from NMI estimates.
 * @returns A {@link DataCompleteness} object with categorized parameters and score.
 */
export function assessDataCompleteness(
    soilData: Record<string, number | string | null | undefined>,
    method: NSupplyMethod,
    soilMeta?: Record<string, { source?: string; date?: Date }>,
): DataCompleteness {
    const { required, optional } = methodRequirements[method]

    const available: DataCompleteness["available"] = []
    const missing: string[] = []
    const estimated: string[] = []

    for (const param of required) {
        const value = soilData[param]
        if (value !== null && value !== undefined) {
            available.push({
                param,
                value: value as number | string,
                source: soilMeta?.[param]?.source,
                date: soilMeta?.[param]?.date,
            })
        } else {
            missing.push(param)
        }
    }

    for (const param of optional) {
        const value = soilData[param]
        if (value !== null && value !== undefined) {
            available.push({
                param,
                value: value as number | string,
                source: soilMeta?.[param]?.source,
                date: soilMeta?.[param]?.date,
            })
        } else {
            estimated.push(param)
        }
    }

    // Only count parameters measured in-field (not NMI-estimated) for scoring
    const NMI_SOURCE = "nl-other-nmi"

    const availableRequired = required.filter(
        (p) =>
            soilData[p] !== null &&
            soilData[p] !== undefined &&
            soilMeta?.[p]?.source !== NMI_SOURCE,
    ).length
    const availableOptional = optional.filter(
        (p) =>
            soilData[p] !== null &&
            soilData[p] !== undefined &&
            soilMeta?.[p]?.source !== NMI_SOURCE,
    ).length

    const score =
        required.length > 0
            ? (availableRequired / required.length) * 80 +
              (optional.length > 0
                  ? (availableOptional / optional.length) * 20
                  : 20)
            : 100

    return { available, missing, estimated, score: Math.round(score) }
}
