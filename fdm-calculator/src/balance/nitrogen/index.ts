import { type FdmType, withCalculationCache } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import pkg from "../../package"
import { convertDecimalToNumberRecursive } from "../shared/conversion"
import { combineSoilAnalyses } from "../shared/soil"
import { calculateNitrogenEmission } from "./emission"
import { calculateNitrogenEmissionViaNitrate } from "./emission/nitrate"
import { calculateNitrogenRemoval } from "./removal"
import { calculateNitrogenSupply } from "./supply"
import { calculateTargetForNitrogenBalance } from "./target"
import type {
    FertilizerDetail,
    NitrogenBalanceFieldInput,
    NitrogenBalanceFieldNumeric,
    NitrogenBalanceFieldResultNumeric,
    NitrogenBalanceInput,
    NitrogenBalanceNumeric,
    SoilAnalysisPicked,
} from "./types"

/**
 * Calculates the nitrogen balance for an entire farm.
 *
 * This function orchestrates the nitrogen balance calculation for all fields on a farm.
 * It calls `getNitrogenBalanceField` for each field and then aggregates the results
 * using `calculateNitrogenBalancesFieldToFarm`.
 *
 * @param fdm - The FDM instance for database access (caching).
 * @param nitrogenBalanceInput - The input data for the nitrogen balance calculation, including all fields.
 * @returns A promise that resolves with the aggregated nitrogen balance for the farm.
 */
