import type {
  PhosphateBalanceField,
  PhosphateSaturationSource,
  YearsClass,
} from "@nmi-agro/fdm-calculator"

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

/** Horizon (years) of the projection; beyond it the trend is shown as "> 20 jaar". */
export const PHOSPHATE_HORIZON_YEARS = 20

/**
 * Whether the balance of a field moves the phosphorus saturation degree (PSD) in the desired
 * direction: `on_track` when the PSD is above the field threshold and decreases, or is at or below
 * it and stays there within the horizon; `off_track` when it is above and does not decrease, or is
 * below and will exceed the threshold within the horizon; `unknown` without PSD or threshold.
 */
export type PhosphateTrendStatus = "on_track" | "off_track" | "unknown"

/**
 * Judges the balance of a field against the PSD aim (the field-specific threshold).
 *
 * @param balance - The phosphate balance of the field.
 * @returns The trend status.
 */
export function getPhosphateTrendStatus(balance: PhosphateBalanceField): PhosphateTrendStatus {
  const psd = balance.projection?.psd
  const threshold = psd?.threshold.value
  if (!psd || threshold === null || threshold === undefined) return "unknown"
  const current = psd.current.value
  const delta = psd.delta_per_year
  if (current > threshold) return delta < 0 ? "on_track" : "off_track"
  const exceedsWithinHorizon = delta > 0 && (threshold - current) / delta <= PHOSPHATE_HORIZON_YEARS
  return exceedsWithinHorizon ? "off_track" : "on_track"
}

/** P-AL bounds (mg P₂O₅ / 100 g): below 25 low, 25–45 medium (target level), above 45 high. */
export const P_AL_LOW = 25
export const P_AL_HIGH = 45

/**
 * Dutch label of the P-AL level.
 *
 * @param pAl - P-AL (mg P₂O₅ / 100 g).
 * @returns "Laag", "Gemiddeld" or "Hoog", with its range.
 */
export function formatPAlLevel(pAl: number): string {
  if (pAl < P_AL_LOW) return `Laag (< ${P_AL_LOW})`
  if (pAl <= P_AL_HIGH) return `Gemiddeld (${P_AL_LOW}–${P_AL_HIGH})`
  return `Hoog (> ${P_AL_HIGH})`
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
  const threshold = psd?.threshold.value
  if (!psd || threshold === null || threshold === undefined) return null
  if (psd.current.value > threshold) {
    return psd.delta_per_year < 0
      ? { label: "Onder de grens over", value: formatYearsClass(psd.years_class) }
      : { label: "Bij dit saldo", value: "Blijft boven de grens" }
  }
  return psd.delta_per_year > 0
    ? { label: "Boven de grens over", value: formatYearsClass(psd.years_class) }
    : { label: "Bij dit saldo", value: "Blijft onder de grens" }
}

/**
 * Dutch description of where the phosphorus saturation degree comes from.
 *
 * @param source - The source.
 * @returns The description.
 */
export function formatSaturationSource(source: PhosphateSaturationSource): string {
  switch (source) {
    case "oxalate":
      return "Berekend uit P-ox, Fe-ox en Al-ox"
    case "a_p_sg":
      return "Fosfaatverzadigingsgraad uit de bodemanalyse"
    case "estimated_from_p_al":
      return "Geschat uit P-AL"
    case "missing":
      return "Onvoldoende gegevens"
  }
}
