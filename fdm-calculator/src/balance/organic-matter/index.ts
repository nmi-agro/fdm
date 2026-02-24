import { type FdmType, withCalculationCache } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import pkg from "../../package"
import { convertDecimalToNumberRecursive } from "../shared/conversion"
import { combineSoilAnalyses } from "../shared/soil"
import { calculateOrganicMatterDegradation } from "./degradation"
import { calculateOrganicMatterSupply } from "./supply"
import type {
    CultivationDetail,
    FertilizerDetail,
    OrganicMatterBalanceFieldInput,
    OrganicMatterBalanceFieldNumeric,
    OrganicMatterBalanceFieldResultNumeric,
    OrganicMatterBalanceInput,
    OrganicMatterBalanceNumeric,
    SoilAnalysisPicked,
} from "./types"

/**
 * Calculates the organic matter balance for a farm, aggregating results from all its fields.
 *
 * This function serves as the main entry point for the organic matter balance calculation.
 * It takes a comprehensive set of input data for a farm, processes each field in batches
 * to calculate its individual balance, and then aggregates these results into a single,
 * farm-level balance. The final output is a numeric representation of the balance,
 * suitable for display or further analysis.
 *
 * @param fdm - The FDM instance for database access (caching).
 * @param organicMatterBalanceInput - The complete dataset required for the calculation, including all fields,
 *   fertilizer catalogues, and cultivation catalogues for the farm.
 * @returns A promise that resolves to the aggregated `OrganicMatterBalanceNumeric` object for the farm.
 * @throws {Error} Throws an error if the calculation process fails for any reason.
 */
export async function calculateOrganicMatterBalance(
    fdm: FdmType,
    organicMatterBalanceInput: OrganicMatterBalanceInput,
): Promise<OrganicMatterBalanceNumeric> {
    // Destructure input for easier access.
    const { fields, fertilizerDetails, cultivationDetails, timeFrame } =
        organicMatterBalanceInput

    // Process fields in batches to avoid overwhelming the system with concurrent promises,
    // especially for farms with a large number of fields.
    const fieldsWithBalanceResults: OrganicMatterBalanceFieldResultNumeric[] =
        []
    const batchSize = 50

    for (let i = 0; i < fields.length; i += batchSize) {
        const batch = fields.slice(i, i + batchSize)
        const batchResults = await Promise.all(
            batch.map(async (fieldInput) => {
                try {
                    const balance = await getOrganicMatterBalanceField(fdm, {
                        fieldInput,
                        fertilizerDetails,
                        cultivationDetails,
                        timeFrame,
                    })
                    return {
                        b_id: fieldInput.field.b_id,
                        b_area: fieldInput.field.b_area ?? 0,
                        b_bufferstrip: fieldInput.field.b_bufferstrip ?? false,
                        balance,
                    }
                } catch (error) {
                    return {
                        b_id: fieldInput.field.b_id,
                        b_area: fieldInput.field.b_area ?? 0,
                        b_bufferstrip: fieldInput.field.b_bufferstrip ?? false,
                        errorMessage:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    }
                }
            }),
        )
        fieldsWithBalanceResults.push(...batchResults)
    }

    const hasErrors = fieldsWithBalanceResults.some(
        (result) => result.errorMessage !== undefined,
    )
    const fieldErrorMessages = fieldsWithBalanceResults
        .filter((result) => result.errorMessage !== undefined)
        .map((result) => result.errorMessage as string)

    // Aggregate the results from all individual fields into a single farm-level balance.
    return calculateOrganicMatterBalancesFieldToFarm(
        fieldsWithBalanceResults,
        hasErrors,
        fieldErrorMessages,
    )
}

/**
 * Calculates the organic matter balance for a single field.
 *
 * This function computes the balance by subtracting the total organic matter degradation
 * from the total supply of effective organic matter (EOM). It orchestrates calls to
 * `calculateOrganicMatterSupply` and `calculateOrganicMatterDegradation` to get the two
 * main components of the balance.
 *
 * @param organicMatterBalanceFieldInput - The input data for the organic matter balance calculation for a single field.
 * @returns A `OrganicMatterBalanceFieldResult` object containing the detailed balance or an error message.
 */
