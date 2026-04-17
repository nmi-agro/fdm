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
            if (
                density === null ||
                density === undefined ||
                new Decimal(0).greaterThanOrEqualTo(density)
            )
                throw new Error(
                    "Positive density (p_density) is required for l/ha → kg/ha conversion",
                )
            return new Decimal(density).times(d).toNumber()
        case "m3/ha":
            if (
                density === null ||
                density === undefined ||
                new Decimal(0).greaterThanOrEqualTo(density)
            )
                throw new Error(
                    "Positive density (p_density) is required for m3/ha → kg/ha conversion",
                )
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