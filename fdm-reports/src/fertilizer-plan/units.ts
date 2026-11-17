import type { AppAmountUnit } from "@nmi-agro/fdm-core"

const applicationUnitLabels = {
  "kg/ha": { label: "kg/ha", totalLabel: "kg" },
  "ton/ha": { label: "ton/ha", totalLabel: "ton" },
  "l/ha": { label: "l/ha", totalLabel: "L" },
  "m3/ha": { label: "m³/ha", totalLabel: "m³" },
} as const satisfies Record<AppAmountUnit, { label: string; totalLabel: string }>

/**
 * Returns the label of an application amount unit per hectare, for example `m³/ha`.
 *
 * @param unit - The application amount unit.
 * @returns The label.
 */
export function getApplicationAmountUnitLabel(unit: AppAmountUnit): string {
  return applicationUnitLabels[unit].label
}

/**
 * Returns the label of the total amount that belongs to an application unit, for example `m³`
 * for `m3/ha`.
 *
 * @param unit - The application amount unit.
 * @returns The label.
 */
export function getApplicationAmountTotalUnitLabel(unit: AppAmountUnit): string {
  return applicationUnitLabels[unit].totalLabel
}
