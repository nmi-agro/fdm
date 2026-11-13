import Decimal from "decimal.js"

/**
 * Converts Decimal values to numbers recursively, rounded to the given number of decimals.
 *
 * @param data - The value to convert: a Decimal, an array or an object containing Decimals.
 * @param decimals - The number of decimals to round to. Defaults to 0 (whole numbers).
 * @returns The value with all Decimals converted to numbers.
 */
export function convertDecimalToNumberRecursive(data: unknown, decimals = 0): unknown {
  if (
    data instanceof Decimal ||
    (typeof data === "object" && data !== null && (data as any).isDecimal)
  ) {
    return decimals === 0
      ? (data as Decimal).round().toNumber()
      : (data as Decimal).toDecimalPlaces(decimals).toNumber()
  }
  if (typeof data === "number") {
    return data
  }
  if (Array.isArray(data)) {
    return data.map((item) => convertDecimalToNumberRecursive(item, decimals))
  }
  if (typeof data === "object" && data !== null && !(data instanceof Date)) {
    const newData: { [key: string]: unknown } = {}
    for (const key in data) {
      if (Object.hasOwn(data, key)) {
        const converted = convertDecimalToNumberRecursive(
          (data as Record<string, unknown>)[key],
          decimals,
        )
        newData[key] = converted
      }
    }
    return newData
  }
  return data
}
