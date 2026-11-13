/**
 * Formats a number with Dutch separators and a fixed number of decimals, e.g. 1245.06 as "1.245"
 * (0 decimals, the default) and -2.99 as "-3,0" (1 decimal).
 *
 * Use it for the values of the balances, so that whole numbers and decimals are written the same
 * way across cards, details and charts.
 *
 * @param value - The number to format.
 * @param fractionDigits - The number of decimals. Defaults to 0.
 * @returns The formatted number.
 *
 * @example
 * ```ts
 * formatFixed(1245.06) // "1.245"
 * formatFixed(-2.99, 1) // "-3,0"
 * ```
 */
export function formatFixed(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}
