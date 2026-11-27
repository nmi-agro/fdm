import type { AnimalCategoryCatalogue } from "@nmi-agro/fdm-core"

/** The species of regular grazing animals, the only ones a herd can have for now. */
export const GRAZING_SPECIES: ReadonlyArray<AnimalCategoryCatalogue["l_specie"]> = [
  "cattle",
  "sheep",
  "goat",
  "horse",
  "pony",
]

/** Keeps the categories of grazing animals. */
export function filterGrazingCategories<T extends Pick<AnimalCategoryCatalogue, "l_specie">>(
  categories: T[],
): T[] {
  return categories.filter((c) => GRAZING_SPECIES.includes(c.l_specie))
}

/** Whether the category ID is one of a grazing animal in the given categories. */
export function isGrazingCategory(
  categories: Pick<AnimalCategoryCatalogue, "l_id_category" | "l_specie">[],
  l_id_category: string,
): boolean {
  return filterGrazingCategories(categories).some((c) => c.l_id_category === l_id_category)
}
