import type { CatalogueAnimalCategories, CatalogueAnimalCategorySource } from "./d"
import { getCatalogueRvo } from "./catalogues/rvo"

/**
 * Retrieves an animal-category catalogue.
 *
 * @param catalogueName - The animal-category catalogue source.
 * @returns The requested animal-category catalogue.
 */
export async function getAnimalCategoriesCatalogue(
  catalogueName: CatalogueAnimalCategorySource,
): Promise<CatalogueAnimalCategories> {
  if (catalogueName === "rvo") {
    return await getCatalogueRvo()
  }

  throw new Error(`catalogue ${String(catalogueName)} is not recognized`)
}

export const getAnimalCategoryCatalogue = getAnimalCategoriesCatalogue
