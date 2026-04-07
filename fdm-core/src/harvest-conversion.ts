import { Decimal } from "decimal.js"
import type * as schema from "./db/schema"
import type { StandardHarvestParameters } from "./harvest-conversion.types"

/**
 * Converts harvest parameters from different harvest categories to a standardized format.
 *
 * This function takes various harvest parameters, which may vary depending on the
 * harvest category (`b_lu_harvestcat`), and converts them into a standard set of
 * parameters: `b_lu_yield` (dry matter yield) and `b_lu_n_harvestable` (nitrogen content).
 *
 * @param b_lu_harvestcat - The harvest category code, which determines the conversion logic.
 * @param [b_lu_yield] - The yield in kg dry matter per hectare.
 * @param [b_lu_yield_bruto] - The gross yield in kg per hectare.
 * @param [b_lu_yield_fresh] - The fresh yield in kg per hectare.
 * @param [b_lu_tarra] - The percentage of tare (non-usable material).
 * @param [b_lu_moist] - The moisture content as a percentage.
 * @param [b_lu_uww] - The underwater weight in grams per 5 kg.
 * @param [b_lu_dm] - The dry matter content in g/kg.
 * @param [b_lu_cp] - The crude protein content in g/kg dry matter.
 * @param [b_lu_n_harvestable] - The nitrogen content in g N per kg dry matter.
 * @returns An object containing the standardized harvest parameters (`b_lu_yield` and `b_lu_n_harvestable`).
 *          If the category is unknown, it returns zero for both values.
 */
export function convertHarvestParameters(
    b_lu_harvestcat: schema.cultivationsCatalogueTypeSelect["b_lu_harvestcat"],
    b_lu_yield?: schema.harvestableAnalysesTypeInsert["b_lu_yield"],
    b_lu_yield_bruto?: schema.harvestableAnalysesTypeInsert["b_lu_yield_bruto"],
    b_lu_yield_fresh?: schema.harvestableAnalysesTypeInsert["b_lu_yield_fresh"],
    b_lu_tarra?: schema.harvestableAnalysesTypeInsert["b_lu_tarra"],
    b_lu_moist?: schema.harvestableAnalysesTypeInsert["b_lu_moist"],
    b_lu_uww?: schema.harvestableAnalysesTypeInsert["b_lu_uww"],
    b_lu_dm?: schema.harvestableAnalysesTypeInsert["b_lu_dm"],
    b_lu_cp?: schema.harvestableAnalysesTypeInsert["b_lu_cp"],
    b_lu_n_harvestable?: schema.harvestableAnalysesTypeInsert["b_lu_n_harvestable"],
): StandardHarvestParameters {
    switch (b_lu_harvestcat) {
        case "HC010": // Standard
            return convertHarvestParametersForClassHC010(
                b_lu_yield_fresh,
                b_lu_dm,
                b_lu_n_harvestable,
            )
        case "HC020": // Grassland
            return convertHarvestParametersForClassHC020(b_lu_yield, b_lu_cp)
        case "HC031": // Maize
            return convertHarvestParametersForClassHC031(b_lu_yield, b_lu_cp)
        case "HC040": // Root crops
            return convertHarvestParametersForClassHC040(
                b_lu_yield_bruto,
                b_lu_tarra,
                b_lu_dm,
                b_lu_n_harvestable,
            )
        case "HC041": // Sugar beet
            return convertHarvestParametersForClassHC041(
                b_lu_yield_bruto,
                b_lu_tarra,
                b_lu_dm,
                b_lu_n_harvestable,
            )
        case "HC042": // Potatoes
            return convertHarvestParametersForClassHC042(
                b_lu_yield_bruto,
                b_lu_tarra,
                b_lu_uww,
                b_lu_n_harvestable,
            )
        case "HC050": // Cereals
            return convertHarvestParametersForClassHC050(
                b_lu_yield_fresh,
                b_lu_moist,
                b_lu_cp,
            )
        default:
            // Return zero values for unknown categories
            return {
                b_lu_yield: 0,
                b_lu_n_harvestable: 0,
            }
    }
}

/**
 * Converts harvest parameters for harvest category HC010 (Standard).
 *
 * @param b_lu_yield_fresh - The fresh yield in kg per hectare.
 * @param b_lu_dm - The dry matter content in g/kg.
 * @param b_lu_n_harvestable - The nitrogen content in g N per kg dry matter.
 * @returns Standardized harvest parameters.
 * @throws If required parameters are missing.
 */
