import type { PhosphateCultivationDetail, PhosphateFieldInput } from "../types"
import { calculatePhosphateRemovalByHarvests } from "./harvest"
import { calculatePhosphateRemovalByResidues } from "./residue"

/**
 * Calculates the phosphate removal of a field (kg P2O5 / ha for the timeframe, negative): harvests
 * and removed crop residues.
 *
 * @param fieldInput - The field input (cultivations and harvests).
 * @param cultivationDetailsMap - The cultivation details by `b_lu_catalogue`.
 * @param timeFrame - The timeframe of the balance.
 * @param warnings - Receives the missing data that set a removal to 0 (Dutch, for display).
 * @returns The total removal and the removal by harvests and by residues.
 */
export function calculatePhosphateRemoval(
  fieldInput: PhosphateFieldInput,
  cultivationDetailsMap: Map<string, PhosphateCultivationDetail>,
  timeFrame: { start: Date; end: Date },
  warnings: string[],
) {
  const harvests = calculatePhosphateRemovalByHarvests(
    fieldInput,
    cultivationDetailsMap,
    timeFrame,
    warnings,
  )
  const residues = calculatePhosphateRemovalByResidues(fieldInput, cultivationDetailsMap)
  return { total: harvests.total.add(residues.total), harvests, residues }
}
