import Decimal from "decimal.js"
import type { CultivationDetail, FieldInput, NitrogenEmissionAmmoniaResidues } from "../../types"
import { calculateNitrogenInCropResiduesLeft } from "../crop-residues"

/**
 * Calculates the amount of Nitrogen volatilized via ammonia emissions from crop residues.
 *
 * This function determines the nitrogen volatilization from crop residues based on the cultivations performed, harvest yields,
 * and cultivation details, including the nitrogen content of the crop residues. It calculates an emission factor
 * based on the nitrogen content and then estimates the total nitrogen volatilization.
 * @param cultivations - A list of cultivations on the field.
 * @param harvests - A list of harvests from the field.
 * @param cultivationDetailsMap - The map of cultivation details.
 */
export function calculateNitrogenEmissionViaAmmoniaByResidues(
  cultivations: FieldInput["cultivations"],
  harvests: FieldInput["harvests"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
): NitrogenEmissionAmmoniaResidues {
  if (cultivations.length === 0) {
    return {
      total: new Decimal(0),
      cultivations: [],
    }
  }
  const volatilizationResidue = cultivations.map((cultivation) => {
    // Get details of cultivation using the Map
    const cultivationDetail = cultivationDetailsMap.get(cultivation.b_lu_catalogue)

    if (!cultivationDetail) {
      throw new Error(
        `Cultivation ${cultivation.b_lu} has no corresponding cultivation in cultivationDetails`,
      )
    }

    // Get the amount of nitrogen in the crop residues left on the field
    const residueNitrogen = calculateNitrogenInCropResiduesLeft(
      cultivation,
      harvests,
      cultivationDetail,
    )
    if (residueNitrogen.isZero()) {
      return {
        id: cultivation.b_lu,
        value: new Decimal(0),
      }
    }

    // Get the Nitrogen content of the crop residues
    const b_lu_n_residue = new Decimal(cultivationDetail.b_lu_n_residue ?? 0)

    // Calculate the Emission Factor
    let emissionFactor = new Decimal(0.41).times(b_lu_n_residue).minus(5.42).dividedBy(100)
    if (emissionFactor.lt(0)) {
      emissionFactor = new Decimal(0)
    } else if (emissionFactor.gt(1)) {
      emissionFactor = new Decimal(1)
    }

    // Calculate the amount of Nitrogen volatilized by crop residues of this cultivation
    const removal = residueNitrogen.times(emissionFactor).times(-1) // Return negative value

    return {
      id: cultivation.b_lu,
      value: removal,
    }
  })

  // Aggregate the total amount of Nitrogen volatilized by crop residues
  const totalValue = volatilizationResidue.reduce((acc, residue) => {
    return acc.add(residue.value)
  }, new Decimal(0))

  return {
    total: totalValue,
    cultivations: volatilizationResidue,
  }
}
