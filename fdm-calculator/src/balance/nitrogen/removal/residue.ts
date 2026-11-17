import Decimal from "decimal.js"
import type { CultivationDetail, FieldInput, NitrogenRemovalResidues } from "../types"
import { calculateNitrogenInCropResidues } from "../emission/crop-residues"

/**
 * Calculates the amount of Nitrogen removed from the field through crop residue removal.
 *
 * This function determines the nitrogen removed based on the cultivations performed, harvest yields,
 * and crop residue management practices. It uses cultivation details and harvest information to estimate
 * the amount of nitrogen present in the crop residues and accounts for its removal.
 * @param cultivations - A list of cultivations on the field.
 * @param harvests - A list of harvests from the field.
 * @param cultivationDetailsMap - The map of cultivation details.
 * @returns The NitrogenRemovalResidues object containing the total amount of Nitrogen removed and the individual cultivation values.
 */
export function calculateNitrogenRemovalByResidue(
  cultivations: FieldInput["cultivations"],
  harvests: FieldInput["harvests"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
): NitrogenRemovalResidues {
  if (cultivations.length === 0) {
    return {
      total: new Decimal(0),
      cultivations: [],
    }
  }
  const removalsResidue = cultivations.map((cultivation) => {
    // Get details of cultivation using the Map
    const cultivationDetail = cultivationDetailsMap.get(cultivation.b_lu_catalogue)

    if (!cultivationDetail) {
      throw new Error(
        `Cultivation ${cultivation.b_lu} has no corresponding cultivation in cultivationDetails`,
      )
    }

    // If crop residues are left or if this is not known return 0 for the amount of Nitrogen removed by crop residues
    if (cultivation.m_cropresidue !== false) {
      return {
        id: cultivation.b_lu,
        value: new Decimal(0),
      }
    }

    // The nitrogen in the crop residues of this cultivation is removed, as a negative value
    const residueNitrogen = calculateNitrogenInCropResidues(
      cultivation,
      harvests,
      cultivationDetail,
    )
    return {
      id: cultivation.b_lu,
      value: residueNitrogen.isZero() ? new Decimal(0) : residueNitrogen.times(-1),
    }
  })

  // Aggregate the total amount of Nitrogen removed by crop residues
  const totalValue = removalsResidue.reduce((acc, residue) => {
    return acc.add(residue.value)
  }, new Decimal(0))

  return {
    total: totalValue,
    cultivations: removalsResidue,
  }
}
