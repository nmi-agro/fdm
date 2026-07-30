import type {
  CultivationDetail,
  FertilizerDetail,
  FieldInput,
  OrganicMatterBalanceInput,
  OrganicMatterSupply,
} from "../types"
import { calculateOrganicMatterSupplyByCultivations } from "./cultivation"
import { calculateOrganicMatterSupplyByFertilizers } from "./fertilizers"
import { calculateOrganicMatterSupplyByResidues } from "./residues"

/**
 * Calculates the total supply of effective organic matter (EOM) for a single field.
 *
 * This function serves as a master aggregator for the EOM supply, orchestrating calls
 * to specialized functions that calculate the EOM from different sources:
 * 1. `calculateOrganicMatterSupplyByFertilizers`: From organic fertilizers like manure and compost.
 * 2. `calculateOrganicMatterSupplyByCultivations`: From main crops and green manures.
 * 3. `calculateOrganicMatterSupplyByResidues`: From incorporated crop residues.
 *
 * It then sums the totals from each source to provide a comprehensive EOM supply figure for the field.
 *
 * @param cultivations - An array of cultivation records for the field.
 * @param fertilizerApplications - An array of fertilizer application records for the field.
 * @param cultivationDetailsMap - A map containing detailed information for each cultivation type.
 * @param fertilizerDetailsMap - A map containing detailed information for each fertilizer type.
 * @param timeFrame - The start and end dates for the calculation period, used to filter relevant events.
 * @returns An object containing the total EOM supply for the field, with a detailed breakdown by source.
 * @throws {Error} If any of the sub-calculations fail, the error is caught and re-thrown with additional context.
 */
export function calculateOrganicMatterSupply(
  cultivations: FieldInput["cultivations"],
  fertilizerApplications: FieldInput["fertilizerApplications"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
  fertilizerDetailsMap: Map<string, FertilizerDetail>,
  timeFrame: OrganicMatterBalanceInput["timeFrame"],
): OrganicMatterSupply {
  try {
    // 1. Calculate EOM supply from all organic fertilizer applications.
    const fertilizersSupply = calculateOrganicMatterSupplyByFertilizers(
      fertilizerApplications,
      fertilizerDetailsMap,
    )

    // 2. Calculate EOM supply from the primary growth of main crops and green manures.
    const cultivationsSupply = calculateOrganicMatterSupplyByCultivations(
      cultivations,
      cultivationDetailsMap,
    )

    // 3. Calculate EOM supply from incorporated crop residues.
    const residuesSupply = calculateOrganicMatterSupplyByResidues(
      cultivations,
      cultivationDetailsMap,
      timeFrame,
    )

    // 4. Sum the totals from all sources to get the grand total EOM supply.
    const totalSupply = fertilizersSupply.total
      .plus(cultivationsSupply.total)
      .plus(residuesSupply.total)

    // Return the aggregated results with a detailed breakdown.
    return {
      total: totalSupply,
      fertilizers: fertilizersSupply,
      cultivations: cultivationsSupply,
      residues: residuesSupply,
    }
  } catch (error) {
    console.error("Error calculating organic matter supply:", error)
    throw new Error(
      `Failed to calculate organic matter supply: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}
