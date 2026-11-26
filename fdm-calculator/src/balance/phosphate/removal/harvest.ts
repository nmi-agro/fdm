import Decimal from "decimal.js"
import type { PhosphateCultivationDetail, PhosphateFieldInput } from "../types"

/**
 * Phosphate removal by harvests: yield (kg DM / ha) × P content (g P2O5 / kg DM) / 1000.
 * The P content of the harvest's own analysis is used when present, otherwise the catalogue value.
 *
 * @param input - The field input (cultivations and harvests).
 * @param details - The cultivation details by `b_lu_catalogue`.
 * @param timeFrame - The timeframe of the balance.
 * @param warnings - Receives the missing data that set the removal to 0 (Dutch, for display).
 * @returns The total (negative) and the removal per harvest.
 * @throws When a harvest has no cultivation details.
 */
export function calculatePhosphateRemovalByHarvests(
  input: PhosphateFieldInput,
  details: Map<string, PhosphateCultivationDetail>,
  timeFrame: { start: Date; end: Date },
  warnings: string[],
) {
  // A harvestable cultivation that ended in the timeframe (or is harvested several times, like
  // grassland) without any harvest gives no removal: report it instead of silently using 0.
  for (const cultivation of input.cultivations) {
    const detail = details.get(cultivation.b_lu_catalogue)
    if (!detail || detail.b_lu_harvestable === "none") continue
    if (input.harvests.some((h) => h.b_lu === cultivation.b_lu)) continue
    const end = cultivation.b_lu_end ? new Date(cultivation.b_lu_end) : null
    const endedInTimeframe = end !== null && end >= timeFrame.start && end <= timeFrame.end
    if (endedInTimeframe || detail.b_lu_harvestable === "multiple") {
      warnings.push(
        `Voor ${cultivation.b_lu_name ?? cultivation.b_lu_catalogue} is in deze periode geen oogst geregistreerd: de afvoer met de oogst is 0.`,
      )
    }
  }

  const items = input.harvests.map((harvest) => {
    const cultivation = input.cultivations.find((c) => c.b_lu === harvest.b_lu)
    const detail = cultivation ? details.get(cultivation.b_lu_catalogue) : undefined
    if (!detail) {
      throw new Error(`Harvest ${harvest.b_id_harvesting} has no corresponding cultivation details`)
    }
    const analyses = harvest.harvestable.harvestable_analyses
    const name = cultivation?.b_lu_name ?? detail.b_lu_catalogue
    const values = (analyses.length > 0 ? analyses : [{}]).map(
      (analysis: { b_lu_yield?: number | null; b_lu_p_harvestable?: number | null }) => {
        const b_lu_yield = analysis.b_lu_yield ?? detail.b_lu_yield
        const b_lu_p_harvestable = analysis.b_lu_p_harvestable ?? detail.b_lu_p_harvestable
        if (b_lu_p_harvestable == null) {
          warnings.push(
            `Voor ${name} is geen fosfaatgehalte bekend in de gewascatalogus: de afvoer met de oogst is op 0 gezet.`,
          )
        }
        if (b_lu_yield == null) {
          warnings.push(`Geen opbrengst bekend voor ${name}: de afvoer met de oogst is op 0 gezet.`)
        }
        return new Decimal(b_lu_yield ?? 0)
          .times(b_lu_p_harvestable ?? 0)
          .dividedBy(1000)
          .times(-1)
      },
    )
    const value = values.reduce((a, b) => a.add(b), new Decimal(0)).dividedBy(values.length)
    return { id: harvest.b_id_harvesting, value }
  })
  return { total: items.reduce((a, b) => a.add(b.value), new Decimal(0)), items }
}
