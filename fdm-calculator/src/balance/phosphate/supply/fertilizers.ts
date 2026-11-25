import Decimal from "decimal.js"
import type { PhosphateFertilizerDetail, PhosphateFieldInput } from "../types"

/** Fertilizer types of the phosphate balance, from `p_type`. */
export type PhosphateFertilizerType = "mineral" | "manure" | "compost" | "other"

/**
 * Phosphate supply by fertilizers: amount (kg / ha) × p_p_rt (g P2O5 / kg) / 1000, at 100% (no
 * working coefficient). A fertilizer without a phosphate content (e.g. a nitrogen fertilizer) adds
 * nothing.
 *
 * @param applications - The fertilizer applications of the field.
 * @param details - The fertilizer details by `p_id_catalogue`.
 * @returns The total, the total per fertilizer type and the supply per application.
 * @throws When an application has no fertilizer details.
 */
export function calculatePhosphateSupplyByFertilizers(
  applications: PhosphateFieldInput["fertilizerApplications"],
  details: Map<string, PhosphateFertilizerDetail>,
) {
  const totals: Record<PhosphateFertilizerType, Decimal> = {
    mineral: new Decimal(0),
    manure: new Decimal(0),
    compost: new Decimal(0),
    other: new Decimal(0),
  }
  const items = applications.map(
    (application): { id: string; value: Decimal; type: PhosphateFertilizerType } => {
      const detail = details.get(application.p_id_catalogue)
      if (!detail) {
        throw new Error(
          `Fertilizer application ${application.p_app_id} has no fertilizerDetails for fertilizer ${application.p_id_catalogue}`,
        )
      }
      const value = new Decimal(application.p_app_amount ?? 0)
        .times(detail.p_p_rt ?? 0)
        .dividedBy(1000)
      const type =
        detail.p_type === "mineral" || detail.p_type === "manure" || detail.p_type === "compost"
          ? detail.p_type
          : "other"
      totals[type] = totals[type].add(value)
      return { id: application.p_app_id, value, type }
    },
  )
  const total = totals.mineral.add(totals.manure).add(totals.compost).add(totals.other)
  return { total, totals, items }
}
