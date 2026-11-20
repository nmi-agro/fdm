import Decimal from "decimal.js"
import type { PhosphateLeaching, PhosphateSaturation, PhosphateSaturationThreshold } from "./types"

/**
 * DRAFT fraction of the phosphate surplus that leaches or runs off, by the phosphorus saturation
 * degree (PSD) relative to the field threshold. Chosen so that the results stay within measured
 * losses: about 0.1–0.5 kg P/ha/year on non-saturated soils (issue FDM-305) and 0.8–2.1 kg P/ha/year
 * measured from open trenches on P-saturated, low-PSC sand with shallow groundwater (up to 1.3–7.5
 * kg P/ha/year estimated for fields with open trenches in the catchment; van Doorn et al. 2026,
 * J. Environ. Qual. 55: e70180). To be reviewed.
 *
 * Known limitation (same paper): losses are driven by the soil P intensity (P-CaCl2, PSD) and the
 * connection to surface water (shallow groundwater, open trenches), also when the balance is negative.
 * A surplus-only estimate therefore misses the loss from an already saturated stock.
 */
const LEACHING_FRACTION: Record<PhosphateLeaching["risk"], number> = {
  low: 0.01, // PSD at or below the threshold
  medium: 0.03, // PSD above the threshold, up to twice the threshold
  high: 0.06, // PSD more than twice the threshold
  unknown: 0.03, // PSD or threshold unknown
}

/** Critical concentration (mg P / L) at which the groundwater factor is 1. */
const C_P_REFERENCE = 0.2

/**
 * Calculates the phosphate leaching (dissolved P to groundwater and drains) from the surplus, in the
 * same way as nitrate leaching in the nitrogen balance (issue FDM-305, decision 4): only when the
 * balance is positive, as surplus × factor, and **not** subtracted from the balance (shown
 * separately). Surface runoff and erosion (particulate P) are not estimated.
 *
 * Factor = fraction by saturation (PSD ÷ threshold: ≤ 1 low 0.01, ≤ 2 medium 0.03, > 2 high 0.06)
 * × groundwater factor (0.2 ÷ critical concentration of the threshold: 2 at a mean highest
 * groundwater level ≤ 25 cm, 0.67 at ≥ 100 cm; shallow groundwater means a fast route to surface
 * water).
 *
 * DRAFT for discussion: there is no published kg/ha relation; the fractions need review (Maarten van
 * Doorn). The loss from the existing stock under a deficit is not estimated.
 *
 * @param balance - The phosphate balance of the field (kg P2O5 / ha for the timeframe).
 * @param saturation - The phosphorus saturation of the field.
 * @param threshold - The PSD threshold of the field (with its critical concentration).
 * @returns The leaching (negative, kg P2O5 / ha) with the factors used.
 * @alpha
 */
export function calculatePhosphateLeaching(
  balance: Decimal,
  saturation: PhosphateSaturation,
  threshold: PhosphateSaturationThreshold,
): PhosphateLeaching {
  const psd = saturation.psd?.value
  let risk: PhosphateLeaching["risk"] = "unknown"
  if (psd !== undefined && threshold.value !== null && threshold.value > 0) {
    const ratio = psd / threshold.value
    risk = ratio <= 1 ? "low" : ratio <= 2 ? "medium" : "high"
  }
  const fraction = LEACHING_FRACTION[risk]
  const groundwater_factor = new Decimal(C_P_REFERENCE)
    .dividedBy(threshold.c_p_env ?? 0.1)
    .toNumber()
  const factor = new Decimal(fraction).times(groundwater_factor)
  const total = balance.gt(0) ? balance.times(factor).times(-1) : new Decimal(0)
  return {
    total: total.toNumber(),
    risk,
    fraction,
    groundwater_factor,
    factor: factor.toNumber(),
  }
}
