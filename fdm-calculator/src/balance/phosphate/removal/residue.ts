import Decimal from "decimal.js"
import type { PhosphateCultivationDetail, PhosphateFieldInput } from "../types"

/**
 * Phosphate removal by crop residues, only when they are removed (`m_cropresidue === false`):
 * average yield / harvest index × (1 − harvest index) × b_lu_p_residue / 1000.
 *
 * @param input - The field input (cultivations and harvests).
 * @param details - The cultivation details by `b_lu_catalogue`.
 * @returns The total (negative) and the removal per cultivation.
 */
export function calculatePhosphateRemovalByResidues(
  input: PhosphateFieldInput,
  details: Map<string, PhosphateCultivationDetail>,
) {
  const items = input.cultivations.map((cultivation) => {
    const detail = details.get(cultivation.b_lu_catalogue)
    if (!detail || cultivation.m_cropresidue !== false || !detail.b_lu_hi) {
      return { id: cultivation.b_lu, value: new Decimal(0) }
    }
    const yields = input.harvests
      .filter((h) => h.b_lu === cultivation.b_lu)
      .map(
        (h) =>
          h.harvestable.harvestable_analyses.find((a) => a.b_lu_yield != null)?.b_lu_yield ??
          detail.b_lu_yield ??
          0,
      )
    const b_lu_yield =
      yields.length > 0
        ? yields.reduce((a, b) => a.add(b), new Decimal(0)).dividedBy(yields.length)
        : new Decimal(detail.b_lu_yield ?? 0)
    const value = b_lu_yield
      .dividedBy(detail.b_lu_hi)
      .times(new Decimal(1).minus(detail.b_lu_hi))
      .times(detail.b_lu_p_residue ?? 0)
      .dividedBy(1000)
      .times(-1)
    return { id: cultivation.b_lu, value }
  })
  return { total: items.reduce((a, b) => a.add(b.value), new Decimal(0)), items }
}
