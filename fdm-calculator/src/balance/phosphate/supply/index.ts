import type {
  PhosphateCultivationDetail,
  PhosphateFertilizerDetail,
  PhosphateFieldInput,
} from "../types"
import { calculatePhosphateDeposition } from "./deposition"
import { calculatePhosphateSupplyByFertilizers } from "./fertilizers"
import { calculatePhosphateMineralization } from "./mineralization"

/**
 * Calculates the phosphate supply of a field (kg P2O5 / ha for the timeframe): fertilizers,
 * mineralisation of soil organic matter and atmospheric deposition. Phosphorus has no biological
 * fixation, and grazing excreta are not included.
 *
 * @param fieldInput - The field input (fertilizer applications, cultivations and soil analyses).
 * @param fertilizerDetailsMap - The fertilizer details by `p_id_catalogue`.
 * @param cultivationDetailsMap - The cultivation details by `b_lu_catalogue`.
 * @param isGrassland - Whether the field is grassland (for the mineralisation on mineral soils).
 * @param timeFrame - The timeframe of the balance.
 * @returns The total supply and the supply per source.
 */
export function calculatePhosphateSupply(
  fieldInput: PhosphateFieldInput,
  fertilizerDetailsMap: Map<string, PhosphateFertilizerDetail>,
  cultivationDetailsMap: Map<string, PhosphateCultivationDetail>,
  isGrassland: boolean,
  timeFrame: { start: Date; end: Date },
) {
  const fertilizers = calculatePhosphateSupplyByFertilizers(
    fieldInput.fertilizerApplications,
    fertilizerDetailsMap,
  )
  const mineralization = calculatePhosphateMineralization(
    fieldInput,
    cultivationDetailsMap,
    isGrassland,
    timeFrame,
  )
  const deposition = calculatePhosphateDeposition(timeFrame)
  const total = fertilizers.total.add(mineralization.total).add(deposition.total)
  return { total, fertilizers, mineralization, deposition }
}
