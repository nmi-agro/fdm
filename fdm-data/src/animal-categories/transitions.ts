import type { AnimalCategorySex } from "./d"

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

const female = ["female"] as const
const male = ["male"] as const
const femaleAndMale = ["female", "male"] as const

/**
 * The moves an animal can make to another category, per category it is in. A move follows the
 * life of the animal: it only goes to an older age group or production stage of the same species,
 * never back, and never to another species. Categories that are not listed have no move to another
 * category: an animal in it stays there until it leaves the farm.
 */
const rvoAnimalCategoryTransitions: Readonly<
  Record<string, readonly { to: readonly string[]; l_sex: readonly AnimalCategorySex[] }[]>
> = {
  // Cattle: young stock grows up into a heifer, a breeding bull or a beef animal
  rvo_101: [
    { to: ["rvo_102"], l_sex: female },
    { to: ["rvo_104"], l_sex: male },
    { to: ["rvo_122"], l_sex: femaleAndMale },
  ],
  rvo_102: [{ to: ["rvo_100", "rvo_120"], l_sex: female }],
  // A dairy cow can become a suckler cow and back
  rvo_100: [{ to: ["rvo_120"], l_sex: female }],
  rvo_120: [{ to: ["rvo_100"], l_sex: female }],
  // Veal calves
  rvo_115: [{ to: ["rvo_116"], l_sex: femaleAndMale }],
  // Water buffalo
  rvo_992: [{ to: ["rvo_991"], l_sex: female }],
  // Sheep
  rvo_551: [{ to: ["rvo_552"], l_sex: femaleAndMale }],
  rvo_552: [{ to: ["rvo_550"], l_sex: femaleAndMale }],
  // Goats
  rvo_601: [{ to: ["rvo_602"], l_sex: female }],
  rvo_602: [{ to: ["rvo_600"], l_sex: female }],
  // Red deer for slaughter
  rvo_973: [{ to: ["rvo_974"], l_sex: femaleAndMale }],
  // Pigs: weaned piglets grow into rearing or fattening pigs, rearing pigs into sows or boars
  rvo_407: [{ to: ["rvo_404", "rvo_411"], l_sex: femaleAndMale }],
  rvo_404: [
    { to: ["rvo_400", "rvo_401"], l_sex: female },
    { to: ["rvo_406"], l_sex: male },
  ],
  rvo_400: [{ to: ["rvo_401"], l_sex: female }],
  rvo_401: [{ to: ["rvo_400"], l_sex: female }],
  // Poultry
  rvo_300: [{ to: ["rvo_301"], l_sex: femaleAndMale }],
  rvo_310: [{ to: ["rvo_311"], l_sex: femaleAndMale }],
  // Turkeys
  rvo_200: [{ to: ["rvo_201", "rvo_210"], l_sex: femaleAndMale }],
  rvo_201: [{ to: ["rvo_202"], l_sex: femaleAndMale }],
  // Ducks
  rvo_802: [{ to: ["rvo_803"], l_sex: femaleAndMale }],
}

/**
 * Returns the moves an animal can make from an animal category to another category.
 *
 * @param l_id_category - Identifier of the category the animal is in.
 * @returns The moves to other categories, with the sexes for which each is possible. Empty when the
 *   animal can't move to another category.
 */
export function getAnimalCategoryTransitions(l_id_category: string): AnimalCategoryTransition[] {
  return (rvoAnimalCategoryTransitions[l_id_category] ?? []).flatMap((transition) =>
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
    return [...femaleAndMale]
  }
  const transition = getAnimalCategoryTransitions(from_l_id_category).find(
    (t) => t.l_id_category === to_l_id_category,
  )
  return transition ? transition.l_sex : null
}
