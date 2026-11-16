/** The number formatters of `formatFixed`, per number of decimals. */
const formatters = new Map<number, Intl.NumberFormat>()

/**
 * Formats a number with Dutch separators and a fixed number of decimals. A negative value that
 * rounds to zero is shown without a minus sign.
 */
function formatFixed(value: number, fractionDigits: number): string {
  let formatter = formatters.get(fractionDigits)
  if (!formatter) {
    formatter = new Intl.NumberFormat("nl-NL", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    formatters.set(fractionDigits, formatter)
  }
  // A value that rounds to zero is formatted as zero, so that it gets no minus sign
  const roundsToZero = Math.abs(value) * 10 ** fractionDigits < 0.5
  return formatter.format(roundsToZero ? 0 : value)
}

/**
 * Formats a value of a balance with Dutch separators, as a whole number, but with one decimal when
 * it is between 0 and 5 and not a whole number, so that a small value, such as an N₂O emission,
 * does not show as 0. A value that rounds to zero is shown as "0".
 *
 * Use it for all values of the balances, so that they are written the same way across cards,
 * details and charts.
 *
 * @param value - The value to format.
 * @returns The formatted value.
 *
 * @example
 * ```ts
 * formatBalanceValue(1245.06) // "1.245"
 * formatBalanceValue(-1.34) // "-1,3"
 * formatBalanceValue(3) // "3"
 * formatBalanceValue(-0.04) // "0"
 * ```
 */
export function formatBalanceValue(value: number): string {
  const roundedToOneDecimal = Math.round(Math.abs(value) * 10) / 10
  const showDecimal =
    roundedToOneDecimal > 0 && roundedToOneDecimal < 5 && !Number.isInteger(roundedToOneDecimal)
  return formatFixed(value, showDecimal ? 1 : 0)
}

/**
 * Formats a difference between two balance values like {@link formatBalanceValue}, with a plus sign
 * when it is positive.
 *
 * @param value - The difference to format.
 * @returns The formatted difference.
 *
 * @example
 * ```ts
 * formatBalanceDifference(12.4) // "+12"
 * formatBalanceDifference(-1.34) // "-1,3"
 * formatBalanceDifference(0.02) // "0"
 * ```
 */
export function formatBalanceDifference(value: number): string {
  const formatted = formatBalanceValue(value)
  return value > 0 && formatted !== "0" ? `+${formatted}` : formatted
}
