export type CatalogueAnimalCategorySource = "rvo"
export type CatalogueAnimalCategoryName = CatalogueAnimalCategorySource

export type AnimalCategorySex = "female" | "male"

export type AnimalCategorySpecies =
  | "cattle"
  | "pig"
  | "poultry"
  | "turkey"
  | "duck"
  | "goat"
  | "sheep"
  | "horse"
  | "pony"
  | "other"

export interface CatalogueAnimalCategory {
  l_category_source: CatalogueAnimalCategorySource
  l_id_category: string
  l_category: string
  l_specie: AnimalCategorySpecies
  l_sex_options: AnimalCategorySex[]
  l_lsu: number
}

export type CatalogueAnimalCategories = CatalogueAnimalCategory[]

/**
 * A move of an animal from its animal category to another one, for example when a heifer calves
 * and joins the dairy cows.
 */
export interface AnimalCategoryTransition {
  /** Identifier of the category the animal moves to. */
  l_id_category: string
  /** The sexes for which this move is possible. */
  l_sex: AnimalCategorySex[]
}

/**
 * The moves between the categories of one animal-category catalogue: per category the animal is
 * in, the categories it can move to and the sexes for which each move is possible. Every
 * catalogue provides one, next to its list of categories.
 */
export type CatalogueAnimalCategoryTransitions = Readonly<
  Record<string, readonly { to: readonly string[]; l_sex: readonly AnimalCategorySex[] }[]>
>
export type CatalogueAnimalCategoryItem = CatalogueAnimalCategory
