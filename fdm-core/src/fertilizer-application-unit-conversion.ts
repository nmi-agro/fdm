/* eslint-disable typescript/restrict-template-expressions -- Number, Decimal, and string union literals are intentionally formatted in template strings and serialize safely. */
import Decimal from "decimal.js"

export type AppAmountUnit = "kg/ha" | "l/ha" | "m3/ha" | "ton/ha"

export const APP_AMOUNT_UNITS: { value: AppAmountUnit; label: string }[] = [
  { value: "kg/ha", label: "kg/ha" },
  { value: "l/ha", label: "l/ha" },
  { value: "m3/ha", label: "m³/ha" },
  { value: "ton/ha", label: "ton/ha" },
]

/**
 * Convert a user-entered amount (in display unit) to kg/ha for storage.
 *
 * Uses Decimal.js to avoid floating-point rounding errors.
 * Throws if conversion requires density but density is null/undefined/0.
 *
 * @param value The value to convert.
 * @param unit The display unit of the value.
 * @param density The density of the fertilizer in kg/l. Required for volume-based units.
 * @returns The converted value in kg/ha.
 * @alpha
 */
export function toKgPerHa(
  value: number | Decimal | string,
  unit: AppAmountUnit,
  density?: number | Decimal | null, // kg/l
): number {
  const d = new Decimal(value)
  switch (unit) {
    case "kg/ha":
      return new Decimal(d).toNumber()
    case "ton/ha":
      return new Decimal(1000).times(d).toNumber()
    case "l/ha":
      if (density === null || density === undefined || new Decimal(0).greaterThanOrEqualTo(density))
        throw new Error("Positive density (p_density) is required for l/ha → kg/ha conversion")
      return new Decimal(density).times(d).toNumber()
    case "m3/ha":
      if (density === null || density === undefined || new Decimal(0).greaterThanOrEqualTo(density))
        throw new Error("Positive density (p_density) is required for m3/ha → kg/ha conversion")
      return new Decimal(1000).times(d).times(density).toNumber()
    default:
      throw new Error(`${unit} → kg/ha conversion is not supported`)
  }
}

/**
 * Convert a stored kg/ha value back to the preferred display unit.
 *
 * Uses Decimal.js to avoid floating-point rounding errors.
 * Returns null if conversion requires density but density is missing.
 *
 * @param valueKgPerHa The value in kg/ha to convert.
 * @param unit The target display unit.
 * @param density The density of the fertilizer in kg/l. Required for volume-based units.
 * @returns The converted value in the target unit, or null if density is missing.
 * @alpha
 */
export function fromKgPerHa(
  valueKgPerHa: number | Decimal | string,
  unit: AppAmountUnit,
  density?: number | Decimal | null, // kg/l
): number | null {
  const d = new Decimal(valueKgPerHa)
  const densityNotProvided =
    density === null ||
    typeof density === "undefined" ||
    new Decimal(0).greaterThanOrEqualTo(density)
  switch (unit) {
    case "kg/ha":
      return d.toNumber()
    case "ton/ha":
      return d.dividedBy(1000).toNumber()
    case "l/ha":
      if (densityNotProvided) return null
      return d.dividedBy(new Decimal(density)).toNumber()
    case "m3/ha":
      if (densityNotProvided) return null
      return d.dividedBy(new Decimal(density).times(1000)).toNumber()
    default:
      return null
  }
}

/**
 * Maximum applied amount of a fertilizer application, in kg/ha (inclusive).
 *
 * The applied amount (`p_app_amount`) must be greater than 0 and at most this value.
 * @alpha
 */
export const P_APP_AMOUNT_MAX = 100_000

/**
 * Error thrown when the applied amount of a fertilizer application, converted to kg/ha, is not
 * greater than 0 or is greater than {@link P_APP_AMOUNT_MAX}.
 *
 * Callers can recognise it with `instanceof` or by its `name`, also when it is the `cause` of a
 * wrapping error.
 * @alpha
 */
export class AppAmountOutOfRangeError extends Error {
  /** The applied amount in kg/ha that was rejected. */
  public readonly p_app_amount: number

  /**
   * @param p_app_amount The rejected applied amount in kg/ha.
   */
  constructor(p_app_amount: number) {
    super(
      `Applied amount must be greater than 0 and at most ${P_APP_AMOUNT_MAX} kg/ha, received ${p_app_amount} kg/ha`,
    )
    this.name = "AppAmountOutOfRangeError"
    this.p_app_amount = p_app_amount
  }
}

/**
 * Checks whether an applied amount in kg/ha lies in the accepted range
 * (0 < `p_app_amount` ≤ {@link P_APP_AMOUNT_MAX}).
 *
 * @param p_app_amount The applied amount in kg/ha.
 * @returns `true` when the amount is accepted.
 * @alpha
 */
export function isAppAmountInRange(p_app_amount: number): boolean {
  return Number.isFinite(p_app_amount) && p_app_amount > 0 && p_app_amount <= P_APP_AMOUNT_MAX
}

/**
 * Returns the maximum applied amount in the display unit of a fertilizer, so that a form can
 * check the entered value and show the limit in the unit the user sees.
 *
 * The lower bound is exclusive 0 in every unit.
 *
 * @param unit The display unit of the fertilizer (`p_app_amount_unit`).
 * @param density The density of the fertilizer in kg/l. Required for volume-based units.
 * @returns The maximum in the display unit, or `null` when the density needed for the
 * conversion is missing.
 * @alpha
 */
export function getAppAmountDisplayRange(
  unit: AppAmountUnit,
  density?: number | Decimal | null,
): { max: number } | null {
  const max = fromKgPerHa(P_APP_AMOUNT_MAX, unit, density)
  return max === null ? null : { max }
}
