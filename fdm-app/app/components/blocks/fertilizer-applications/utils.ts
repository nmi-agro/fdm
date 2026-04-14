import type { AppAmountUnit } from "@nmi-agro/fdm-core"

export const applicationUnitOptions = {
    "kg/ha": { label: "kg/ha", totalLabel: "kg" },
    "ton/ha": { label: "ton/ha", totalLabel: "ton" },
    "l/ha": { label: "L/ha", totalLabel: "L" },
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
 * Gets the pretty-printed mass or volume unit for fertilizer applications (for when taking sum of areas times application amounts)
 * @param unit unit to get the corresponding unit for
 * @returns the pretty-printed corresponding mass or volume unit
 */
export function getApplicationAmountTotalUnitLabel(unit: AppAmountUnit) {
    return applicationUnitOptions[unit].totalLabel
}
