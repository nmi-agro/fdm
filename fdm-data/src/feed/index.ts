import type { CatalogueFeed, CatalogueFeedName } from "./d"
import { feedTypeOptions, getCatalogueNmi } from "./catalogues/nmi"

/* eslint-disable typescript/restrict-template-expressions -- catalogueName is a string-literal union. */
/**
 * Retrieves a feed catalogue.
 *
 * @param catalogueName - The feed catalogue source.
 * @returns The requested feed catalogue.
 */
export async function getFeedCatalogue(catalogueName: CatalogueFeedName): Promise<CatalogueFeed> {
  if (catalogueName === "nmi") {
    return await getCatalogueNmi()
  }

  throw new Error(`catalogue ${catalogueName} is not recognized`)
}

export { feedTypeOptions }
