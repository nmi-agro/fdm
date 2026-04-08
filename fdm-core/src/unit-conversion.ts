import Decimal from "decimal.js"

export type AppAmountUnit = "kg/ha" | "l/ha" | "m3/ha" | "ton/ha"

export const APP_AMOUNT_UNITS: { value: AppAmountUnit; label: string }[] = [
    { value: "kg/ha", label: "kg/ha" },
    { value: "l/ha", label: "l/ha" },
    { value: "m3/ha", label: "m3/ha" },
    { value: "ton/ha", label: "ton/ha" },
]

/**
 * Convert a user-entered amount (in display unit) to kg/ha for storage.
 * Uses Decimal.js to avoid floating-point rounding errors.
 * Throws if conversion requires density but density is null/undefined/0.
 */
export function toKgPerHa(
    value: number | Decimal | string,
    unit: AppAmountUnit,
    density?: number | Decimal | null, // kg/l
): Decimal {
    const d = new Decimal(value)
    switch (unit) {
        case "kg/ha":
            return new Decimal(d)
        case "ton/ha":
            return new Decimal(1000).times(d)
        case "l/ha":
            if (!density)
                throw new Error(
                    "Density (p_density) is required for l/ha → kg/ha conversion",
                )
            return new Decimal(density).times(d)
        case "m3/ha":
            if (!density)
                throw new Error(
                    "Density (p_density) is required for m3/ha → kg/ha conversion",
                )
            return new Decimal(1000).times(d).times(density)
        default:
            throw new Error(`${unit} → kg/ha conversion is not supported`)
    }
}

/**
 * Convert a stored kg/ha value back to the preferred display unit.
 * Uses Decimal.js to avoid floating-point rounding errors.
 * Returns null if conversion requires density but density is missing.
 */
export function fromKgPerHa(
    valueKgPerHa: number | Decimal | string,
    unit: AppAmountUnit,
    density?: number | Decimal | null, // kg/l
): Decimal | null {
    const d = new Decimal(valueKgPerHa)
    switch (unit) {
        case "kg/ha":
            return d
        case "ton/ha":
            return d.dividedBy(1000)
        case "l/ha":
            if (!density) return null
            return d.dividedBy(new Decimal(density))
        case "m3/ha":
            if (!density) return null
            return d.dividedBy(new Decimal(density).times(1000))
        default:
            return null
    }
}

/**
 * Suggest a default display unit based on an RVO fertilizer type code.
 * The suggestion is a sensible starting point; the user can always override it.
 *
 * Mapping rationale (RVO mestcode ranges):
 *   - Slurry / drijfmest codes        → m3/ha
 *   - Liquid concentrates / digestate  → l/ha
 *   - Compost / solid organic matter   → ton/ha
 *   - Mineral / other                  → kg/ha (default)
 *
 * The exact code-to-unit mapping should be reviewed with domain experts during
 * implementation and can be updated independently of the rest of the logic.
 */
export function suggestUnitFromRvoCode(p_type_rvo: string): AppAmountUnit {
    // Slurry codes (drijfmest, digestaat) — volume in m3
    const slurryCodes = new Set([
        "10",
        "11",
        "12",
        "13",
        "14",
        "30",
        "31",
        "32",
        "33",
        "34",
    ])
    // Liquid concentrate codes (vloeibare meststoffen) — volume in l
    const liquidCodes = new Set(["115", "116", "120"])
    // Compost / solid organic matter codes — mass in ton
    const compostCodes = new Set(["107", "108", "109", "111", "112"])

    if (slurryCodes.has(p_type_rvo)) return "m3/ha"
    if (liquidCodes.has(p_type_rvo)) return "l/ha"
    if (compostCodes.has(p_type_rvo)) return "ton/ha"
    return "kg/ha"
}
