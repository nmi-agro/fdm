import { getCatalogueBln } from "./catalogues/bln"
import type { CatalogueMeasure, CatalogueMeasureName } from "./d"

/**
 * Retrieves a measures catalogue based on the specified name.
 *
 * This function acts as a dispatcher, selecting and returning the appropriate
 * measures catalogue based on the provided `catalogueName`.
 *
 * @param catalogueName - The name of the desired measures catalogue. Currently
 *                        supported: `"bln"`.
 * @param nmiApiKey - Bearer token for the NMI API (required for all current catalogues).
 * @returns A Promise that resolves to an array of `CatalogueMeasureItem` objects.
 * @throws {Error} Throws an error if the provided `catalogueName` is not recognized.
 *
 * @example
 * ```typescript
 * const blnCatalogue = await getMeasuresCatalogue("bln", apiKey)
 * console.log(blnCatalogue)
 * ```
 */
export async function getMeasuresCatalogue(
    catalogueName: CatalogueMeasureName,
    nmiApiKey: string,
): Promise<CatalogueMeasure> {
    if (catalogueName === "bln") {
        return await getCatalogueBln(nmiApiKey)
    }
    throw new Error(`catalogue ${catalogueName} is not recognized`)
}

