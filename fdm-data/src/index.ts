/**
 * A library to extend the Farm Data Model with catalogue data
 *
 * @remarks
 *
 * Created by Nutriënten Management Instituut (www.nmi-agro.nl)
 * Source code available at https://github.com/nmi-agro/fdm
 * In case you find a bug, please report at https://github.com/nmi-agro/fdm/issues
 *
 * @public
 * @packageDocumentation
 */

export { getAnimalCategoriesCatalogue } from "./animal-categories"
export type {
  AnimalCategorySex,
  AnimalCategorySpecies,
  CatalogueAnimalCategorySource,
  CatalogueAnimalCategories,
  CatalogueAnimalCategory,
  CatalogueAnimalCategoryItem,
  CatalogueAnimalCategoryName,
} from "./animal-categories/d"
export { hashAnimalCategory } from "./animal-categories/hash"
export {
  getAnimalCategoryTransitions,
  getAnimalCategoryTransitionSexes,
} from "./animal-categories/transitions"
export type { AnimalCategoryTransition } from "./animal-categories/transitions"
export { parseCattleEartag } from "./animal-identification/cattle-eartag"
export type { CattleEartagResult } from "./animal-identification/cattle-eartag"
export { getCultivationCatalogue, getLastCultivationAvailabilityYear } from "./cultivations"
export type {
  CatalogueCultivation,
  CatalogueCultivationItem,
  CatalogueCultivationName,
} from "./cultivations/d"
export { hashCultivation } from "./cultivations/hash"
export { fertilizerCatalogueNames, getFertilizersCatalogue } from "./fertilizers"
export type {
  ApplicationMethods,
  CatalogueFertilizer,
  CatalogueFertilizerItem,
  CatalogueFertilizerName,
} from "./fertilizers/d"
export { hashFertilizer } from "./fertilizers/hash"
export { feedTypeOptions, getFeedCatalogue } from "./feed"
export type { CatalogueFeed, CatalogueFeedItem, CatalogueFeedName } from "./feed/d"
export { hashFeed } from "./feed/hash"
export { getMeasuresCatalogue } from "./measures"
export type {
  CatalogueMeasure,
  CatalogueMeasureCondition,
  CatalogueMeasureEffectSize,
  CatalogueMeasureImpact,
  CatalogueMeasureItem,
  CatalogueMeasureName,
} from "./measures/d"
export { hashMeasure } from "./measures/hash"
