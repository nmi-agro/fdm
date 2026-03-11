import { type Field, withCalculationCache } from "@nmi-agro/fdm-core"
import pkg from "../../../../package"
import { getGeoTiffValue } from "../../../../shared/geotiff"
import { getFdmPublicDataUrl } from "../../../../shared/public-data-url"
import type { DierlijkeMestGebruiksnormResult } from "../../types"
import { isFieldInNVGebied } from "./stikstofgebruiksnorm"
import type { NL2025NormsInput } from "./types.d"

/**
 * Determines if a field is located within a grondwaterbeschermingsgebied (GWBG) in the Netherlands.
 * This is achieved by querying a GeoTIFF file that delineates GWBG areas.
 * The function checks the value at the field's centroid coordinates.
 *
 * @param b_centroid - An array containing the `longitude` and `latitude` of the field's centroid.
 *   This point is used to query the GeoTIFF data.
 * @returns A promise that resolves to `true` if the GeoTIFF value at the centroid is 1 (indicating it is within a GWBG area),
 *   and `false` if the value is 0.
 * @throws {Error} If the GeoTIFF returns an unexpected value, or if there are issues fetching or processing the file.
 */
export async function isFieldInGWGBGebied(
    b_centroid: Field["b_centroid"],
): Promise<boolean> {
    const fdmPublicDataUrl = getFdmPublicDataUrl()
    const url = `${fdmPublicDataUrl}norms/nl/2024/gwbg.tiff`
    const longitude = b_centroid[0]
    const latitude = b_centroid[1]
    const gwbgCode = await getGeoTiffValue(url, longitude, latitude)

    switch (gwbgCode) {
        case 1: {
            return true
        }
        case 0: {
            return false
        }
        default: {
            return false
        }
    }
}

/**
 * Determines if a field is located within a Natura 2000 area in the Netherlands.
 * This is achieved by querying a GeoTIFF file that delineates Natura 2000 areas.
 * The function checks the value at the field's centroid coordinates.
 *
 * @param b_centroid - An array containing the `longitude` and `latitude` of the field's centroid.
 *   This point is used to query the GeoTIFF data.
 * @returns A promise that resolves to `true` if the GeoTIFF value at the centroid is 1 (indicating it is within a Natura 2000 area),
 *   and `false` if the value is 0.
 * @throws {Error} If the GeoTIFF returns an unexpected value, or if there are issues fetching or processing the file.
 */
export async function isFieldInNatura2000Gebied(
    b_centroid: Field["b_centroid"],
): Promise<boolean> {
    const fdmPublicDataUrl = getFdmPublicDataUrl()
    const url = `${fdmPublicDataUrl}norms/nl/2024/natura2000.tiff`
    const longitude = b_centroid[0]
    const latitude = b_centroid[1]
    const natura2000Code = await getGeoTiffValue(url, longitude, latitude)

    switch (natura2000Code) {
        case 1: {
            return true
        }
        case 0: {
            return false
        }
        default: {
            return false
        }
    }
}

/**
 * Determines if a field is located within a "derogatie-vrije zone" (derogation-free zone) in the Netherlands.
 * This is achieved by querying a GeoTIFF file that delineates these zones.
 * The function checks the value at the field's centroid coordinates.
 *
 * @param b_centroid - An array containing the `longitude` and `latitude` of the field's centroid.
 *   This point is used to query the GeoTIFF data.
 * @returns A promise that resolves to `true` if the GeoTIFF value at the centroid is 1 (indicating it is within a derogatie-vrije zone),
 *   and `false` if the value is 0.
 * @throws {Error} If the GeoTIFF returns an unexpected value, or if there are issues fetching or processing the file.
 */
export async function isFieldInDerogatieVrijeZone(
    b_centroid: Field["b_centroid"],
): Promise<boolean> {
    const fdmPublicDataUrl = getFdmPublicDataUrl()
    const url = `${fdmPublicDataUrl}norms/nl/2025/derogatievrije_zones.tiff`
    const longitude = b_centroid[0]
    const latitude = b_centroid[1]
    const derogatieVrijeZoneCode = await getGeoTiffValue(
        url,
        longitude,
        latitude,
    )

    switch (derogatieVrijeZoneCode) {
        case 1: {
            return true
        }
        case 0: {
            return false
        }
        default: {
            return false
        }
    }
}

