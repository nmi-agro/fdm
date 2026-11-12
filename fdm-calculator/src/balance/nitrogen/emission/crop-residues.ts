import type { HarvestableAnalysis } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import type { CultivationDetail, FieldInput } from "../types"

/**
 * Calculates the amount of nitrogen in the above-ground crop residues that are left on the field.
 *
 * The amount of crop residues is derived from the yield and the harvest index of the cultivation:
 * `yield / b_lu_hi * (1 - b_lu_hi)`. The yield is the average of the yields of the harvests of the
 * cultivation, or the default yield of the cultivation catalogue when no yield is known. The amount
 * of nitrogen is the amount of residues multiplied by their nitrogen content (`b_lu_n_residue`).
 *
 * Only residues that are known to be left on the field (`m_cropresidue` is `true`) are counted.
 *
 * @param cultivation - The cultivation for which the crop residues are calculated.
 * @param harvests - The harvests of the field; only the harvests of this cultivation are used.
 * @param cultivationDetail - The details of the cultivation from the cultivation catalogue.
 * @returns The amount of nitrogen in the crop residues left on the field (kg N / ha), zero or positive.
 *
 * @example
 * ```ts
 * const residueN = calculateNitrogenInCropResiduesLeft(cultivation, harvests, cultivationDetail)
 * // Decimal(35)
 * ```
 */
export function calculateNitrogenInCropResiduesLeft(
  cultivation: FieldInput["cultivations"][number],
  harvests: FieldInput["harvests"],
  cultivationDetail: CultivationDetail,
): Decimal {
  // If no crop residues are left or if this is not known, no nitrogen is left in the crop residues
  if (!cultivation.m_cropresidue) {
    return new Decimal(0)
  }

  // Get the (total) yield for this crop and number of harvests
  let totalYield = new Decimal(0)
  let harvestCount = 0
  for (const harvest of harvests.filter((h) => h.b_lu === cultivation.b_lu)) {
    let yieldForThisHarvest = new Decimal(cultivationDetail.b_lu_yield ?? 0)
    if (
      harvest.harvestable?.harvestable_analyses &&
      harvest.harvestable.harvestable_analyses.length > 0
    ) {
      // Prioritize the specific yield if available
      const analysisWithYield = harvest.harvestable.harvestable_analyses.find(
        (analysis: HarvestableAnalysis) => analysis.b_lu_yield !== undefined,
      )
      if (analysisWithYield) {
        yieldForThisHarvest = new Decimal(analysisWithYield.b_lu_yield ?? 0)
      }
    }

    totalYield = totalYield.add(yieldForThisHarvest)
    harvestCount++
  }

  // Get the average yield for the cultivation, or the default yield from the cultivation catalogue
  const b_lu_yield =
    harvestCount === 0
      ? new Decimal(cultivationDetail.b_lu_yield ?? 0)
      : totalYield.dividedBy(harvestCount)

  // If the cultivation has no harvest index, no crop residues can be derived
  const b_lu_hi = new Decimal(cultivationDetail.b_lu_hi ?? 0)
  if (b_lu_hi.isZero()) {
    return new Decimal(0)
  }
  const b_lu_hi_res = new Decimal(1).minus(b_lu_hi)

  // Get the nitrogen content of the crop residues
  const b_lu_n_residue = new Decimal(cultivationDetail.b_lu_n_residue ?? 0)

  return b_lu_yield.dividedBy(b_lu_hi).times(b_lu_hi_res).times(b_lu_n_residue).dividedBy(1000) // Convert from g N / ha to kg N / ha
}
