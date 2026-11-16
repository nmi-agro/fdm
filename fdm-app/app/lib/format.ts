/** The number formatters of `formatFixed`, per number of decimals. */
const formatters = new Map<number, Intl.NumberFormat>()

/**
 * Formats a number with Dutch separators and a fixed number of decimals, e.g. 1245.06 as "1.245"
 * (0 decimals, the default) and -2.99 as "-3,0" (1 decimal).
 *
 * Use it for the values of the balances, so that whole numbers and decimals are written the same
 * way across cards, details and charts. A negative value that rounds to zero is shown without a
 * minus sign, e.g. -0.04 as "0,0" (1 decimal).
 *
 * @param value - The number to format.
 * @param fractionDigits - The number of decimals. Defaults to 0.
 * @returns The formatted number.
 *
 * @example
 * ```ts
 * formatFixed(1245.06) // "1.245"
 * formatFixed(-2.99, 1) // "-3,0"
 * formatFixed(-0.04, 1) // "0,0"
 * ```
 */
export function formatFixed(value: number, fractionDigits = 0): string {
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