/**
 * Determines the 'gebruiksnorm' (usage standard) for nitrogen from animal manure
 * for a given farm and parcel in the Netherlands for the year 2025.
 *
 * This function implements the rules and norms specified by the RVO for 2025,
 * taking into account derogation status and location within NV-gebieden.
 *
 * @param input - An object containing all necessary parameters for the calculation.
 *   See {@link DierlijkeMestGebruiksnormInput} for details.
 * @returns An object of type `DierlijkeMestGebruiksnormResult` containing the determined
 *   nitrogen usage standard (`normValue`) and a `normSource` string explaining the rule applied.
 *
 * @remarks
 * The rules for 2025 are as follows:
 * - **Standard Norm (No Derogation)**: If the farm does NOT have a derogation permit,
 *   the norm is 170 kg N/ha from animal manure.
 * - **Derogation Norm (With Derogation)**: If the farm HAS a derogation permit:
 *   - **Inside Natura2000-Gebied**: If the parcel is located in a Natura200-Gebied or within 100m of it,
 *     the norm is 170 kg N/ha from animal manure.
 *   - **Inside GWBG-Gebied**: If the parcel is located in a GWBG Gebied or within 100m of it,
 *     the norm is 170 kg N/ha from animal manure.
 *   - **Inside NV-Gebied**: If the parcel is located in a Nutriënt-Verontreinigd Gebied,
 *     the norm is 190 kg N/ha from animal manure.
 *   - **Outside NV-Gebied**: If the parcel is NOT located in a Nutriënt-Verontreinigd Gebied,
 *     the norm is 200 kg N/ha from animal manure.
 *
 * @see {@link https://www.rvo.nl/onderwerpen/mest/gebruiken-en-uitrijden/dierlijke-mest-landbouwgrond | RVO Hoeveel dierlijke mest landbouwgrond (official page)}
 * @see {@link https://www.rvo.nl/onderwerpen/mest/derogatie | RVO Derogatie (official page)}
 * @see {@link https://www.rvo.nl/onderwerpen/mest/met-nutrienten-verontreinigde-gebieden-nv-gebieden | RVO Met nutriënten verontreinigde gebieden (NV-gebieden) (official page)}
 */
export async function calculateNL2025DierlijkeMestGebruiksNorm(
    input: NL2025NormsInput,
): Promise<DierlijkeMestGebruiksnormResult> {
    const is_derogatie_bedrijf = input.farm.is_derogatie_bedrijf ?? false
    const field = input.field

    // Check for buffer strip
    if (field.b_bufferstrip) {
        return {
            normValue: 0,
            normSource: "Bufferstrook: geen plaatsingsruimte",
        }
    }

    const [
        is_nv_gebied,
        is_gwbg_gebied,
        is_natura2000_gebied,
        is_derogatie_vrije_zone,
    ] = await Promise.all([
        isFieldInNVGebied(field.b_centroid),
        isFieldInGWGBGebied(field.b_centroid),
        isFieldInNatura2000Gebied(field.b_centroid),
        isFieldInDerogatieVrijeZone(field.b_centroid),
    ])

    let normValue: number
    let normSource: string

    if (is_derogatie_bedrijf) {
        if (is_natura2000_gebied) {
            normValue = 170
            normSource = "Derogatie - Natura2000 Gebied"
        } else if (is_gwbg_gebied) {
            normValue = 170
            normSource = "Derogatie - Grondwaterbeschermingsgebied"
        } else if (is_derogatie_vrije_zone) {
            normValue = 170
            normSource = "Derogatie - Derogatie-vrije zone"
        } else if (is_nv_gebied) {
            normValue = 190
            normSource = "Derogatie - NV Gebied"
        } else {
            normValue = 200
            normSource = "Derogatie"
        }
    } else {
        normValue = 170
        normSource = "Standaard - geen derogatie"
    }

    return { normValue, normSource }
}

/**
 * Memoized version of {@link calculateNL2025DierlijkeMestGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2025NormsInput} input - An object containing all necessary parameters for the calculation.
 * @returns {Promise<DierlijkeMestGebruiksnormResult>} An object of type `DierlijkeMestGebruiksnormResult` containing the determined
 *   nitrogen usage standard (`normValue`) and a `normSource` string explaining the rule applied.
 */
export const getNL2025DierlijkeMestGebruiksNorm = withCalculationCache(
    calculateNL2025DierlijkeMestGebruiksNorm,
    "calculateNL2025DierlijkeMestGebruiksNorm",
    pkg.calculatorVersion,
)
