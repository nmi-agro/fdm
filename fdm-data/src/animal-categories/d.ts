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
export type CatalogueAnimalCategoryItem = CatalogueAnimalCategory
export type CatalogueAnimalCategoriesName = CatalogueAnimalCategorySource
