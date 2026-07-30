import { Decimal } from "decimal.js"
import type { CultivationDetail, FieldInput, NitrogenSupplyFixation } from "../types"

/**
 * Calculates the amount of nitrogen supplied through biological fixation by cultivations.
 *
 * This function iterates through the provided cultivations, retrieves the nitrogen fixation value for each from the cultivation details map,
 * and calculates the total nitrogen supplied through fixation.
 * @param cultivations - An array of cultivations on the field.
 * @param cultivationDetailsMap - A map containing details for each cultivation, including its nitrogen fixation value.
 */
export function calculateNitrogenFixation(
  cultivations: FieldInput["cultivations"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
): NitrogenSupplyFixation {
  if (cultivations.length === 0) {
    return {
      total: new Decimal(0),
      cultivations: [],
    }
  }
  const fixations = cultivations.map((cultivation) => {
    // Get details of cultivation using the Map
    const cultivationDetail = cultivationDetailsMap.get(cultivation.b_lu_catalogue)

    if (!cultivationDetail) {
      throw new Error(
        `Cultivation ${cultivation.b_lu} has no corresponding cultivation in cultivationDetails`,
      )
    }
    const b_n_fixation = cultivationDetail.b_n_fixation

    // If this cultivation does not fixate Nitrogen or the value is not available, set it to 0
    if (b_n_fixation === null || b_n_fixation === undefined) {
      return {
        id: cultivation.b_lu,
        value: new Decimal(0),
      }
    }

    // Return the amount of Nitrogen fixated by the cultivation
    return {
      id: cultivation.b_lu,
      value: new Decimal(b_n_fixation),
    }
  })

  // Calculate the total amount of Nitrogen fixated by the cultivations
  const totalValue = fixations.reduce((acc, fixation) => {
    return acc.add(fixation.value)
  }, Decimal(0))

  return {
    total: totalValue,
    cultivations: fixations,
  }
}
