import type { AppAmountUnit } from "@nmi-agro/fdm-core"

export const applicationUnitOptions = {
  "kg/ha": { label: "kg/ha", totalLabel: "kg" },
  "ton/ha": { label: "ton/ha", totalLabel: "ton" },
  "l/ha": { label: "l/ha", totalLabel: "L" },
  "m3/ha": { label: "m³/ha", totalLabel: "m³" },
} as const

/**
 * Get the pretty-printed mass or volume per area unit for fertilizer applications
 * @param unit unit to get the label for
 * @returns the pretty-printed unit
 */
export function getApplicationAmountUnitLabel(unit: AppAmountUnit) {
  return applicationUnitOptions[unit].label
}

/**
 * Origins of an applied fertilizer, with their Dutch labels. Kept here because browser code
 * cannot import fdm-core at runtime; the values match `applicationOriginOptions` in fdm-core.
 */
export const applicationOriginOptions = [
  { value: "own_production", label: "Eigen bedrijf" },
  { value: "supplied", label: "Aangevoerd" },
  { value: "mixed", label: "Mengsel van eigen en aangevoerd" },
] as const

export type ApplicationOriginValue = (typeof applicationOriginOptions)[number]["value"]

/**
 * RVO manure codes of grazing-animal slurry and solid manure. For these, Table 9 of the Dutch
 * manure policy has different nitrogen working coefficients for manure produced on the farm and
 * manure supplied from outside the farm, so the origin of the application is asked.
 */
const GRAZING_ANIMAL_MANURE_RVO_CODES = new Set([
  // Slurry: cattle (except veal calves), goats, veal calves
  "14",
  "60",
  "18",
  "19",
  // Solid manure: cattle, cattle separation cake, sheep, goats, horses, donkeys, ponies, deer,
  // water buffalo
  "10",
  "13",
  "56",
  "61",
  "25",
  "26",
  "27",
  "95",
  "96",
])

/**
 * Whether the origin of an application of this fertilizer changes the nitrogen working coefficient.
 *
 * @param p_type_rvo - The RVO manure code of the fertilizer.
 * @returns `true` for grazing-animal slurry and solid manure.
 */
export function isOriginRelevant(p_type_rvo: string | null | undefined): boolean {
  return !!p_type_rvo && GRAZING_ANIMAL_MANURE_RVO_CODES.has(p_type_rvo)
}

/**
 * Gets the pretty-printed mass or volume unit for fertilizer applications (for when taking sum of areas times application amounts)
 * @param unit unit to get the corresponding unit for
 * @returns the pretty-printed corresponding mass or volume unit
 */
export function getApplicationAmountTotalUnitLabel(unit: AppAmountUnit) {
  return applicationUnitOptions[unit].totalLabel
}
