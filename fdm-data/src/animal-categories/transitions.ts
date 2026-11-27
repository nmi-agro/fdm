import type {
  AnimalCategorySex,
  AnimalCategoryTransition,
  CatalogueAnimalCategorySource,
  CatalogueAnimalCategoryTransitions,
} from "./d"
import { rvoAnimalCategoryTransitions } from "./catalogues/rvo/transitions"

/**
 * The moves between animal categories, per catalogue. Every catalogue provides its own moves next
 * to its list of categories, in its folder under `catalogues/`; the type makes a new catalogue
 * source fail to compile until its moves are added here.
 */
const catalogueTransitions: Record<
  CatalogueAnimalCategorySource,
  CatalogueAnimalCategoryTransitions
> = {
  rvo: rvoAnimalCategoryTransitions,
}

/**
 * Returns the moves between animal categories of one catalogue, as its folder provides them.
 *
 * @param catalogueName - The animal-category catalogue source.
 * @returns The moves per category of that catalogue.
 */
export function getAnimalCategoryTransitionsCatalogue(
  catalogueName: CatalogueAnimalCategorySource,
): CatalogueAnimalCategoryTransitions {
  const transitions = catalogueTransitions[catalogueName]
  if (!transitions) {
    throw new Error(`catalogue ${String(catalogueName)} is not recognized`)
  }
  return transitions
}

// The moves of all catalogues combined; category identifiers are unique across catalogues, as
// they are the primary key of the catalogue table
const allTransitions = new Map(
  Object.values(catalogueTransitions).flatMap((transitions) => Object.entries(transitions)),
)

/**
 * Returns the moves an animal can make from an animal category to another category, from the
 * catalogue the category belongs to.
 *
 * @param l_id_category - Identifier of the category the animal is in.
 * @returns The moves to other categories, with the sexes for which each is possible. Empty when the
 *   animal can't move to another category.
 */
export function getAnimalCategoryTransitions(l_id_category: string): AnimalCategoryTransition[] {
  return (allTransitions.get(l_id_category) ?? []).flatMap((transition) =>
    transition.to.map((to) => ({ l_id_category: to, l_sex: [...transition.l_sex] })),
  )
}

/**
 * Returns the sexes for which an animal can move from one animal category to another. An animal
 * can always move to another herd of the same category; the sex options of the target category
 * still apply on top of the sexes returned here.
 *
 * @param from_l_id_category - Identifier of the category the animal is in.
 * @param to_l_id_category - Identifier of the category the animal moves to.
 * @returns The sexes for which the move is possible, or `null` when no animal can make it.
 */
export function getAnimalCategoryTransitionSexes(
  from_l_id_category: string,
  to_l_id_category: string,
): AnimalCategorySex[] | null {
  if (from_l_id_category === to_l_id_category) {
    return ["female", "male"]
  }
  const transition = getAnimalCategoryTransitions(from_l_id_category).find(
    (t) => t.l_id_category === to_l_id_category,
  )
  return transition ? transition.l_sex : null
}