function convertHarvestParametersForClassHC010(
    b_lu_yield_fresh: schema.harvestableAnalysesTypeInsert["b_lu_yield_fresh"],
    b_lu_dm: schema.harvestableAnalysesTypeInsert["b_lu_dm"],
    b_lu_n_harvestable: schema.harvestableAnalysesTypeInsert["b_lu_n_harvestable"],
): StandardHarvestParameters {
    // Check if the required parameters are present
    if (b_lu_yield_fresh == null) {
        throw new Error(
            "Missing required parameter for HC010: b_lu_yield_fresh",
        )
    }
    if (b_lu_dm == null) {
        throw new Error("Missing required parameter for HC010: b_lu_dm")
    }
    if (b_lu_n_harvestable == null) {
        throw new Error(
            "Missing required parameter for HC010: b_lu_n_harvestable",
        )
    }

    // Calculate b_lu_yield (dry matter yield)
    const b_lu_yield_calculated = new Decimal(b_lu_yield_fresh)
        .times(Decimal(b_lu_dm))
        .dividedBy(1000) // Convert g/kg to kg/kg
        .round()
        .toNumber()

    // Return the calculated values
    return {
        b_lu_yield: b_lu_yield_calculated,
        b_lu_n_harvestable: b_lu_n_harvestable,
    }
}

/**
 * Converts harvest parameters for harvest category HC020 (Grassland).
 *
 * @param b_lu_yield - The yield in kg dry matter per hectare.
 * @param b_lu_cp - The crude protein content in g/kg dry matter.
 * @returns Standardized harvest parameters.
 * @throws If required parameters are missing.
 */
function convertHarvestParametersForClassHC020(
    b_lu_yield: schema.harvestableAnalysesTypeInsert["b_lu_yield"],
    b_lu_cp: schema.harvestableAnalysesTypeInsert["b_lu_cp"],
): StandardHarvestParameters {
    // Check if the required parameters are present
    if (b_lu_yield == null) {
        throw new Error("Missing required parameter for HC020: b_lu_yield")
    }
    if (b_lu_cp == null) {
        throw new Error("Missing required parameter for HC020: b_lu_cp")
    }

    // Calculate b_lu_n_harvestable (Nitrogen content in harvestable yield)
    // Assuming CP (Crude Protein) is approximately N * 6.25
    const b_lu_n_harvestable_calculated = new Decimal(b_lu_cp)
        .dividedBy(6.25)
        .round()
        .toNumber()

    // Return the calculated values
    return {
        b_lu_yield: b_lu_yield,
        b_lu_n_harvestable: b_lu_n_harvestable_calculated,
    }
}

/**
 * Converts harvest parameters for harvest category HC031 (LMaize).
 *
 * @param b_lu_yield - The yield in kg dry matter per hectare.
 * @param b_lu_cp - The crude protein content in g/kg dry matter.
 * @returns Standardized harvest parameters.
 * @throws If required parameters are missing.
 */
function convertHarvestParametersForClassHC031(
    b_lu_yield: schema.harvestableAnalysesTypeInsert["b_lu_yield"],
    b_lu_cp: schema.harvestableAnalysesTypeInsert["b_lu_cp"],
): StandardHarvestParameters {
    // Check if the required parameters are present
    if (b_lu_yield == null) {
        throw new Error("Missing required parameter for HC031: b_lu_yield")
    }
    if (b_lu_cp == null) {
        throw new Error("Missing required parameter for HC031: b_lu_cp")
    }

    // Calculate b_lu_n_harvestable (Nitrogen content in harvestable yield)
    // Assuming CP (Crude Protein) is approximately N * 6.25
    const b_lu_n_harvestable_calculated = new Decimal(b_lu_cp)
        .dividedBy(6.25)
        .round()
        .toNumber()

    // Return the calculated values
    return {
        b_lu_yield: b_lu_yield,
        b_lu_n_harvestable: b_lu_n_harvestable_calculated,
    }
}

