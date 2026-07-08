import Decimal from "decimal.js"
import type { CultivationDetail, FertilizerDetail, FieldInput, NitrogenEmission } from "../types"
import { calculateNitrogenEmissionViaAmmonia } from "./ammonia"

/**
 * Calculates the total nitrogen volatilization from a field, through ammonia emissions from fertilizer appplications and crop residues.
 *
 * This function orchestrates the calculation of ammonia emission by calling separate functions for fertilizer applications and
 * residue volatilization, then aggregates the results.
 * @param cultivations - A list of cultivations on the field.
 * @param harvests - A list of harvests from the field.
 * @param cultivationDetailsMap - A map containing details for each cultivation, including its nitrogen content and residue management practices.
 * @returns The NitrogenEmmissionAmmonia object containing the total amount of Nitrogen volatilized and the individual ammonia values.
 */
export function calculateNitrogenEmission(
  cultivations: FieldInput["cultivations"],
  harvests: FieldInput["harvests"],
  fertilizerApplications: FieldInput["fertilizerApplications"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
  fertilizerDetailsMap: Map<string, FertilizerDetail>,
): NitrogenEmission {
  /** Calculate the total amount of Nitrogen volatilized as Ammonia by fertilizer */
  const ammonia = calculateNitrogenEmissionViaAmmonia(
    cultivations,
    harvests,
    fertilizerApplications,
    cultivationDetailsMap,
    fertilizerDetailsMap,
  )

  const emission = {
    total: ammonia.total,
    ammonia: ammonia,
    nitrate: {
      total: new Decimal(0), // Nitrate emission is calculated as factor of nitrogen surplus this will be calculated after surplus is known
    },
  }

  return emission
}
