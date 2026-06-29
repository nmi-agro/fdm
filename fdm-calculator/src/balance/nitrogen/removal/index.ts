import type { CultivationDetail, FieldInput, NitrogenRemoval } from "../types"
import { calculateNitrogenRemovalByHarvests } from "./harvest"
import { calculateNitrogenRemovalByResidue } from "./residue"

/**
 * Calculates the total nitrogen removal from a field, considering both harvest and residue removal.
 *
 * This function orchestrates the calculation of nitrogen removal by calling separate functions
 * for harvest and residue removal, then aggregates the results.
 * @param cultivations - A list of cultivations on the field.
 * @param harvests - A list of harvests from the field.
 * @param cultivationDetailsMap - A map containing details for each cultivation.
 * @returns The NitrogenRemoval object containing the total amount of Nitrogen removed and the individual harvest and residue values.
 */
export function calculateNitrogenRemoval(
  cultivations: FieldInput["cultivations"],
  harvests: FieldInput["harvests"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
): NitrogenRemoval {
  // Calculate the amount of Nitrogen removed by harvests
  const harvestsRemoval = calculateNitrogenRemovalByHarvests(
    cultivations,
    harvests,
    cultivationDetailsMap,
  )

  // Calculate the amount of Nitrogen removed by crop residues
  const residuesRemoval = calculateNitrogenRemovalByResidue(
    cultivations,
    harvests,
    cultivationDetailsMap,
  )

  // Calculate the total amount of Nitrogen removed (sum of harvest and residue removal)
  const totalValue = harvestsRemoval.total.add(residuesRemoval.total)

  const removal = {
    total: totalValue,
    harvests: harvestsRemoval,
    residues: residuesRemoval,
  }

  return removal
}