export async function calculateNitrogenBalance(
    fdm: FdmType,
    nitrogenBalanceInput: NitrogenBalanceInput,
): Promise<NitrogenBalanceNumeric> {
    const { fields, fertilizerDetails, cultivationDetails, timeFrame } =
        nitrogenBalanceInput

    const fieldsWithBalanceResults: NitrogenBalanceFieldResultNumeric[] = []
    const batchSize = 50

    for (let i = 0; i < fields.length; i += batchSize) {
        const batch = fields.slice(i, i + batchSize)
        const batchResults = await Promise.all(
            batch.map(async (fieldInput) => {
                try {
                    const balance = await getNitrogenBalanceField(fdm, {
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

    return calculateNitrogenBalancesFieldToFarm(
        fieldsWithBalanceResults,
        hasErrors,
        fieldErrorMessages,
    )
}

/**
 * Calculates the nitrogen balance for a single field, considering nitrogen supply, removal, and emission.
 *
 * This function performs a detailed calculation of the nitrogen balance for a single field,
 * taking into account various sources of nitrogen supply (e.g., fertilizers, mineralization),
 * nitrogen removal (e.g., harvest, crop residues), and nitrogen losses through emission.
 *
 * The calculation relies on detailed input parameters, including:
 *   - field characteristics
 *   - cultivation details
 *   - harvest yields and nitrogen content
 *   - fertilizer applications and their nitrogen contributions
 *   - soil analysis data
 *
 * @param nitrogenBalanceInput - The input data for the nitrogen balance calculation for a single field.
 * @returns The calculated nitrogen balance for the field.
 */
export function calculateNitrogenBalanceField(
    nitrogenBalanceInput: NitrogenBalanceFieldInput,
): NitrogenBalanceFieldNumeric {
    const { fieldInput, fertilizerDetails, cultivationDetails, timeFrame } =
        nitrogenBalanceInput

    // Get the details of the field
    const {
        field,
        harvests,
        cultivations,
        soilAnalyses,
        fertilizerApplications,
        depositionSupply,
    } = fieldInput

    if (!timeFrame.start || !timeFrame.end) {
        throw new Error("Timeframe start and end dates must be provided.")
    }

    if (field.b_bufferstrip) {
        return {
            b_id: field.b_id,
            balance: 0,
            supply: {
                total: 0,
                fertilizers: {
                    total: 0,
                    mineral: { total: 0, applications: [] },
                    manure: { total: 0, applications: [] },
                    compost: { total: 0, applications: [] },
                    other: { total: 0, applications: [] },
                },
                fixation: { total: 0, cultivations: [] },
                deposition: { total: 0 },
                mineralisation: { total: 0 },
            },
            removal: {
                total: 0,
                harvests: { total: 0, harvests: [] },
                residues: { total: 0, cultivations: [] },
            },
            emission: {
                total: 0,
                ammonia: {
                    total: 0,
                    fertilizers: {
                        total: 0,
                        mineral: { total: 0, applications: [] },
                        manure: { total: 0, applications: [] },
                        compost: { total: 0, applications: [] },
                        other: { total: 0, applications: [] },
                    },
                    residues: { total: 0, cultivations: [] },
                    grazing: undefined,
                },
                nitrate: { total: 0 },
            },
            target: 0,
        }
    }

    const fertilizerDetailsMap = new Map<string, FertilizerDetail>(
        fertilizerDetails.map((detail) => [detail.p_id_catalogue, detail]),
    )
    const cultivationDetailsMap = new Map(
        cultivationDetails.map((detail) => [detail.b_lu_catalogue, detail]),
    )

    // Combine soil analyses
    const soilAnalysis = combineSoilAnalyses<SoilAnalysisPicked>(
        soilAnalyses,
        [
            "b_soiltype_agr",
            "a_n_rt",
            "a_c_of",
            "a_cn_fr",
            "a_density_sa",
            "a_som_loi",
            "b_gwl_class",
        ],
        true,
    )

    // Use a field-local timeframe (intersection with input timeframe)
    const timeFrameStartTime = timeFrame.start.getTime()
    const timeFrameEndTime = timeFrame.end.getTime()

    const fieldStartTime = field.b_start
        ? field.b_start.getTime()
        : Number.NEGATIVE_INFINITY
    const fieldEndTime = field.b_end
        ? field.b_end.getTime()
        : Number.POSITIVE_INFINITY

    const timeFrameField = {
        start: new Date(Math.max(fieldStartTime, timeFrameStartTime)),
        end: new Date(Math.min(fieldEndTime, timeFrameEndTime)),
    }
    // Normalize: ensure start <= end
    if (timeFrameField.end.getTime() < timeFrameField.start.getTime()) {
        // Clamp to an empty interval at the boundary to signal “no overlap”
        timeFrameField.end = timeFrameField.start
    }

    // Calculate the amount of Nitrogen supplied
    const supply = calculateNitrogenSupply(
        cultivations,
        fertilizerApplications,
        soilAnalysis,
        cultivationDetailsMap,
        fertilizerDetailsMap,
        depositionSupply,
        timeFrameField,
    )

    // Calculate the amount of Nitrogen removed
    const removal = calculateNitrogenRemoval(
        cultivations,
        harvests,
        cultivationDetailsMap,
    )

    // Calculate the amount of Nitrogen that is volatilized
    const emission = calculateNitrogenEmission(
        cultivations,
        harvests,
        fertilizerApplications,
        cultivationDetailsMap,
        fertilizerDetailsMap,
    )

    // Calculate the balance
    const balance = supply.total.add(removal.total).add(emission.ammonia.total)

    // Calculate the Nitrogen Emssion via Nitrate as the surplus of nitrogen balance that is leached out
    const nitrateEmission = calculateNitrogenEmissionViaNitrate(
        balance,
        cultivations,
        soilAnalysis,
        cultivationDetailsMap,
    )
    emission.nitrate = nitrateEmission
    emission.total = emission.total.add(nitrateEmission.total)

    // Calculate the target for the Nitrogen balance
    const target = calculateTargetForNitrogenBalance(
        cultivations,
        soilAnalysis,
        cultivationDetailsMap,
        timeFrameField,
    )

    const balanceNumeric = convertDecimalToNumberRecursive({
        b_id: field.b_id,
        balance: balance,
        supply: supply,
        removal: removal,
        emission: emission,
        target: target,
    }) as NitrogenBalanceFieldNumeric

    return balanceNumeric
}

/**
 * A cached version of the `calculateNitrogenBalanceField` function.
 *
 * This function provides the same functionality as `calculateNitrogenBalanceField` but
 * includes a caching mechanism to improve performance for repeated calls with the
 * same input. The cache is managed by `withCalculationCache` and uses the
 * `pkg.calculatorVersion` as part of its cache key.
 *
 * @param nitrogenBalanceInput - The input data for the nitrogen balance calculation.
 * @returns A promise that resolves with the calculated nitrogen balance, with numeric values as numbers.
 */
export const getNitrogenBalanceField = withCalculationCache(
    calculateNitrogenBalanceField,
    "calculateNitrogenBalanceField",
    pkg.calculatorVersion,
)

/**
 * Aggregates nitrogen balances from individual fields to the farm level.
 *
 * This function takes an array of nitrogen balance results for individual fields and aggregates
 * them to provide an overall nitrogen balance for the entire farm. It calculates weighted
 * averages of nitrogen supply, removal, and emission based on the area of each field.
 *
 * The function returns a comprehensive nitrogen balance for the farm, including total supply,
 * removal, emission, and the overall balance.
 * @param fieldsWithBalanceResults - An array of nitrogen balance results for individual fields, potentially including errors.
 * @param hasErrors - Indicates if any field calculations failed.
 * @param fieldErrorMessages - A list of error messages for fields that failed to calculate.
 * @returns The aggregated nitrogen balance for the farm.
 */
export function calculateNitrogenBalancesFieldToFarm(
    fieldsWithBalanceResults: NitrogenBalanceFieldResultNumeric[],
    hasErrors: boolean,
    fieldErrorMessages: string[],
): NitrogenBalanceNumeric {
    // Filter out fields that have errors for aggregation
    // Also filter out buffer strips as they should be ignored in the farm-level aggregation
    const successfulFieldBalances = fieldsWithBalanceResults.filter(
        (result) => result.balance !== undefined && !result.b_bufferstrip,
    ) as (NitrogenBalanceFieldResultNumeric & {
        balance: NitrogenBalanceFieldNumeric
    })[]

    // Calculate total weighted supply, removal, and emission across the farm
    const fertilizerTypes = ["mineral", "manure", "compost", "other"] as const
    let totalFarmSupply = new Decimal(0)
    let totalFarmSupplyDeposition = new Decimal(0)
    let totalFarmSupplyFixation = new Decimal(0)
    let totalFarmSupplyMineralization = new Decimal(0)
    const totalFarmSupplyFertilizers = Object.fromEntries(
        fertilizerTypes.reduce(
            (arr, key) => {
                arr.push([key, new Decimal(0)])
                return arr
            },
            [] as [(typeof fertilizerTypes)[number], Decimal][],
        ),
    ) as Record<(typeof fertilizerTypes)[number], Decimal>
    let totalFarmRemoval = new Decimal(0)
    let totalFarmRemovalHarvest = new Decimal(0)
    let totalFarmRemovalResidue = new Decimal(0)

    let totalFarmEmission = new Decimal(0)
    let totalFarmEmissionAmmonia = new Decimal(0)
    let totalFarmEmissionAmmoniaFertilizer = new Decimal(0)
    const ammoniaByFertilizerType = Object.fromEntries(
        fertilizerTypes.reduce(
            (arr, key) => {
                arr.push([key, new Decimal(0)])
                return arr
            },
            [] as [(typeof fertilizerTypes)[number], Decimal][],
        ),
    ) as Record<(typeof fertilizerTypes)[number], Decimal>
    let totalFarmEmissionAmmoniaResidue = new Decimal(0)
    let totalFarmEmissionNitrate = new Decimal(0)
    let totalFarmTarget = new Decimal(0)
    let totalFarmArea = new Decimal(0)

    for (const fieldResult of successfulFieldBalances) {
        const fieldArea = new Decimal(fieldResult.b_area ?? 0)
        totalFarmArea = totalFarmArea.add(fieldArea)

        totalFarmSupply = totalFarmSupply.add(
            new Decimal(fieldResult.balance.supply.total).times(fieldArea),
        )
        totalFarmSupplyDeposition = totalFarmSupplyDeposition.add(
            new Decimal(fieldResult.balance.supply.deposition.total).times(
                fieldArea,
            ),
        )
        totalFarmSupplyFixation = totalFarmSupplyFixation.add(
            new Decimal(fieldResult.balance.supply.fixation.total).times(
                fieldArea,
            ),
        )
        totalFarmSupplyMineralization = totalFarmSupplyMineralization.add(
            new Decimal(fieldResult.balance.supply.mineralisation.total).times(
                fieldArea,
            ),
        )
        for (const fertilizerType of fertilizerTypes) {
            totalFarmSupplyFertilizers[fertilizerType] =
                totalFarmSupplyFertilizers[fertilizerType].add(
                    new Decimal(
                        fieldResult.balance.supply.fertilizers[fertilizerType]
                            .total,
                    ).times(fieldArea),
                )
        }

        totalFarmRemoval = totalFarmRemoval.add(
            new Decimal(fieldResult.balance.removal.total).times(fieldArea),
        )
        totalFarmRemovalHarvest = totalFarmRemovalHarvest.add(
            new Decimal(fieldResult.balance.removal.harvests.total).times(
                fieldArea,
            ),
        )
        totalFarmRemovalResidue = totalFarmRemovalResidue.add(
            new Decimal(fieldResult.balance.removal.residues.total).times(
                fieldArea,
            ),
        )
        totalFarmEmission = totalFarmEmission.add(
            new Decimal(fieldResult.balance.emission.total).times(fieldArea),
        )
        totalFarmEmissionAmmonia = totalFarmEmissionAmmonia.add(
            new Decimal(fieldResult.balance.emission.ammonia.total).times(
                fieldArea,
            ),
        )

        for (const fertilizerType of fertilizerTypes) {
            const fieldTotal = new Decimal(
                fieldResult.balance.emission.ammonia.fertilizers[fertilizerType]
                    .total,
            ).times(fieldArea)
            ammoniaByFertilizerType[fertilizerType] =
                ammoniaByFertilizerType[fertilizerType].add(fieldTotal)
            totalFarmEmissionAmmoniaFertilizer =
                totalFarmEmissionAmmoniaFertilizer.add(fieldTotal)
        }

        totalFarmEmissionAmmoniaResidue = totalFarmEmissionAmmoniaResidue.add(
            new Decimal(
                fieldResult.balance.emission.ammonia.residues.total,
            ).times(fieldArea),
        )

        totalFarmEmissionNitrate = totalFarmEmissionNitrate.add(
            new Decimal(fieldResult.balance.emission.nitrate.total).times(
                fieldArea,
            ),
        )

        totalFarmTarget = totalFarmTarget.add(
            new Decimal(fieldResult.balance.target).times(fieldArea),
        )
    }

    // Calculate average values per hectare for the farm, only considering the area of successfully calculated fields
    const avgFarmSupply = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmSupply.dividedBy(totalFarmArea)
    const avgFarmSupplyDeposition = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmSupplyDeposition.dividedBy(totalFarmArea)
    const avgFarmSupplyFixation = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmSupplyFixation.dividedBy(totalFarmArea)
    const avgFarmSupplyMineralization = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmSupplyMineralization.dividedBy(totalFarmArea)
    let totalFarmSupplyFertilizersTotal = new Decimal(0)
    for (const fertilizerType of fertilizerTypes) {
        const value = totalFarmSupplyFertilizers[fertilizerType]
        totalFarmSupplyFertilizers[fertilizerType] = totalFarmArea.isZero()
            ? new Decimal(0)
            : value.dividedBy(totalFarmArea)
        totalFarmSupplyFertilizersTotal =
            totalFarmSupplyFertilizersTotal.add(value)
    }
    totalFarmSupplyFertilizersTotal = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmSupplyFertilizersTotal.dividedBy(totalFarmArea)
    const avgFarmRemoval = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmRemoval.dividedBy(totalFarmArea)
    const avgFarmRemovalHarvest = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmRemovalHarvest.dividedBy(totalFarmArea)
    const avgFarmRemovalResidue = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmRemovalResidue.dividedBy(totalFarmArea)
    const avgFarmEmission = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmEmission.dividedBy(totalFarmArea)
    const avgFarmEmissionAmmonia = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmEmissionAmmonia.dividedBy(totalFarmArea)
    const avgFarmEmissionAmmoniaFertilizer = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmEmissionAmmoniaFertilizer.dividedBy(totalFarmArea)
    const avgFarmEmissionAmmoniaResidue = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmEmissionAmmoniaResidue.dividedBy(totalFarmArea)
    const avgFarmEmissionNitrate = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmEmissionNitrate.dividedBy(totalFarmArea)
    const avgFarmTarget = totalFarmArea.isZero()
        ? new Decimal(0)
        : totalFarmTarget.dividedBy(totalFarmArea)
    for (const fertilizerType of fertilizerTypes) {
        ammoniaByFertilizerType[fertilizerType] = totalFarmArea.isZero()
            ? new Decimal(0)
            : ammoniaByFertilizerType[fertilizerType].dividedBy(totalFarmArea)
    }

    // Calculate the average balance at farm level (Supply + Removal + Emission)
    const avgFarmBalance = avgFarmSupply
        .add(avgFarmRemoval)
        .add(avgFarmEmission)

    // Return the farm with average balances per hectare
    const farmWithBalance = {
        balance: avgFarmBalance,
        supply: {
            total: avgFarmSupply,
            deposition: avgFarmSupplyDeposition,
            fixation: avgFarmSupplyFixation,
            mineralisation: avgFarmSupplyMineralization,
            fertilizers: {
                ...totalFarmSupplyFertilizers,
                total: totalFarmSupplyFertilizersTotal,
            },
        },
        removal: {
            total: avgFarmRemoval,
            harvests: avgFarmRemovalHarvest,
            residues: avgFarmRemovalResidue,
        },
        emission: {
            total: avgFarmEmission,
            ammonia: {
                total: avgFarmEmissionAmmonia,
                residues: avgFarmEmissionAmmoniaResidue,
                fertilizers: {
                    total: avgFarmEmissionAmmoniaFertilizer,
                    ...ammoniaByFertilizerType,
                },
            },
            nitrate: avgFarmEmissionNitrate,
        },
        target: avgFarmTarget,
        fields: fieldsWithBalanceResults,
        hasErrors:
            hasErrors ||
            fieldsWithBalanceResults.filter((result) => !result.b_bufferstrip)
                .length !== successfulFieldBalances.length,
        fieldErrorMessages: fieldErrorMessages,
    }

    return convertDecimalToNumberRecursive(
        farmWithBalance,
    ) as NitrogenBalanceNumeric
}