export function calculateOrganicMatterBalanceField(
    organicMatterBalanceFieldInput: OrganicMatterBalanceFieldInput,
): OrganicMatterBalanceFieldNumeric {
    const { fieldInput, fertilizerDetails, cultivationDetails, timeFrame } =
        organicMatterBalanceFieldInput

    const { field, cultivations, fertilizerApplications, soilAnalyses } =
        fieldInput

    if (field.b_bufferstrip) {
        return {
            b_id: field.b_id,
            balance: 0,
            supply: {
                total: 0,
                fertilizers: {
                    total: 0,
                    manure: { total: 0, applications: [] },
                    compost: { total: 0, applications: [] },
                    other: { total: 0, applications: [] },
                },
                cultivations: { total: 0, cultivations: [] },
                residues: { total: 0, cultivations: [] },
            },
            degradation: { total: 0 },
        } as OrganicMatterBalanceFieldNumeric
    }

    const fertilizerDetailsMap = new Map<string, FertilizerDetail>(
        fertilizerDetails.map((detail: FertilizerDetail) => [
            detail.p_id_catalogue,
            detail,
        ]),
    )
    const cultivationDetailsMap = new Map<string, CultivationDetail>(
        cultivationDetails.map((detail: CultivationDetail) => [
            detail.b_lu_catalogue,
            detail,
        ]),
    )
    const fieldDetails = field

    // 1. Combine multiple soil analyses into a single representative record for the field.
    // We need 'a_som_loi' and 'a_density_sa' for the degradation calculation.
    const soilAnalysis = combineSoilAnalyses<SoilAnalysisPicked>(
        soilAnalyses,
        ["a_som_loi", "a_density_sa", "b_soiltype_agr"],
        true, // Enable estimation of missing values if possible
    )

    // 2. Calculate the total supply of effective organic matter (EOM).
    const supply = calculateOrganicMatterSupply(
        cultivations,
        fertilizerApplications,
        cultivationDetailsMap,
        fertilizerDetailsMap,
        timeFrame,
    )

    // 3. Calculate the total degradation of soil organic matter (SOM).
    const degradation = calculateOrganicMatterDegradation(
        soilAnalysis,
        cultivations,
        cultivationDetailsMap,
        timeFrame,
    )

    // 4. Calculate the final balance: EOM Supply - SOM Degradation.
    return convertDecimalToNumberRecursive({
        b_id: fieldDetails.b_id,
        balance: supply.total.plus(degradation.total),
        supply: supply,
        degradation: degradation,
    }) as OrganicMatterBalanceFieldNumeric
}

/**
 * A cached version of the `calculateOrganicMatterBalanceField` function.
 *
 * This function provides the same functionality as `calculateOrganicMatterBalanceField` but
 * includes a caching mechanism to improve performance for repeated calls with the
 * same input. The cache is managed by `withCalculationCache` and uses the
 * `pkg.calculatorVersion` as part of its cache key.
 *
 * @param organicMatterBalanceFieldInput - The input data for the organic matter balance calculation for a single field.
 * @returns A promise that resolves with the calculated organic matter balance, with numeric values as numbers.
 */
export const getOrganicMatterBalanceField = withCalculationCache(
    calculateOrganicMatterBalanceField,
    "calculateOrganicMatterBalanceField",
    pkg.calculatorVersion,
)

/**
 * Aggregates the organic matter balances from individual fields to a farm-level summary.
 *
 * This function takes the results for all fields, filters out any that failed,
 * and calculates a weighted average for the farm's overall supply, degradation, and balance,
 * using the area of each field as the weight.
 *
 * @param fieldsWithBalanceResults - An array of `OrganicMatterBalanceFieldResultNumeric` objects.
 * @param hasErrors - A boolean flag indicating if any field calculations failed.
 * @param fieldErrorMessages - An array of error messages from failed calculations.
 * @returns A single `OrganicMatterBalanceNumeric` object representing the aggregated farm-level results.
 */
export function calculateOrganicMatterBalancesFieldToFarm(
    fieldsWithBalanceResults: OrganicMatterBalanceFieldResultNumeric[],
    hasErrors: boolean,
    fieldErrorMessages: string[],
): OrganicMatterBalanceNumeric {
    // Filter out fields that have errors to ensure they are not included in the aggregation.
    // Also filter out buffer strips as they should be ignored in the farm-level aggregation
    const successfulFieldBalances = fieldsWithBalanceResults.filter(
        (result) => result.balance !== undefined && !result.b_bufferstrip,
    ) as (OrganicMatterBalanceFieldResultNumeric & {
        balance: OrganicMatterBalanceFieldNumeric
    })[]

    let totalFarmSupply = new Decimal(0)
    let totalFarmDegradation = new Decimal(0)
    let totalFarmArea = new Decimal(0)

    // Calculate the total supply and degradation across the farm, weighted by field area.
    for (const fieldResult of successfulFieldBalances) {
        const fieldArea = new Decimal(fieldResult.b_area ?? 0)
        totalFarmArea = totalFarmArea.add(fieldArea)

        // Add the area-weighted supply and degradation to the farm totals.
        totalFarmSupply = totalFarmSupply.add(
            new Decimal(fieldResult.balance.supply.total).times(fieldArea),
        )
        totalFarmDegradation = totalFarmDegradation.add(
            new Decimal(fieldResult.balance.degradation.total).times(fieldArea),
        )
    }

    // Calculate the average values per hectare for the entire farm.
    const avgFarmSupply = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmSupply.dividedBy(totalFarmArea)
    const avgFarmDegradation = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmDegradation.dividedBy(totalFarmArea)

    // The final farm balance is the difference between the average supply and average degradation.
    const avgFarmBalance = avgFarmSupply.plus(avgFarmDegradation)

    return convertDecimalToNumberRecursive({
        balance: avgFarmBalance,
        supply: avgFarmSupply,
        degradation: avgFarmDegradation,
        fields: fieldsWithBalanceResults,
        hasErrors:
            hasErrors ||
            fieldsWithBalanceResults.filter((result) => !result.b_bufferstrip)
                .length !== successfulFieldBalances.length,
        fieldErrorMessages,
    }) as OrganicMatterBalanceNumeric
}
