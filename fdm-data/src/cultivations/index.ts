import { getCatalogueBrp } from "./catalogues/brp"
import type { CatalogueCultivation, CatalogueCultivationName } from "./d"

/**
 * Retrieves a cultivation catalogue based on the specified name.
 *
 * This function acts as a dispatcher, selecting and returning the appropriate
 * cultivation catalogue based on the provided `catalogueName`.
 *
 * @param catalogueName - The name of the desired cultivation catalogue.
 *                        Currently supported names are: "brp".
 * @returns An array of `CatalogueCultivationItem` objects representing the
 *          requested cultivation catalogue.
 * @returns A Promise that resolves to an array of `CatalogueCultivationItem` objects.
 * @throws {Error} Throws an error if the provided `catalogueName` is not
 *                 recognized or supported.
 *
 * @example
 * ```typescript
 * const brpCatalogue = await getCultivationCatalogue("brp");
 * console.log(brpCatalogue);
 * ```
 */
export async function getCultivationCatalogue(
  catalogueName: CatalogueCultivationName,
): Promise<CatalogueCultivation> {
  // Get the specified catalogue
  if (catalogueName === "brp") {
    return await getCatalogueBrp()
  }

  throw new Error(`catalogue ${catalogueName} is not recognized`)
}
