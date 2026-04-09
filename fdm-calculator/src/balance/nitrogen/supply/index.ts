import type {
    CultivationDetail,
    FertilizerDetail,
    FieldInput,
    NitrogenBalanceInput,
    NitrogenSupply,
    SoilAnalysisPicked,
} from "../types"
import { calculateNitrogenSupplyByFertilizers } from "./fertilizers"
import { calculateNitrogenFixation } from "./fixation"
import { calculateNitrogenSupplyBySoilMineralization } from "./mineralization"

/**
 * Calculates the total nitrogen supply for a field, considering various sources such as fertilizers,
 * biological fixation, atmospheric deposition, and soil mineralization.
 *
 * @param field - The field for which to calculate the nitrogen supply.
 * @param cultivations - A list of cultivations on the field.
 * @param fertilizerApplications - A list of fertilizer applications on the field.
 * @param soilAnalysis - Combined soil analysis data for the field.
 * @param cultivationDetailsMap - A map containing details for each cultivation, including its nitrogen fixation value.
 * @param fertilizerDetailsMap - A map containing details for each fertilizer, including its type and nitrogen content.
 * @param depositionSupply - The pre-calculated nitrogen supply from atmospheric deposition.
 * @param timeFrame - The time frame for which to calculate the nitrogen supply.
 *
 * @returns An object containing the total nitrogen supply for the field,
 *  as well as a breakdown by source (fertilizers, fixation, deposition, and mineralization).
 */
export function calculateNitrogenSupply(
    cultivations: FieldInput["cultivations"],
    fertilizerApplications: FieldInput["fertilizerApplications"],
    soilAnalysis: SoilAnalysisPicked,
    cultivationDetailsMap: Map<string, CultivationDetail>,
    fertilizerDetailsMap: Map<string, FertilizerDetail>,
    depositionSupply: NitrogenSupply["deposition"] | undefined,
    timeFrame: NitrogenBalanceInput["timeFrame"],
): NitrogenSupply {
    try {
        // Guard: deposition data must be present; silently defaulting to zero would mask missing data
        if (depositionSupply === undefined) {
            throw new Error(
                "Missing deposition supply data for nitrogen balance calculation",
            )
        }

        // Calculate the amount of Nitrogen supplied by fertilizers
        const fertilizersSupply = calculateNitrogenSupplyByFertilizers(
            fertilizerApplications,
            fertilizerDetailsMap,
        )

        // Calculate the amount of Nitrogen fixated by the cultivations
        const fixationSupply = calculateNitrogenFixation(
            cultivations,
            cultivationDetailsMap,
        )

        // Calculate the amount of Nitrogen supplied by mineralization from the soil
        const mineralisationSupply =
            calculateNitrogenSupplyBySoilMineralization(
                cultivations,
                soilAnalysis,
                cultivationDetailsMap,
                timeFrame,
            )
        // Calculate the total amount of Nitrogen supplied
        const totalSupply = fertilizersSupply.total
            .add(fixationSupply.total)
            .add(depositionSupply.total)
            .add(mineralisationSupply.total)

        return {
            total: totalSupply,
            fertilizers: fertilizersSupply,
            fixation: fixationSupply,
            deposition: depositionSupply,
            mineralisation: mineralisationSupply,
        }
    } catch (error) {
        console.error("Error calculating nitrogen supply:", error)
        throw new Error(
            `Failed to calculate nitrogen supply: ${error instanceof Error ? error.message : "Unknown error"}`,
        )
    }
}
