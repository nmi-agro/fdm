import { checkAnimalCategoryMove, getAnimalSexForCategory } from "@nmi-agro/fdm-core"

/** A herd that animals can move to, and the sex that animals of unknown sex get by moving. */
export interface HerdMoveTarget {
  l_id_herd: string
  /** The sex an animal of unknown sex gets in this herd, or `null` when it stays unknown. */
  l_sex_after: string | null
}

/**
 * Lists the herds that animals can move to, so a form only offers moves fdm-core accepts. An
 * animal moves to another herd of its category, or to a later life stage of its species that its
 * sex allows (see `checkAnimalCategoryMove`). When several animals move together, every one of
 * them must be able to make the move.
 *
 * @param from_l_id_category - Category of the herd the animals are in, or `null` when they are in
 *   no herd.
 * @param sexes - The sex of each animal that moves, `null` when unknown. Empty for a herd without
 *   animals: then only the categories count.
 * @param herds - The herds to choose from, without the herd the animals are in.
 * @returns The herds the animals can move to, in the order given.
 */
export function getHerdMoveTargets(
  from_l_id_category: string | null,
  sexes: Array<string | null>,
  herds: Array<{
    l_id_herd: string
    l_id_category: string
    l_sex_options: string[] | null
  }>,
): HerdMoveTarget[] {
  const moving = sexes.length > 0 ? [...new Set(sexes)] : [null]
  return herds.flatMap((herd) => {
    const to = { l_id_category: herd.l_id_category, l_sex_options: herd.l_sex_options ?? [] }
    let l_sex_after: string | null = null
    for (const sex of moving) {
      let sexAfter: string | null
      if (from_l_id_category) {
        const move = checkAnimalCategoryMove(from_l_id_category, to, sex)
        if (!move.allowed) return []
        sexAfter = move.l_sex
      } else {
        // An animal in no herd joins this one as on arrival
        if (sex && !to.l_sex_options.includes(sex)) return []
        sexAfter = getAnimalSexForCategory(to, sex)
      }
      if (sex === null && sexes.length > 0) {
        l_sex_after = sexAfter
      }
    }
    return [{ l_id_herd: herd.l_id_herd, l_sex_after }]
  })
}
