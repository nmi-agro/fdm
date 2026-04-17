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
            if (
                density === null ||
                density === undefined ||
                new Decimal(0).greaterThanOrEqualTo(density)
            )
                throw new Error(
                    "Positive density (p_density) is required for l/ha → kg/ha conversion",
                )
            return new Decimal(density).times(d)
        case "m3/ha":
            if (
                density === null ||
                density === undefined ||
                new Decimal(0).greaterThanOrEqualTo(density)
            )
                throw new Error(
                    "Positive density (p_density) is required for m3/ha → kg/ha conversion",
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
    const densityNotProvided =
        density === null ||
        typeof density === "undefined" ||
        new Decimal(0).greaterThanOrEqualTo(density)
    switch (unit) {
        case "kg/ha":
            return d
        case "ton/ha":
            return d.dividedBy(1000)
        case "l/ha":
            if (densityNotProvided) return null
            return d.dividedBy(new Decimal(density))
        case "m3/ha":
            if (densityNotProvided) return null
            return d.dividedBy(new Decimal(density).times(1000))
        default:
            return null
    }
}

/**
 * Suggest a default display unit based on an RVO fertilizer type code.
 * The suggestion is a sensible starting point; the user can always override it.
 *
 * A table of suggestions is provided internally. Callers can pass the table argument to use a different table.
 *
 * The internal table is based on the Tabel 11 mest codes provided by RVO and is based on the rationale:
 *   - Slurry / drijfmest codes        → m3/ha
 *   - Liquid concentrates / digestate  → l/ha
 *   - Compost / solid organic matter   → ton/ha
 *   - Mineral / other                  → kg/ha (default)
 *
 * @param p_type_rvo: mest code to look for
 * @param table: optional: table to use for conversion. The type can be used to add remarks to each item when hardcoding tables.
 */
export function suggestUnitFromRvoCode(
    p_type_rvo: string,
    table = RVO_RECOMMENDED_UNITS,
): AppAmountUnit {
    const rowOrDefault = table.find((row) => row.p_type_rvo === p_type_rvo) ?? {
        p_type_rvo,
        unit: "kg/ha",
    }

    return rowOrDefault.unit
}

export type RvoUnitSuggestionTableItem = {
    p_type_rvo: string
    unit: AppAmountUnit
    type?: string
}

export const RVO_RECOMMENDED_UNITS: RvoUnitSuggestionTableItem[] = [
    // Cattle
    { p_type_rvo: "10", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "11", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "12", type: "slurry", unit: "m3/ha" },
    { p_type_rvo: "13", type: "solid (dikke fractie)", unit: "ton/ha" },
    { p_type_rvo: "14", type: "liquid", unit: "l/ha" },
    { p_type_rvo: "17", type: "slurry", unit: "m3/ha" },
    { p_type_rvo: "18", type: "solid (young calf)", unit: "ton/ha" },
    { p_type_rvo: "19", type: "solid (older meat calf)", unit: "ton/ha" },

    // Turkey
    { p_type_rvo: "23", type: "solid", unit: "ton/ha" },

    // Equines
    { p_type_rvo: "25", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "26", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "27", type: "solid", unit: "ton/ha" },

    // Poultry
    { p_type_rvo: "30", type: "liquid", unit: "l/ha" },
    { p_type_rvo: "31", type: "solid (deep pit)", unit: "ton/ha" },
    { p_type_rvo: "32", type: "solid (mestband)", unit: "ton/ha" },
    { p_type_rvo: "33", type: "solid (mestband + nadroog)", unit: "ton/ha" },
    { p_type_rvo: "35", type: "solid (strooiselstal)", unit: "ton/ha" },

    // Game fowl
    { p_type_rvo: "39", type: "solid", unit: "ton/ha" },

    // Hogs
    { p_type_rvo: "40", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "41", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "42", type: "slurry", unit: "m3/ha" },
    { p_type_rvo: "43", type: "solid (dikke fractie)", unit: "ton/ha" },
    { p_type_rvo: "46", type: "liquid", unit: "l/ha" },
    { p_type_rvo: "50", type: "liquid", unit: "l/ha" },

    // Sheep
    { p_type_rvo: "56", type: "solid", unit: "ton/ha" },

    // Goat
    { p_type_rvo: "60", type: "liquid", unit: "l/ha" },
    { p_type_rvo: "61", type: "solid", unit: "ton/ha" },

    // Nerts / Mink
    { p_type_rvo: "75", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "76", type: "liquid", unit: "l/ha" },

    // Ducks
    { p_type_rvo: "80", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "81", type: "liquid", unit: "l/ha" },

    // Rabbit
    { p_type_rvo: "90", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "91", type: "liquid (very diluted)", unit: "l/ha" },
    { p_type_rvo: "92", type: "liquid", unit: "l/ha" },

    // Deer
    { p_type_rvo: "95", type: "solid", unit: "ton/ha" },

    // Water buffalo
    { p_type_rvo: "96", type: "solid", unit: "ton/ha" },

    // Other birds
    { p_type_rvo: "97", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "98", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "99", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "100", type: "solid", unit: "ton/ha" },

    // Rodents
    { p_type_rvo: "101", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "102", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "103", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "104", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "105", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "106", type: "solid", unit: "ton/ha" },

    // Compost
    { p_type_rvo: "107", type: "solid (phase 1)", unit: "ton/ha" },
    { p_type_rvo: "108", type: "solid (phase 2)", unit: "ton/ha" },
    { p_type_rvo: "109", type: "solid (phase 3)", unit: "ton/ha" },
    { p_type_rvo: "110", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "111", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "112", type: "solid", unit: "ton/ha" },
    { p_type_rvo: "117", type: "solid", unit: "ton/ha" },

    // Other
    { p_type_rvo: "113", type: "liquid sewage", unit: "l/ha" },
    { p_type_rvo: "114", type: "solid sewage", unit: "ton/ha" },
    { p_type_rvo: "115", type: "other", unit: "kg/ha" },
    { p_type_rvo: "116", type: "other", unit: "kg/ha" },

    // Maybe non-standard
    { p_type_rvo: "120", type: "other - mineral concentrate", unit: "kg/ha" },
]