/**
 * Converts harvest parameters for harvest category HC040 (Root crops).
 *
 * @param b_lu_yield_bruto - The gross yield in kg per hectare.
 * @param b_lu_tarra - The percentage of tare.
 * @param b_lu_dm - The dry matter content in g/kg.
 * @param b_lu_n_harvestable - The nitrogen content in g N per kg dry matter.
 * @returns Standardized harvest parameters.
 * @throws If required parameters are missing.
 */
function convertHarvestParametersForClassHC040(
    b_lu_yield_bruto: schema.harvestableAnalysesTypeInsert["b_lu_yield_bruto"],
    b_lu_tarra: schema.harvestableAnalysesTypeInsert["b_lu_tarra"],
    b_lu_dm: schema.harvestableAnalysesTypeInsert["b_lu_dm"],
    b_lu_n_harvestable: schema.harvestableAnalysesTypeInsert["b_lu_n_harvestable"],
): StandardHarvestParameters {
    // Check if the required parameters are present
    if (b_lu_yield_bruto == null) {
        throw new Error(
            "Missing required parameter for HC040: b_lu_yield_bruto",
        )
    }
    if (b_lu_tarra == null) {
        throw new Error("Missing required parameter for HC040: b_lu_tarra")
    }
    if (b_lu_dm == null) {
        throw new Error("Missing required parameter for HC040: b_lu_dm")
    }
    if (b_lu_n_harvestable == null) {
        throw new Error(
            "Missing required parameter for HC040: b_lu_n_harvestable",
        )
    }

    // Calculate fresh yield from gross yield and tare
    const b_lu_yield_fresh = new Decimal(100)
        .minus(b_lu_tarra)
        .dividedBy(100)
        .times(b_lu_yield_bruto)
    // Calculate dry matter yield
    const b_lu_yield = b_lu_yield_fresh
        .times(b_lu_dm)
        .dividedBy(1000) // Convert g/kg to kg/kg
        .round()
        .toNumber()

    // Return the calculated values
    return {
        b_lu_yield: b_lu_yield,
        b_lu_n_harvestable: b_lu_n_harvestable,
    }
}

/**
 * Converts harvest parameters for harvest category HC041 (Sugar beets).
 *
 * @param b_lu_yield_bruto - The gross yield in kg per hectare.
 * @param b_lu_tarra - The percentage of tare.
 * @param b_lu_dm - The dry matter content in g/kg.
 * @param b_lu_n_harvestable - The nitrogen content in g N per kg dry matter.
 * @returns Standardized harvest parameters.
 * @throws If required parameters are missing.
 */
function convertHarvestParametersForClassHC041(
    b_lu_yield_bruto: schema.harvestableAnalysesTypeInsert["b_lu_yield_bruto"],
    b_lu_tarra: schema.harvestableAnalysesTypeInsert["b_lu_tarra"],
    b_lu_dm: schema.harvestableAnalysesTypeInsert["b_lu_dm"],
    b_lu_n_harvestable: schema.harvestableAnalysesTypeInsert["b_lu_n_harvestable"],
): StandardHarvestParameters {
    // Check if the required parameters are present
    if (b_lu_yield_bruto == null) {
        throw new Error(
            "Missing required parameter for HC041: b_lu_yield_bruto",
        )
    }
    if (b_lu_tarra == null) {
        throw new Error("Missing required parameter for HC041: b_lu_tarra")
    }
    if (b_lu_dm == null) {
        throw new Error("Missing required parameter for HC041: b_lu_dm")
    }
    if (b_lu_n_harvestable == null) {
        throw new Error(
            "Missing required parameter for HC041: b_lu_n_harvestable",
        )
    }

    // Calculate fresh yield from gross yield and tare
    const b_lu_yield_fresh = new Decimal(100)
        .minus(b_lu_tarra)
        .dividedBy(100)
        .times(b_lu_yield_bruto)
    // Calculate dry matter yield
    const b_lu_yield = b_lu_yield_fresh
        .times(b_lu_dm)
        .dividedBy(1000) // Convert g/kg to kg/kg
        .round()
        .toNumber()

    // Return the calculated values
    return {
        b_lu_yield: b_lu_yield,
        b_lu_n_harvestable: b_lu_n_harvestable,
    }
}

