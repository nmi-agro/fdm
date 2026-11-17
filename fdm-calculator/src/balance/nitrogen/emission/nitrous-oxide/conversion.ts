import Decimal from "decimal.js"
import { GWP_N2O, N2O_N_TO_N2O } from "./constants"

/**
 * Converts an N₂O emission (kg N / ha, as N₂O-N) to the CO₂-equivalent (kg CO₂-eq / ha), using the
 * molar mass ratio of N₂O to N₂O-N (44 / 28) and a global warming potential of 265 (IPCC AR5).
 *
 * @param nitrousOxide - The N₂O emission in kg N / ha (as N₂O-N); the sign is ignored.
 * @returns The CO₂-equivalent in kg CO₂-eq / ha, zero or positive.
 *
 * @example
 * ```ts
 * convertNitrousOxideToCo2Equivalent(new Decimal(-1))
 * // Decimal(416.43)
 * ```
 */
export function convertNitrousOxideToCo2Equivalent(nitrousOxide: Decimal): Decimal {
  return nitrousOxide.abs().times(N2O_N_TO_N2O).times(GWP_N2O)
}

/**
 * Returns an amount of nitrogen as a (negative) emission, without returning a negative zero.
 *
 * @param value - The amount of nitrogen emitted (kg N / ha); the sign is ignored.
 * @returns The emission as a negative value, or zero.
 *
 * @example
 * ```ts
 * toEmission(new Decimal(0.35)) // Decimal(-0.35)
 * ```
 */
export function toEmission(value: Decimal): Decimal {
  return value.isZero() ? new Decimal(0) : value.abs().neg()
}
