import { and, eq } from "drizzle-orm"
import type { FdmType } from "./fdm.types"
import * as schema from "./db/schema"

/** The parts of an animal category that decide which animals fit in it. */
export type AnimalCategory = Pick<
  schema.animalCategoriesCatalogueTypeSelect,
  "l_id_category" | "l_category" | "l_specie" | "l_sex_options"
>

const animalCategoryColumns = {
  l_id_category: schema.animalCategoriesCatalogue.l_id_category,
  l_category: schema.animalCategoriesCatalogue.l_category,
  l_specie: schema.animalCategoriesCatalogue.l_specie,
  l_sex_options: schema.animalCategoriesCatalogue.l_sex_options,
}

/**
 * Looks up an animal category in the catalogue.
 *
 * @param fdm - The FDM instance or transaction.
 * @param l_id_category - Identifier of the animal category.
 * @param b_id_farm - When given, the category must also come from a catalogue enabled for this farm.
 * @returns The animal category.
 * @throws When the category does not exist, or is not enabled for the farm.
 */
export async function getAnimalCategory(
  fdm: FdmType,
  l_id_category: schema.animalCategoriesCatalogueTypeSelect["l_id_category"],
  b_id_farm?: schema.farmsTypeSelect["b_id_farm"],
): Promise<AnimalCategory> {
  const query = fdm.select(animalCategoryColumns).from(schema.animalCategoriesCatalogue)
  const categories = b_id_farm
    ? await query
        .innerJoin(
          schema.animalCategoryCatalogueSelecting,
          eq(
            schema.animalCategoriesCatalogue.l_category_source,
            schema.animalCategoryCatalogueSelecting.l_category_source,
          ),
        )
        .where(
          and(
            eq(schema.animalCategoriesCatalogue.l_id_category, l_id_category),
            eq(schema.animalCategoryCatalogueSelecting.b_id_farm, b_id_farm),
          ),
        )
        .limit(1)
    : await query.where(eq(schema.animalCategoriesCatalogue.l_id_category, l_id_category)).limit(1)

  if (categories.length === 0) {
    throw new Error(
      b_id_farm
        ? `Animal category ${l_id_category} is not enabled for farm ${b_id_farm}`
        : `Animal category ${l_id_category} does not exist`,
    )
  }

  return categories[0]
}

/**
 * Looks up the animal category of a herd.
 *
 * @param fdm - The FDM instance or transaction.
 * @param l_id_herd - Identifier of the herd.
 * @returns The animal category of the herd.
 * @throws When the herd does not exist.
 */
export async function getHerdCategory(
  fdm: FdmType,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
): Promise<AnimalCategory> {
  const herds = await fdm
    .select({ l_id_category: schema.herds.l_id_category })
    .from(schema.herds)
    .where(eq(schema.herds.l_id_herd, l_id_herd))
    .limit(1)

  if (herds.length === 0) {
    throw new Error(`Herd ${l_id_herd} does not exist`)
  }

  return getAnimalCategory(fdm, herds[0].l_id_category)
}

/**
 * Checks that an animal's species and sex fit an animal category.
 *
 * @param category - The animal category.
 * @param l_specie - Species of the animal.
 * @param l_sex - Sex of the animal; not checked when unknown.
 * @throws When the species or sex does not fit the category.
 */
export function assertAnimalMatchesCategory(
  category: AnimalCategory,
  l_specie: schema.animalsTypeSelect["l_specie"],
  l_sex: schema.animalsTypeSelect["l_sex"],
): void {
  if (l_specie !== category.l_specie) {
    throw new Error(
      `Animal species ${l_specie} does not match category ${category.l_id_category} species ${category.l_specie}`,
    )
  }
  if (l_sex && !category.l_sex_options.includes(l_sex)) {
    throw new Error(`Animal sex ${l_sex} is not allowed for category ${category.l_id_category}`)
  }
}