/**
 * Converts harvest parameters for harvest category HC042 (Potatoes).
 *
 * @param b_lu_yield_bruto - The gross yield in kg per hectare.
 * @param b_lu_tarra - The percentage of tare.
 * @param b_lu_uww - The underwater weight in grams.
 * @param b_lu_n_harvestable - The nitrogen content in g N per kg dry matter.
 * @returns Standardized harvest parameters.
 * @throws If required parameters are missing.
 */
function convertHarvestParametersForClassHC042(
    b_lu_yield_bruto: schema.harvestableAnalysesTypeInsert["b_lu_yield_bruto"],
    b_lu_tarra: schema.harvestableAnalysesTypeInsert["b_lu_tarra"],
    b_lu_uww: schema.harvestableAnalysesTypeInsert["b_lu_uww"],
    b_lu_n_harvestable: schema.harvestableAnalysesTypeInsert["b_lu_n_harvestable"],
): StandardHarvestParameters {
    // Check if the required parameters are present
    if (b_lu_yield_bruto == null) {
        throw new Error(
            "Missing required parameter for HC042: b_lu_yield_bruto",
        )
    }
    if (b_lu_tarra == null) {
        throw new Error("Missing required parameter for HC042: b_lu_tarra")
    }
    if (b_lu_uww == null) {
        throw new Error("Missing required parameter for HC042: b_lu_uww")
    }
    if (b_lu_n_harvestable == null) {
        throw new Error(
            "Missing required parameter for HC042: b_lu_n_harvestable",
        )
    }

    // Calculate dry matter content (g/kg) from underwater weight (g)
    // Formula from Ludwig, 1972 (https://edepot.wur.nl/368270 page 11)
    const b_lu_dm = new Decimal(b_lu_uww).times(0.049).add(2.0).times(10)

    // Calculate fresh yield from gross yield and tare
    const b_lu_yield_fresh = new Decimal(100)
        .minus(b_lu_tarra)
        .dividedBy(100)
        .times(b_lu_yield_bruto)
    // Calculate dry matter yield
    const b_lu_yield = b_lu_yield_fresh
        .times(b_lu_dm)
        .dividedBy(1000) // Convert g/kg to kg/kg
        .round()
        .toNumber()

    // Return the calculated values
    return {
        b_lu_yield: b_lu_yield,
        b_lu_n_harvestable: b_lu_n_harvestable,
    }
}

/**
 * Converts harvest parameters for harvest category HC050 (Cereals).
 *
 * @param b_lu_yield_fresh - The fresh yield in kg per hectare.
 * @param b_lu_moist - The moisture content as a percentage.
 * @param b_lu_cp - The crude protein content in g/kg dry matter.
 * @returns Standardized harvest parameters.
 * @throws If required parameters are missing.
 */
function convertHarvestParametersForClassHC050(
    b_lu_yield_fresh: schema.harvestableAnalysesTypeInsert["b_lu_yield_fresh"],
    b_lu_moist: schema.harvestableAnalysesTypeInsert["b_lu_moist"],
    b_lu_cp: schema.harvestableAnalysesTypeInsert["b_lu_cp"],
): StandardHarvestParameters {
    // Check if the required parameters are present
    if (b_lu_yield_fresh == null) {
        throw new Error(
            "Missing required parameter for HC050: b_lu_yield_fresh",
        )
    }
    if (b_lu_moist == null) {
        throw new Error("Missing required parameter for HC050: b_lu_moist")
    }
    if (b_lu_cp == null) {
        throw new Error("Missing required parameter for HC050: b_lu_cp")
    }

    // Calculate dry matter content (g/kg) from moisture percentage
    const b_lu_dm = new Decimal(100).minus(b_lu_moist).times(10)

    // Calculate dry matter yield
    const b_lu_yield_calculated = new Decimal(b_lu_yield_fresh)
        .times(b_lu_dm)
        .dividedBy(1000) // Convert g/kg to kg/kg
        .round()
        .toNumber()

    // Calculate b_lu_n_harvestable (Nitrogen content in harvestable yield)
    // Assuming CP (Crude Protein) is approximately N * 5.7 for cereals
    const b_lu_n_harvestable_calculated = new Decimal(b_lu_cp)
        .dividedBy(5.7)
        .round()
        .toNumber()

    // Return the calculated values
    return {
        b_lu_yield: b_lu_yield_calculated,
        b_lu_n_harvestable: b_lu_n_harvestable_calculated,
    }
}
