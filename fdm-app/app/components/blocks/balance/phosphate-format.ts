import type { PhosphateBalanceField, YearsClass } from "@nmi-agro/fdm-calculator"

/**
 * Formats a number with Dutch notation (decimal comma, dot as thousands separator).
 *
 * @param value - The number to format.
 * @param decimals - Number of decimals (default 0).
 * @returns The formatted number, or "–" when the value is missing.
 */
export function formatNumberNl(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–"
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Unit of the phosphate balance terms. */
export const PHOSPHATE_UNIT = "kg P₂O₅ / ha"

/**
 * Status of a field: is the phosphorus saturation degree (PSD) at or below the field-specific
 * threshold (`ok`), above it (`exceeded`), or unknown?
 */
export type PhosphateSaturationStatus = "ok" | "exceeded" | "unknown"

/**
 * Compares the current PSD of a field with its threshold.
 *
 * @param balance - The phosphate balance of the field.
 * @returns The status.
 */
export function getPhosphateSaturationStatus(
  balance: PhosphateBalanceField,
): PhosphateSaturationStatus {
  const psd = balance.projection?.psd
  const threshold = psd?.threshold.value
  if (!psd || threshold === null || threshold === undefined) return "unknown"
  return psd.current.value > threshold ? "exceeded" : "ok"
}

/**
 * Dutch label of a years class.
 *
 * @param yearsClass - The class.
 * @returns The label.
 */
export function formatYearsClass(yearsClass: YearsClass): string {
  switch (yearsClass) {
    case "reached":
      return "nu al bereikt"
    case "lt_5":
      return "< 5 jaar"
    case "5_10":
      return "5–10 jaar"
    case "10_20":
      return "10–20 jaar"
    case "gt_20":
      return "> 20 jaar"
    case "not_reached":
      return "niet bij dit saldo"
  }
}

/**
 * The time until the PSD crosses the threshold at the current balance, with a short label that
 * says in which direction: back below it (when now above) or above it (when now below).
 *
 * @param balance - The phosphate balance of the field.
 * @returns Label and value, or `null` when the PSD or the threshold is unknown.
 */
export function getPhosphateYearsToThreshold(
  balance: PhosphateBalanceField,
): { label: string; value: string } | null {
  const psd = balance.projection?.psd
  const status = getPhosphateSaturationStatus(balance)
  if (!psd || status === "unknown") return null
  if (status === "exceeded") {
    return {
      label: "Onder de grenswaarde over",
      value: psd.delta_per_year < 0 ? formatYearsClass(psd.years_class) : "niet bij dit saldo",
    }
  }
  return {
    label: "Boven de grenswaarde over",
    value: psd.delta_per_year > 0 ? formatYearsClass(psd.years_class) : "niet bij dit saldo",
  }
}
