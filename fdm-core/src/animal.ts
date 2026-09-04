import { and, asc, count, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm"
import type {
  Animal,
  AnimalAssignmentHistory,
  AnimalCategoryCatalogue,
  HerdCensus,
} from "./animal.types"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import { getEnabledAnimalCategoryCatalogues } from "./catalogues"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"

/**
 * Retrieves animal categories from the catalogues selected for a farm.
 */
export async function getAnimalCategoriesForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<AnimalCategoryCatalogue[]> {
  try {
    const sources = await getEnabledAnimalCategoryCatalogues(fdm, principal_id, b_id_farm)
    return await getAnimalCategoriesFromCatalogues(fdm, sources)
  } catch (err) {
    throw handleError(err, "Exception for getAnimalCategoriesForFarm", {
      principal_id,
      b_id_farm,
    })
  }
}

/**
 * Retrieves animal categories from the specified catalogue sources.
 *
 * No permission check is performed because catalogue rows are shared reference data.
 */
export async function getAnimalCategoriesFromCatalogues(
  fdm: FdmType,
  sources: schema.animalCategoryCatalogueSelectingTypeSelect["l_category_source"][],
): Promise<AnimalCategoryCatalogue[]> {
  try {
    if (sources.length === 0) {
      return []
    }

    return await fdm
      .select()
      .from(schema.animalCategoriesCatalogue)
      .where(inArray(schema.animalCategoriesCatalogue.l_category_source, sources))
      .orderBy(
        asc(schema.animalCategoriesCatalogue.l_category_source),
        asc(schema.animalCategoriesCatalogue.l_category),
      )
  } catch (err) {
    throw handleError(err, "Exception for getAnimalCategoriesFromCatalogues", { sources })
  }
}

export const getAnimalCategoriesFromCatalogue = getAnimalCategoriesForFarm

type AnimalCategory = Pick<
  schema.animalCategoriesCatalogueTypeSelect,
  "l_id_category" | "l_specie" | "l_sex_options"
>

async function getAnimalCategory(
  fdm: FdmType,
  l_id_category: schema.animalCategoriesCatalogueTypeSelect["l_id_category"],
): Promise<AnimalCategory> {
  const categories = await fdm
    .select({
      l_id_category: schema.animalCategoriesCatalogue.l_id_category,
      l_specie: schema.animalCategoriesCatalogue.l_specie,
      l_sex_options: schema.animalCategoriesCatalogue.l_sex_options,
    })
    .from(schema.animalCategoriesCatalogue)
    .where(eq(schema.animalCategoriesCatalogue.l_id_category, l_id_category))
    .limit(1)

  if (categories.length === 0) {
    throw new Error(`Animal category ${l_id_category} does not exist`)
  }

  return categories[0]
}

async function getHerdCategory(
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
  if (!herds[0].l_id_category) {
    throw new Error(`Herd ${l_id_herd} has no animal category`)
  }

  return getAnimalCategory(fdm, herds[0].l_id_category)
}

function assertAnimalMatchesCategory(
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

/**
 * Adds a single individual animal asset to a farm and assigns it to an active herd.
 * For animals born on the farm,
 * l_birth_date and l_arriving_date must be equal.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal adding the animal.
 * @param b_id_farm - Identifier of the farm.
 * @param l_id_herd - Identifier of the herd to assign the animal to.
 * @param properties - Optional details for the animal.
 * @returns Unique identifier of the new animal.
 */
export async function addAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  properties?: {
    l_id_eartag?: schema.animalsTypeInsert["l_id_eartag"]
    l_id_worknumber?: schema.animalsTypeInsert["l_id_worknumber"]
    l_specie?: schema.animalsTypeInsert["l_specie"]
    l_breed?: schema.animalsTypeInsert["l_breed"]
    l_coatcolor?: schema.animalsTypeInsert["l_coatcolor"]
    l_birth_date?: schema.animalsTypeInsert["l_birth_date"]
    l_sex?: schema.animalsTypeInsert["l_sex"]
    l_arriving_method?: schema.animalArrivingTypeInsert["l_arriving_method"]
    l_arriving_date?: schema.animalArrivingTypeInsert["l_arriving_date"]
    l_leaving_date?: schema.animalLeavingTypeInsert["l_leaving_date"]
    l_leaving_method?: schema.animalLeavingTypeInsert["l_leaving_method"]
  },
): Promise<schema.animalsTypeSelect["l_id_animal"]> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "addAnimal")

    return await fdm.transaction(async (tx) => {
      const herdFarm = await tx
        .select({ b_id_farm: schema.herdStarting.b_id_farm })
        .from(schema.herdStarting)
        .where(eq(schema.herdStarting.l_id_herd, l_id_herd))
        .limit(1)

      if (herdFarm.length === 0 || herdFarm[0].b_id_farm !== b_id_farm) {
        throw new Error(`Herd ${l_id_herd} does not belong to farm ${b_id_farm}`)
      }

      const category = await getHerdCategory(tx, l_id_herd)
      const l_specie = properties?.l_specie ?? category.l_specie
      const l_sex = properties?.l_sex ?? null
      assertAnimalMatchesCategory(category, l_specie, l_sex)

      await lockFarmWorknumbers(tx, b_id_farm)
      const l_id_animal = createId()
      const arrivingMethod = properties?.l_arriving_method ?? "born"
      let birthdate = properties?.l_birth_date ?? null
      let arrivingDate = properties?.l_arriving_date ?? birthdate ?? new Date()
      const l_id_worknumber =
        properties?.l_id_worknumber ?? String(await getNextWorknumber(tx, b_id_farm))

      if (properties?.l_id_worknumber) {
        await assertWorknumberAvailable(tx, b_id_farm, properties.l_id_worknumber)
      }

      if (arrivingMethod === "born") {
        if (birthdate && properties?.l_arriving_date) {
          if (new Date(birthdate).getTime() !== new Date(properties.l_arriving_date).getTime()) {
            throw new Error(
              "l_birth_date and l_arriving_date must be equal when l_arriving_method is 'born'",
            )
          }
        }
        if (!birthdate) {
          birthdate = arrivingDate
        } else {
          arrivingDate = birthdate
        }
      }

      await tx.insert(schema.animals).values({
        l_id_animal,
        l_id_eartag: properties?.l_id_eartag ?? null,
        l_id_worknumber,
        l_specie,
        l_breed: properties?.l_breed ?? null,
        l_coatcolor: properties?.l_coatcolor ?? null,
        l_birth_date: birthdate,
        l_sex,
      })

      await tx.insert(schema.animalArriving).values({
        l_id_animal,
        b_id_farm,
        l_arriving_date: arrivingDate,
        l_arriving_method: arrivingMethod,
      })

      await tx.insert(schema.animalAssigning).values({
        l_id_animal,
        l_id_herd,
        l_assigning_start: arrivingDate,
        l_assigning_end: null,
      })

      if (properties?.l_leaving_date) {
        await tx.insert(schema.animalLeaving).values({
          l_id_animal,
          l_leaving_date: properties.l_leaving_date,
          l_leaving_method: properties.l_leaving_method ?? null,
        })
      }

      return l_id_animal
    })
  } catch (err) {
    throw handleError(err, "Exception for addAnimal", { b_id_farm, l_id_herd, properties })
  }
}

/**
 * Retrieves details for a specific animal.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting animal details.
 * @param l_id_animal - Animal ID.
 * @returns Animal details object.
 */
export async function getAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
): Promise<Animal> {
  try {
    await checkPermission(fdm, "animal", "read", l_id_animal, principal_id, "getAnimal")

    const rows = await fdm
      .select({
        l_id_animal: schema.animals.l_id_animal,
        l_id_eartag: schema.animals.l_id_eartag,
        l_id_worknumber: schema.animals.l_id_worknumber,
        l_specie: schema.animals.l_specie,
        l_breed: schema.animals.l_breed,
        l_coatcolor: schema.animals.l_coatcolor,
        l_birth_date: schema.animals.l_birth_date,
        l_sex: schema.animals.l_sex,
        b_id_farm: schema.animalArriving.b_id_farm,
        l_arriving_method: schema.animalArriving.l_arriving_method,
        l_arriving_date: schema.animalArriving.l_arriving_date,
        l_leaving_date: schema.animalLeaving.l_leaving_date,
        l_leaving_method: schema.animalLeaving.l_leaving_method,
        l_id_herd: schema.animalAssigning.l_id_herd,
        l_id_category: schema.herds.l_id_category,
        l_category: schema.animalCategoriesCatalogue.l_category,
        l_sex_options: schema.animalCategoriesCatalogue.l_sex_options,
        l_lsu: schema.animalCategoriesCatalogue.l_lsu,
        created: schema.animals.created,
        updated: schema.animals.updated,
      })
      .from(schema.animals)
      .innerJoin(
        schema.animalArriving,
        eq(schema.animals.l_id_animal, schema.animalArriving.l_id_animal),
      )
      .leftJoin(
        schema.animalLeaving,
        eq(schema.animals.l_id_animal, schema.animalLeaving.l_id_animal),
      )
      .leftJoin(
        schema.animalAssigning,
        and(
          eq(schema.animals.l_id_animal, schema.animalAssigning.l_id_animal),
          isNull(schema.animalAssigning.l_assigning_end),
        ),
      )
      .leftJoin(schema.herds, eq(schema.animalAssigning.l_id_herd, schema.herds.l_id_herd))
      .leftJoin(
        schema.animalCategoriesCatalogue,
        eq(schema.herds.l_id_category, schema.animalCategoriesCatalogue.l_id_category),
      )
      .where(eq(schema.animals.l_id_animal, l_id_animal))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Animal does not exist")
    }

    return rows[0] as Animal
  } catch (err) {
    throw handleError(err, "Exception for getAnimal", { l_id_animal })
  }
}

/**
 * Retrieves all animals currently assigned to a herd.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting animals.
 * @param l_id_herd - Herd ID.
 * @returns Array of active animals in the herd.
 */
export async function getAnimalsForHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
): Promise<Animal[]> {
  try {
    await checkPermission(fdm, "herd", "read", l_id_herd, principal_id, "getAnimalsForHerd")

    const rows = await fdm
      .select({
        l_id_animal: schema.animals.l_id_animal,
        l_id_eartag: schema.animals.l_id_eartag,
        l_id_worknumber: schema.animals.l_id_worknumber,
        l_specie: schema.animals.l_specie,
        l_breed: schema.animals.l_breed,
        l_coatcolor: schema.animals.l_coatcolor,
        l_birth_date: schema.animals.l_birth_date,
        l_sex: schema.animals.l_sex,
        b_id_farm: schema.animalArriving.b_id_farm,
        l_arriving_method: schema.animalArriving.l_arriving_method,
        l_arriving_date: schema.animalArriving.l_arriving_date,
        l_leaving_date: schema.animalLeaving.l_leaving_date,
        l_leaving_method: schema.animalLeaving.l_leaving_method,
        l_id_herd: schema.animalAssigning.l_id_herd,
        l_id_category: schema.herds.l_id_category,
        l_category: schema.animalCategoriesCatalogue.l_category,
        l_sex_options: schema.animalCategoriesCatalogue.l_sex_options,
        l_lsu: schema.animalCategoriesCatalogue.l_lsu,
        created: schema.animals.created,
        updated: schema.animals.updated,
      })
      .from(schema.animals)
      .innerJoin(
        schema.animalArriving,
        eq(schema.animals.l_id_animal, schema.animalArriving.l_id_animal),
      )
      .innerJoin(
        schema.animalAssigning,
        and(
          eq(schema.animals.l_id_animal, schema.animalAssigning.l_id_animal),
          eq(schema.animalAssigning.l_id_herd, l_id_herd),
          isNull(schema.animalAssigning.l_assigning_end),
        ),
      )
      .innerJoin(schema.herds, eq(schema.animalAssigning.l_id_herd, schema.herds.l_id_herd))
      .leftJoin(
        schema.animalCategoriesCatalogue,
        eq(schema.herds.l_id_category, schema.animalCategoriesCatalogue.l_id_category),
      )
      .leftJoin(
        schema.animalLeaving,
        eq(schema.animals.l_id_animal, schema.animalLeaving.l_id_animal),
      )
      .where(isNull(schema.animalLeaving.l_leaving_date))
      .orderBy(desc(schema.animals.created))

    return rows as Animal[]
  } catch (err) {
    throw handleError(err, "Exception for getAnimalsForHerd", { l_id_herd })
  }
}

/**
 * Retrieves all animals belonging to a farm.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting animals.
 * @param b_id_farm - Farm ID.
 * @param atDate - Optional status date. The default is the current timestamp.
 * @returns Array of animals present on the farm at the status date.
 */
export async function getAnimalsForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  atDate = new Date(),
): Promise<Animal[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getAnimalsForFarm")

    const rows = await fdm
      .select({
        l_id_animal: schema.animals.l_id_animal,
        l_id_eartag: schema.animals.l_id_eartag,
        l_id_worknumber: schema.animals.l_id_worknumber,
        l_specie: schema.animals.l_specie,
        l_breed: schema.animals.l_breed,
        l_coatcolor: schema.animals.l_coatcolor,
        l_birth_date: schema.animals.l_birth_date,
        l_sex: schema.animals.l_sex,
        b_id_farm: schema.animalArriving.b_id_farm,
        l_arriving_method: schema.animalArriving.l_arriving_method,
        l_arriving_date: schema.animalArriving.l_arriving_date,
        l_leaving_date: schema.animalLeaving.l_leaving_date,
        l_leaving_method: schema.animalLeaving.l_leaving_method,
        l_id_herd: schema.animalAssigning.l_id_herd,
        l_id_category: schema.herds.l_id_category,
        l_category: schema.animalCategoriesCatalogue.l_category,
        l_sex_options: schema.animalCategoriesCatalogue.l_sex_options,
        l_lsu: schema.animalCategoriesCatalogue.l_lsu,
        created: schema.animals.created,
        updated: schema.animals.updated,
      })
      .from(schema.animals)
      .innerJoin(
        schema.animalArriving,
        and(
          eq(schema.animals.l_id_animal, schema.animalArriving.l_id_animal),
          eq(schema.animalArriving.b_id_farm, b_id_farm),
        ),
      )
      .leftJoin(
        schema.animalLeaving,
        eq(schema.animals.l_id_animal, schema.animalLeaving.l_id_animal),
      )
      .leftJoin(
        schema.animalAssigning,
        and(
          eq(schema.animals.l_id_animal, schema.animalAssigning.l_id_animal),
          lte(schema.animalAssigning.l_assigning_start, atDate),
          or(
            isNull(schema.animalAssigning.l_assigning_end),
            gt(schema.animalAssigning.l_assigning_end, atDate),
          ),
        ),
      )
      .leftJoin(schema.herds, eq(schema.animalAssigning.l_id_herd, schema.herds.l_id_herd))
      .leftJoin(
        schema.animalCategoriesCatalogue,
        eq(schema.herds.l_id_category, schema.animalCategoriesCatalogue.l_id_category),
      )
      .where(
        and(
          or(isNull(schema.animalArriving.l_arriving_date), lte(schema.animalArriving.l_arriving_date, atDate)),
          or(isNull(schema.animalLeaving.l_leaving_date), gt(schema.animalLeaving.l_leaving_date, atDate)),
        ),
      )
      .orderBy(desc(schema.animals.created))

    return rows as Animal[]
  } catch (err) {
    throw handleError(err, "Exception for getAnimalsForFarm", { b_id_farm, atDate })
  }
}

/**
 * Retrieves the complete herd-assignment history for an animal.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the history.
 * @param l_id_animal - Animal ID.
 * @returns Assignment intervals ordered newest first.
 */
export async function getAnimalAssignmentHistory(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
): Promise<AnimalAssignmentHistory[]> {
  try {
    await checkPermission(
      fdm,
      "animal",
      "read",
      l_id_animal,
      principal_id,
      "getAnimalAssignmentHistory",
    )

    const rows = await fdm
      .select({
        l_id_herd: schema.animalAssigning.l_id_herd,
        l_herd_name: schema.herds.l_herd_name,
        l_id_category: schema.herds.l_id_category,
        l_category: schema.animalCategoriesCatalogue.l_category,
        l_specie: schema.animalCategoriesCatalogue.l_specie,
        l_sex_options: schema.animalCategoriesCatalogue.l_sex_options,
        l_lsu: schema.animalCategoriesCatalogue.l_lsu,
        l_assigning_start: schema.animalAssigning.l_assigning_start,
        l_assigning_end: schema.animalAssigning.l_assigning_end,
      })
      .from(schema.animalAssigning)
      .innerJoin(schema.herds, eq(schema.animalAssigning.l_id_herd, schema.herds.l_id_herd))
      .leftJoin(
        schema.animalCategoriesCatalogue,
        eq(schema.herds.l_id_category, schema.animalCategoriesCatalogue.l_id_category),
      )
      .where(eq(schema.animalAssigning.l_id_animal, l_id_animal))
      .orderBy(desc(schema.animalAssigning.l_assigning_start))

    return rows as AnimalAssignmentHistory[]
  } catch (err) {
    throw handleError(err, "Exception for getAnimalAssignmentHistory", { l_id_animal })
  }
}

/**
 * Updates properties of an existing animal. Setting `l_leaving_date` and/or
 * `l_leaving_method` records that the animal left the farm (upserted into
 * `animal_leaving`) and closes its currently active herd assignment (if any)
 * with `l_assigning_end` set to `l_leaving_date`.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal updating the animal.
 * @param l_id_animal - Animal ID.
 * @param properties - Properties to update.
 */
export async function updateAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  properties: {
    l_id_eartag?: schema.animalsTypeInsert["l_id_eartag"]
    l_id_worknumber?: schema.animalsTypeInsert["l_id_worknumber"]
    l_specie?: schema.animalsTypeInsert["l_specie"]
    l_breed?: schema.animalsTypeInsert["l_breed"]
    l_coatcolor?: schema.animalsTypeInsert["l_coatcolor"]
    l_birth_date?: schema.animalsTypeInsert["l_birth_date"]
    l_sex?: schema.animalsTypeInsert["l_sex"]
    l_leaving_date?: schema.animalLeavingTypeInsert["l_leaving_date"]
    l_leaving_method?: schema.animalLeavingTypeInsert["l_leaving_method"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "updateAnimal")

    const { l_leaving_date, l_leaving_method, ...animalProperties } = properties
    const updated = new Date()

    await fdm.transaction(async (tx) => {
      if (properties.l_specie !== undefined || properties.l_sex !== undefined) {
        const assignments = await tx
          .select({
            l_id_herd: schema.animalAssigning.l_id_herd,
          })
          .from(schema.animalAssigning)
          .where(eq(schema.animalAssigning.l_id_animal, l_id_animal))

        const current = await tx
          .select({
            l_specie: schema.animals.l_specie,
            l_sex: schema.animals.l_sex,
          })
          .from(schema.animals)
          .where(eq(schema.animals.l_id_animal, l_id_animal))
          .limit(1)

        if (current.length === 0) {
          throw new Error("Animal does not exist")
        }

        const targetSpecie = properties.l_specie ?? current[0].l_specie
        const targetSex = properties.l_sex === undefined ? current[0].l_sex : properties.l_sex

        for (const assign of assignments) {
          const category = await getHerdCategory(tx, assign.l_id_herd)
          assertAnimalMatchesCategory(category, targetSpecie, targetSex)
        }
      }

      await tx
        .update(schema.animals)
        .set({ ...animalProperties, updated })
        .where(eq(schema.animals.l_id_animal, l_id_animal))

      if (l_leaving_date !== undefined || l_leaving_method !== undefined) {
        await tx
          .insert(schema.animalLeaving)
          .values({
            l_id_animal,
            l_leaving_date: l_leaving_date ?? null,
            l_leaving_method: l_leaving_method ?? null,
          })
          .onConflictDoUpdate({
            target: schema.animalLeaving.l_id_animal,
            set: { l_leaving_date, l_leaving_method, updated },
          })

        if (l_leaving_date) {
          await tx
            .update(schema.animalAssigning)
            .set({ l_assigning_end: l_leaving_date, updated })
            .where(
              and(
                eq(schema.animalAssigning.l_id_animal, l_id_animal),
                isNull(schema.animalAssigning.l_assigning_end),
              ),
            )
        }
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for updateAnimal", { l_id_animal, properties })
  }
}

/**
 * Hard-deletes an animal and all of its own history rows (`animal_arriving`,
 * `animal_assigning`, `animal_leaving`, `milking_animal`, `feeding_animal`).
 * This erases the animal's record entirely — to record that an animal left
 * the farm while preserving its history, use {@link updateAnimal} with
 * `l_leaving_date`/`l_leaving_method` instead.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the animal.
 * @param l_id_animal - Animal ID.
 */
export async function removeAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "removeAnimal")

    await fdm.transaction(async (tx) => {
      await tx.delete(schema.milkingAnimal).where(eq(schema.milkingAnimal.l_id_animal, l_id_animal))
      await tx.delete(schema.feedingAnimal).where(eq(schema.feedingAnimal.l_id_animal, l_id_animal))
      await tx.delete(schema.animalLeaving).where(eq(schema.animalLeaving.l_id_animal, l_id_animal))
      await tx
        .delete(schema.animalAssigning)
        .where(eq(schema.animalAssigning.l_id_animal, l_id_animal))
      await tx.delete(schema.animalArriving).where(eq(schema.animalArriving.l_id_animal, l_id_animal))
      await tx.delete(schema.animals).where(eq(schema.animals.l_id_animal, l_id_animal))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeAnimal", { l_id_animal })
  }
}

/**
 * Adds `count` new animals to a herd with shared default attributes.
 * Pure add — does not remove or reassign any existing animals. Use
 * {@link leaveHerd} or an explicit individual departure when animals leave.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal executing the bulk add.
 * @param l_id_herd - Herd ID to add the new animals to.
 * @param count - Number of new animals to create.
 * @param defaults - Optional default attributes shared by all newly created animals.
 * @returns IDs of the newly created animals.
 */
export async function addAnimalsToHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  count: number,
  defaults?: {
    l_specie?: schema.animalsTypeInsert["l_specie"]
    l_breed?: schema.animalsTypeInsert["l_breed"]
    l_arriving_method?: schema.animalArrivingTypeInsert["l_arriving_method"]
  },
): Promise<string[]> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "addAnimalsToHerd")

    return await fdm.transaction(async (tx) => {
      const herdRow = await tx
        .select({ b_id_farm: schema.herdStarting.b_id_farm })
        .from(schema.herdStarting)
        .where(eq(schema.herdStarting.l_id_herd, l_id_herd))
        .limit(1)

      if (herdRow.length === 0) {
        throw new Error("Herd does not exist")
      }

      const b_id_farm = herdRow[0].b_id_farm
      const category = await getHerdCategory(tx, l_id_herd)
      const l_specie = defaults?.l_specie ?? category.l_specie
      assertAnimalMatchesCategory(category, l_specie, null)
      const now = new Date()
      await lockFarmWorknumbers(tx, b_id_farm)
      const firstWorknumber = await getNextWorknumber(tx, b_id_farm)

      const animalIds = buildAnimalRows(count, l_id_herd, b_id_farm, now, firstWorknumber, {
        ...defaults,
        l_specie,
      })

      if (animalIds.length > 0) {
        await tx.insert(schema.animals).values(animalIds.map((r) => r.animalRow))
        await tx.insert(schema.animalArriving).values(animalIds.map((r) => r.arrivingRow))
        await tx.insert(schema.animalAssigning).values(animalIds.map((r) => r.assigningRow))
      }

      return animalIds.map((r) => r.l_id_animal)
    })
  } catch (err) {
    throw handleError(err, "Exception for addAnimalsToHerd", { l_id_herd, count })
  }
}

/**
 * Builds the insert rows for `count` new placeholder animals arriving onto a
 * farm and assigned into a herd, sharing default attributes. Used by both
 * {@link addAnimalsToHerd} and {@link createHerdWithAnimals}.
 */
async function getNextWorknumber(
  tx: FdmType,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<number> {
  const rows = await tx
    .select({ l_id_worknumber: schema.animals.l_id_worknumber })
    .from(schema.animals)
    .innerJoin(
      schema.animalArriving,
      and(
        eq(schema.animals.l_id_animal, schema.animalArriving.l_id_animal),
        eq(schema.animalArriving.b_id_farm, b_id_farm),
      ),
    )

  let nextWorknumber = 10001
  for (const row of rows) {
    if (row.l_id_worknumber && /^\d+$/.test(row.l_id_worknumber)) {
      nextWorknumber = Math.max(nextWorknumber, Number(row.l_id_worknumber) + 1)
    }
  }

  return nextWorknumber
}

async function lockFarmWorknumbers(
  tx: FdmType,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${b_id_farm}))`)
}

async function assertWorknumberAvailable(
  tx: FdmType,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  l_id_worknumber: string,
): Promise<void> {
  const rows = await tx
    .select({ l_id_animal: schema.animals.l_id_animal })
    .from(schema.animals)
    .innerJoin(
      schema.animalArriving,
      and(
        eq(schema.animals.l_id_animal, schema.animalArriving.l_id_animal),
        eq(schema.animalArriving.b_id_farm, b_id_farm),
      ),
    )
    .where(eq(schema.animals.l_id_worknumber, l_id_worknumber))
    .limit(1)

  if (rows.length > 0) {
    throw new Error(`Work number ${l_id_worknumber} is already used on farm ${b_id_farm}`)
  }
}

function buildAnimalRows(
  count: number,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  now: Date,
  firstWorknumber: number,
  defaults?: {
    l_specie?: schema.animalsTypeInsert["l_specie"]
    l_breed?: schema.animalsTypeInsert["l_breed"]
    l_arriving_method?: schema.animalArrivingTypeInsert["l_arriving_method"]
  },
): Array<{
  l_id_animal: string
  animalRow: typeof schema.animals.$inferInsert
  arrivingRow: typeof schema.animalArriving.$inferInsert
  assigningRow: typeof schema.animalAssigning.$inferInsert
}> {
  const rows: ReturnType<typeof buildAnimalRows> = []

  for (let i = 0; i < count; i++) {
    const l_id_animal = createId()

    rows.push({
      l_id_animal,
      animalRow: {
        l_id_animal,
        l_id_worknumber: String(firstWorknumber + i),
        l_specie: defaults?.l_specie ?? "cattle",
        l_breed: defaults?.l_breed ?? null,
      },
      arrivingRow: {
        l_id_animal,
        b_id_farm,
        l_arriving_date: now,
        l_arriving_method: defaults?.l_arriving_method ?? "born",
      },
      assigningRow: {
        l_id_animal,
        l_id_herd,
        l_assigning_start: now,
        l_assigning_end: null,
      },
    })
  }

  return rows
}

/**
 * Lowers the count of active animals assigned to a herd without emptying the
 * entire herd or hard-deleting records. Closes the `count` most recently
 * opened active assignments and writes `animal_leaving` rows. Prefers animals
 * without an ear tag so placeholder animals leave before identified ones.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal performing the reduction.
 * @param l_id_herd - Herd ID.
 * @param count - Number of animals to remove from the herd.
 * @param properties - Optional leaving date and leaving method.
 * @returns IDs of the animals marked as leaving.
 */
export async function removeAnimalsFromHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  count: number,
  properties?: {
    l_leaving_date?: schema.animalLeavingTypeInsert["l_leaving_date"]
    l_leaving_method?: schema.animalLeavingTypeInsert["l_leaving_method"]
  },
): Promise<string[]> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "herd", "write", l_id_herd, principal_id, "removeAnimalsFromHerd")

      if (count <= 0) {
        return []
      }

      const activeAssignments = await tx
        .select({
          l_id_animal: schema.animalAssigning.l_id_animal,
          l_assigning_start: schema.animalAssigning.l_assigning_start,
          l_id_eartag: schema.animals.l_id_eartag,
          created: schema.animals.created,
        })
        .from(schema.animalAssigning)
        .innerJoin(
          schema.animals,
          eq(schema.animalAssigning.l_id_animal, schema.animals.l_id_animal),
        )
        .leftJoin(
          schema.animalLeaving,
          eq(schema.animalAssigning.l_id_animal, schema.animalLeaving.l_id_animal),
        )
        .where(
          and(
            eq(schema.animalAssigning.l_id_herd, l_id_herd),
            isNull(schema.animalAssigning.l_assigning_end),
            isNull(schema.animalLeaving.l_leaving_date),
          ),
        )

      if (count > activeAssignments.length) {
        throw new Error(
          `Count to remove (${count}) exceeds current active census (${activeAssignments.length})`,
        )
      }

      // Sort: placeholder animals (no eartag) first, then by most recently opened assignment
      const sorted = [...activeAssignments].sort((a, b) => {
        const aHasNoEartag = a.l_id_eartag === null || a.l_id_eartag === undefined ? 1 : 0
        const bHasNoEartag = b.l_id_eartag === null || b.l_id_eartag === undefined ? 1 : 0
        if (aHasNoEartag !== bHasNoEartag) {
          return bHasNoEartag - aHasNoEartag // 1 before 0
        }
        const aTime = a.l_assigning_start ? new Date(a.l_assigning_start).getTime() : 0
        const bTime = b.l_assigning_start ? new Date(b.l_assigning_start).getTime() : 0
        if (aTime !== bTime) {
          return bTime - aTime // descending
        }
        const aCreated = a.created ? new Date(a.created).getTime() : 0
        const bCreated = b.created ? new Date(b.created).getTime() : 0
        return bCreated - aCreated
      })

      const toRemove = sorted.slice(0, count)
      const leavingDate = properties?.l_leaving_date ?? new Date()

      if (toRemove.some((row) => row.l_assigning_start && leavingDate < row.l_assigning_start)) {
        throw new Error("Leaving date cannot be before an active animal assignment start date")
      }

      const animalIds = toRemove.map((row) => row.l_id_animal)
      const now = new Date()

      await tx
        .insert(schema.animalLeaving)
        .values(
          animalIds.map((l_id_animal) => ({
            l_id_animal,
            l_leaving_date: leavingDate,
            l_leaving_method: properties?.l_leaving_method ?? null,
          })),
        )
        .onConflictDoUpdate({
          target: schema.animalLeaving.l_id_animal,
          set: {
            l_leaving_date: leavingDate,
            l_leaving_method: properties?.l_leaving_method ?? null,
            updated: now,
          },
        })

      await tx
        .update(schema.animalAssigning)
        .set({ l_assigning_end: leavingDate, updated: now })
        .where(
          and(
            eq(schema.animalAssigning.l_id_herd, l_id_herd),
            inArray(schema.animalAssigning.l_id_animal, animalIds),
            isNull(schema.animalAssigning.l_assigning_end),
          ),
        )

      return animalIds
    })
  } catch (err) {
    throw handleError(err, "Exception for removeAnimalsFromHerd", { l_id_herd, count })
  }
}

/**
 * Hard-deletes multiple animals and all of their own history rows in one call
 * (`animal_arriving`, `animal_assigning`, `animal_leaving`, `milking_animal`,
 * `feeding_animal`). The caller explicitly chooses which animals to remove.
 * To record that animals left the farm while preserving history, use
 * {@link updateAnimal} with `l_leaving_date`/`l_leaving_method` for each
 * animal instead.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the animals.
 * @param l_id_animals - IDs of the animals to remove.
 */
export async function removeAnimals(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animals: schema.animalsTypeSelect["l_id_animal"][],
): Promise<void> {
  try {
    await Promise.all(
      l_id_animals.map((l_id_animal) =>
        checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "removeAnimals"),
      ),
    )

    if (l_id_animals.length === 0) {
      return
    }

    await fdm.transaction(async (tx) => {
      await tx
        .delete(schema.milkingAnimal)
        .where(inArray(schema.milkingAnimal.l_id_animal, l_id_animals))
      await tx
        .delete(schema.feedingAnimal)
        .where(inArray(schema.feedingAnimal.l_id_animal, l_id_animals))
      await tx
        .delete(schema.animalLeaving)
        .where(inArray(schema.animalLeaving.l_id_animal, l_id_animals))
      await tx
        .delete(schema.animalAssigning)
        .where(inArray(schema.animalAssigning.l_id_animal, l_id_animals))
      await tx
        .delete(schema.animalArriving)
        .where(inArray(schema.animalArriving.l_id_animal, l_id_animals))
      await tx.delete(schema.animals).where(inArray(schema.animals.l_id_animal, l_id_animals))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeAnimals", { l_id_animals })
  }
}

/**
 * Reassigns an animal to a different, already-existing herd: closes the
 * animal's current active assignment (if any) and opens a new one in the
 * caller-specified target herd. The target herd must belong to the same farm
 * the animal currently belongs to. Does not inspect or match herd category —
 * the caller decides which herd to use (a farm may have multiple herds
 * sharing a category).
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal reassigning the animal.
 * @param l_id_animal - Unique identifier of the animal.
 * @param target_l_id_herd - Identifier of the herd to move the animal into.
 */
export async function assignAnimalToHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  target_l_id_herd: schema.herdsTypeSelect["l_id_herd"],
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "assignAnimalToHerd")

    await fdm.transaction(async (tx) => {
      const arriving = await tx
        .select({ b_id_farm: schema.animalArriving.b_id_farm })
        .from(schema.animalArriving)
        .where(eq(schema.animalArriving.l_id_animal, l_id_animal))
        .limit(1)

      if (arriving.length === 0) {
        throw new Error("Animal farm association not found")
      }

      const herdFarm = await tx
        .select({ b_id_farm: schema.herdStarting.b_id_farm })
        .from(schema.herdStarting)
        .where(eq(schema.herdStarting.l_id_herd, target_l_id_herd))
        .limit(1)

      if (herdFarm.length === 0 || herdFarm[0].b_id_farm !== arriving[0].b_id_farm) {
        throw new Error(`Herd ${target_l_id_herd} does not belong to the animal's farm`)
      }

      const animal = await tx
        .select({
          l_specie: schema.animals.l_specie,
          l_sex: schema.animals.l_sex,
        })
        .from(schema.animals)
        .where(eq(schema.animals.l_id_animal, l_id_animal))
        .limit(1)

      if (animal.length === 0) {
        throw new Error("Animal does not exist")
      }

      const category = await getHerdCategory(tx, target_l_id_herd)
      assertAnimalMatchesCategory(category, animal[0].l_specie, animal[0].l_sex)

      const now = new Date()

      await tx
        .update(schema.animalAssigning)
        .set({ l_assigning_end: now, updated: now })
        .where(
          and(
            eq(schema.animalAssigning.l_id_animal, l_id_animal),
            isNull(schema.animalAssigning.l_assigning_end),
          ),
        )

      await tx.insert(schema.animalAssigning).values({
        l_id_animal,
        l_id_herd: target_l_id_herd,
        l_assigning_start: now,
        l_assigning_end: null,
      })
    })
  } catch (err) {
    throw handleError(err, "Exception for assignAnimalToHerd", { l_id_animal, target_l_id_herd })
  }
}

/**
 * Ends a herd and records every currently assigned animal as leaving the farm.
 * Animal and assignment history is preserved; no animal is selected implicitly.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ending the herd.
 * @param l_id_herd - Herd to end.
 * @param l_leaving_date - Date on which the herd and its animals leave.
 * @param l_leaving_method - Optional departure method applied to all animals.
 * @returns IDs of the animals marked as leaving.
 */
export async function leaveHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  l_leaving_date: Date = new Date(),
  l_leaving_method?: schema.animalLeavingTypeInsert["l_leaving_method"],
): Promise<schema.animalsTypeSelect["l_id_animal"][]> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "herd", "write", l_id_herd, principal_id, "leaveHerd")

      const herdRows = await tx
        .select({ l_start: schema.herdStarting.l_start })
        .from(schema.herdStarting)
        .where(eq(schema.herdStarting.l_id_herd, l_id_herd))
        .limit(1)

      if (herdRows.length === 0) {
        throw new Error("Herd does not exist")
      }

      if (herdRows[0].l_start && l_leaving_date < herdRows[0].l_start) {
        throw new Error("Herd leaving date cannot be before the herd start date")
      }

      const activeAssignments = await tx
        .select({
          l_id_animal: schema.animalAssigning.l_id_animal,
          l_assigning_start: schema.animalAssigning.l_assigning_start,
        })
        .from(schema.animalAssigning)
        .leftJoin(
          schema.animalLeaving,
          eq(schema.animalAssigning.l_id_animal, schema.animalLeaving.l_id_animal),
        )
        .where(
          and(
            eq(schema.animalAssigning.l_id_herd, l_id_herd),
            isNull(schema.animalAssigning.l_assigning_end),
            isNull(schema.animalLeaving.l_leaving_date),
          ),
        )

      if (activeAssignments.some((row) => l_leaving_date < row.l_assigning_start)) {
        throw new Error("Herd leaving date cannot be before an active animal assignment")
      }

      const now = new Date()
      const animalIds = activeAssignments.map((row) => row.l_id_animal)

      if (animalIds.length > 0) {
        await tx
          .insert(schema.animalLeaving)
          .values(
            animalIds.map((l_id_animal) => ({
              l_id_animal,
              l_leaving_date,
              l_leaving_method: l_leaving_method ?? null,
            })),
          )
          .onConflictDoUpdate({
            target: schema.animalLeaving.l_id_animal,
            set: {
              l_leaving_date,
              l_leaving_method: l_leaving_method ?? null,
              updated: now,
            },
          })

        await tx
          .update(schema.animalAssigning)
          .set({ l_assigning_end: l_leaving_date, updated: now })
          .where(
            and(
              eq(schema.animalAssigning.l_id_herd, l_id_herd),
              inArray(schema.animalAssigning.l_id_animal, animalIds),
              isNull(schema.animalAssigning.l_assigning_end),
            ),
          )
      }

      await tx
        .insert(schema.herdEnding)
        .values({ l_id_herd, l_end: l_leaving_date })
        .onConflictDoUpdate({
          target: schema.herdEnding.l_id_herd,
          set: { l_end: l_leaving_date, updated: now },
        })

      return animalIds
    })
  } catch (err) {
    throw handleError(err, "Exception for leaveHerd", { l_id_herd, l_leaving_date })
  }
}

/**
 * Reassigns every currently assigned animal from one herd to another herd.
 * Each source assignment is closed and a new target assignment is opened at
 * the same timestamp, preserving the full assignment history.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal performing the reassignment.
 * @param source_l_id_herd - Herd whose active animals move.
 * @param target_l_id_herd - Existing active herd receiving the animals.
 * @param l_reassign_date - Timestamp at which the reassignment happens.
 * @returns IDs of the reassigned animals.
 */
export async function reassignHerdAnimals(
  fdm: FdmType,
  principal_id: PrincipalId,
  source_l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  target_l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  l_reassign_date: Date = new Date(),
): Promise<schema.animalsTypeSelect["l_id_animal"][]> {
  try {
    return await fdm.transaction(async (tx) => {
      if (source_l_id_herd === target_l_id_herd) {
        throw new Error("Source and target herd must be different")
      }

      await checkPermission(tx, "herd", "write", source_l_id_herd, principal_id, "reassignHerdAnimals")
      await checkPermission(tx, "herd", "write", target_l_id_herd, principal_id, "reassignHerdAnimals")

      const sourceRows = await tx
        .select({ b_id_farm: schema.herdStarting.b_id_farm })
        .from(schema.herdStarting)
        .where(eq(schema.herdStarting.l_id_herd, source_l_id_herd))
        .limit(1)
      const targetRows = await tx
        .select({
          b_id_farm: schema.herdStarting.b_id_farm,
          l_end: schema.herdEnding.l_end,
        })
        .from(schema.herdStarting)
        .leftJoin(
          schema.herdEnding,
          eq(schema.herdStarting.l_id_herd, schema.herdEnding.l_id_herd),
        )
        .where(eq(schema.herdStarting.l_id_herd, target_l_id_herd))
        .limit(1)

      if (sourceRows.length === 0 || targetRows.length === 0) {
        throw new Error("Source or target herd does not exist")
      }
      if (sourceRows[0].b_id_farm !== targetRows[0].b_id_farm) {
        throw new Error("Source and target herd must belong to the same farm")
      }
      if (targetRows[0].l_end !== null) {
        throw new Error("Target herd has already ended")
      }

      const activeAssignments = await tx
        .select({
          l_id_animal: schema.animalAssigning.l_id_animal,
          l_assigning_start: schema.animalAssigning.l_assigning_start,
          l_specie: schema.animals.l_specie,
          l_sex: schema.animals.l_sex,
        })
        .from(schema.animalAssigning)
        .innerJoin(
          schema.animals,
          eq(schema.animalAssigning.l_id_animal, schema.animals.l_id_animal),
        )
        .leftJoin(
          schema.animalLeaving,
          eq(schema.animalAssigning.l_id_animal, schema.animalLeaving.l_id_animal),
        )
        .where(
          and(
            eq(schema.animalAssigning.l_id_herd, source_l_id_herd),
            isNull(schema.animalAssigning.l_assigning_end),
            isNull(schema.animalLeaving.l_leaving_date),
          ),
        )

      if (activeAssignments.some((row) => l_reassign_date < row.l_assigning_start)) {
        throw new Error("Reassignment date cannot be before an active animal assignment")
      }

      const targetCategory = await getHerdCategory(tx, target_l_id_herd)
      for (const animal of activeAssignments) {
        assertAnimalMatchesCategory(targetCategory, animal.l_specie, animal.l_sex)
      }

      const animalIds = activeAssignments.map((row) => row.l_id_animal)
      if (animalIds.length === 0) {
        return []
      }

      const now = new Date()
      await tx
        .update(schema.animalAssigning)
        .set({ l_assigning_end: l_reassign_date, updated: now })
        .where(
          and(
            eq(schema.animalAssigning.l_id_herd, source_l_id_herd),
            inArray(schema.animalAssigning.l_id_animal, animalIds),
            isNull(schema.animalAssigning.l_assigning_end),
          ),
        )

      await tx.insert(schema.animalAssigning).values(
        animalIds.map((l_id_animal) => ({
          l_id_animal,
          l_id_herd: target_l_id_herd,
          l_assigning_start: l_reassign_date,
          l_assigning_end: null,
        })),
      )

      return animalIds
    })
  } catch (err) {
    throw handleError(err, "Exception for reassignHerdAnimals", {
      source_l_id_herd,
      target_l_id_herd,
      l_reassign_date,
    })
  }
}

/**
 * Corrects an existing animal_assigning record, identified by its full
 * composite key. Intended for fixing data-entry errors (wrong herd or
 * dates), not for day-to-day reassignment — use {@link assignAnimalToHerd}
 * for that, which preserves history by closing and opening records instead
 * of mutating one in place.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the assignment.
 * @param l_id_animal - Animal ID (part of the composite key).
 * @param l_id_herd - Herd ID identifying the record to correct (part of the composite key).
 * @param l_assigning_start - Assignment start date identifying the record to correct (part of the composite key).
 * @param properties - Fields to correct. If `l_id_herd` is set, the new herd
 * is re-validated to belong to the same farm as the animal.
 */
export async function updateAnimalAssigning(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  l_assigning_start: schema.animalAssigningTypeSelect["l_assigning_start"],
  properties: {
    l_id_herd?: schema.animalAssigningTypeInsert["l_id_herd"]
    l_assigning_start?: schema.animalAssigningTypeInsert["l_assigning_start"]
    l_assigning_end?: schema.animalAssigningTypeInsert["l_assigning_end"]
  },
): Promise<void> {
  try {
    await checkPermission(
      fdm,
      "animal",
      "write",
      l_id_animal,
      principal_id,
      "updateAnimalAssigning",
    )

    await fdm.transaction(async (tx) => {
      if (properties.l_id_herd) {
        const arriving = await tx
          .select({ b_id_farm: schema.animalArriving.b_id_farm })
          .from(schema.animalArriving)
          .where(eq(schema.animalArriving.l_id_animal, l_id_animal))
          .limit(1)

        const herdFarm = await tx
          .select({ b_id_farm: schema.herdStarting.b_id_farm })
          .from(schema.herdStarting)
          .where(eq(schema.herdStarting.l_id_herd, properties.l_id_herd))
          .limit(1)

        if (
          arriving.length === 0 ||
          herdFarm.length === 0 ||
          herdFarm[0].b_id_farm !== arriving[0].b_id_farm
        ) {
          throw new Error(`Herd ${properties.l_id_herd} does not belong to the animal's farm`)
        }

        const animal = await tx
          .select({
            l_specie: schema.animals.l_specie,
            l_sex: schema.animals.l_sex,
          })
          .from(schema.animals)
          .where(eq(schema.animals.l_id_animal, l_id_animal))
          .limit(1)

        if (animal.length === 0) {
          throw new Error("Animal does not exist")
        }

        const category = await getHerdCategory(tx, properties.l_id_herd)
        assertAnimalMatchesCategory(category, animal[0].l_specie, animal[0].l_sex)
      }

      const result = await tx
        .update(schema.animalAssigning)
        .set({ ...properties, updated: new Date() })
        .where(
          and(
            eq(schema.animalAssigning.l_id_animal, l_id_animal),
            eq(schema.animalAssigning.l_id_herd, l_id_herd),
            eq(schema.animalAssigning.l_assigning_start, l_assigning_start),
          ),
        )
        .returning({ l_id_animal: schema.animalAssigning.l_id_animal })

      if (result.length === 0) {
        throw new Error("Animal assignment record not found")
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for updateAnimalAssigning", {
      l_id_animal,
      l_id_herd,
      l_assigning_start,
      properties,
    })
  }
}

/**
 * Hard-deletes an animal_assigning record, identified by its full composite
 * key. True error correction — erases the record entirely, unlike
 * {@link removeAnimals}/{@link assignAnimalToHerd} which close assignments by
 * setting an end date and preserve history.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the assignment record.
 * @param l_id_animal - Animal ID (part of the composite key).
 * @param l_id_herd - Herd ID (part of the composite key).
 * @param l_assigning_start - Assignment start date (part of the composite key).
 */
export async function removeAnimalAssigning(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  l_assigning_start: schema.animalAssigningTypeSelect["l_assigning_start"],
): Promise<void> {
  try {
    await checkPermission(
      fdm,
      "animal",
      "write",
      l_id_animal,
      principal_id,
      "removeAnimalAssigning",
    )

    const result = await fdm
      .delete(schema.animalAssigning)
      .where(
        and(
          eq(schema.animalAssigning.l_id_animal, l_id_animal),
          eq(schema.animalAssigning.l_id_herd, l_id_herd),
          eq(schema.animalAssigning.l_assigning_start, l_assigning_start),
        ),
      )
      .returning({ l_id_animal: schema.animalAssigning.l_id_animal })

    if (result.length === 0) {
      throw new Error("Animal assignment record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for removeAnimalAssigning", {
      l_id_animal,
      l_id_herd,
      l_assigning_start,
    })
  }
}

/**
 * Creates a new herd on a farm together with `count` new animals sharing the
 * same default attributes, in a single transaction. Convenience wrapper
 * combining herd creation with {@link addAnimalsToHerd}'s bulk-insert logic.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal creating the herd and animals.
 * @param b_id_farm - Farm to create the herd on.
 * @param herdProperties - Optional herd properties (name, category, start date).
 * @param count - Number of new animals to create in the herd.
 * @param animalProperties - Optional default attributes shared by all newly created animals.
 * @returns The new herd ID and the IDs of the newly created animals.
 */
export async function createHerdWithAnimals(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  herdProperties: {
    l_herd_name?: schema.herdsTypeInsert["l_herd_name"]
    l_id_category?: schema.herdsTypeInsert["l_id_category"]
    l_start?: schema.herdStartingTypeInsert["l_start"]
  } | undefined,
  count: number,
  animalProperties?: {
    l_specie?: schema.animalsTypeInsert["l_specie"]
    l_breed?: schema.animalsTypeInsert["l_breed"]
    l_arriving_method?: schema.animalArrivingTypeInsert["l_arriving_method"]
  },
): Promise<{ l_id_herd: string; l_id_animals: string[] }> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "createHerdWithAnimals")

    return await fdm.transaction(async (tx) => {
      const l_id_herd = createId()
      const now = new Date()
      await lockFarmWorknumbers(tx, b_id_farm)

      const category = herdProperties?.l_id_category
        ? await getAnimalCategory(tx, herdProperties.l_id_category)
        : null
      if (count > 0 && !category) {
        throw new Error("An animal category is required when creating animals")
      }

      await tx.insert(schema.herds).values({
        l_id_herd,
        l_herd_name: herdProperties?.l_herd_name ?? null,
        l_id_category: herdProperties?.l_id_category ?? null,
      })

      await tx.insert(schema.herdStarting).values({
        l_id_herd,
        b_id_farm,
        l_start: herdProperties?.l_start ?? now,
      })

      const firstWorknumber = await getNextWorknumber(tx, b_id_farm)
      const l_specie = animalProperties?.l_specie ?? category?.l_specie ?? "cattle"
      if (category) {
        assertAnimalMatchesCategory(category, l_specie, null)
      }
      const animalRows = buildAnimalRows(
        count,
        l_id_herd,
        b_id_farm,
        now,
        firstWorknumber,
        { ...animalProperties, l_specie },
      )

      if (animalRows.length > 0) {
        await tx.insert(schema.animals).values(animalRows.map((r) => r.animalRow))
        await tx.insert(schema.animalArriving).values(animalRows.map((r) => r.arrivingRow))
        await tx.insert(schema.animalAssigning).values(animalRows.map((r) => r.assigningRow))
      }

      return { l_id_herd, l_id_animals: animalRows.map((r) => r.l_id_animal) }
    })
  } catch (err) {
    throw handleError(err, "Exception for createHerdWithAnimals", {
      b_id_farm,
      herdProperties,
      count,
    })
  }
}

/**
 * Computes the derived statutory livestock census (active animal count per herd category) for a farm at a specific evaluation date.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal requesting the census.
 * @param b_id_farm - Farm ID.
 * @param atDate - Target evaluation date (defaults to current timestamp).
 * @returns Array of HerdCensus objects containing herd ID, name, category, and animal count.
 */
export async function getCensusForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  atDate = new Date(),
): Promise<HerdCensus[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getCensusForFarm")

    const rows = await fdm
      .select({
        l_id_herd: schema.herds.l_id_herd,
        l_herd_name: schema.herds.l_herd_name,
        l_id_category: schema.herds.l_id_category,
        l_category: schema.animalCategoriesCatalogue.l_category,
        l_specie: schema.animalCategoriesCatalogue.l_specie,
        l_sex_options: schema.animalCategoriesCatalogue.l_sex_options,
        l_lsu: schema.animalCategoriesCatalogue.l_lsu,
        count: count(
          sql`CASE WHEN ${schema.animalLeaving.l_leaving_date} IS NULL THEN ${schema.animalAssigning.l_id_animal} END`,
        ),
      })
      .from(schema.herds)
      .innerJoin(schema.herdStarting, eq(schema.herds.l_id_herd, schema.herdStarting.l_id_herd))
      .leftJoin(schema.herdEnding, eq(schema.herds.l_id_herd, schema.herdEnding.l_id_herd))
      .leftJoin(
        schema.animalCategoriesCatalogue,
        eq(schema.herds.l_id_category, schema.animalCategoriesCatalogue.l_id_category),
      )
      .leftJoin(
        schema.animalAssigning,
        and(
          eq(schema.herds.l_id_herd, schema.animalAssigning.l_id_herd),
          lte(schema.animalAssigning.l_assigning_start, atDate),
          or(
            isNull(schema.animalAssigning.l_assigning_end),
            gt(schema.animalAssigning.l_assigning_end, atDate),
          ),
        ),
      )
      .leftJoin(
        schema.animalLeaving,
        and(
          eq(schema.animalAssigning.l_id_animal, schema.animalLeaving.l_id_animal),
          lte(schema.animalLeaving.l_leaving_date, atDate),
        ),
      )
      .where(
        and(eq(schema.herdStarting.b_id_farm, b_id_farm), isNull(schema.herdEnding.l_end)),
      )
      .groupBy(
        schema.herds.l_id_herd,
        schema.herds.l_herd_name,
        schema.herds.l_id_category,
        schema.animalCategoriesCatalogue.l_category,
        schema.animalCategoriesCatalogue.l_specie,
        schema.animalCategoriesCatalogue.l_sex_options,
        schema.animalCategoriesCatalogue.l_lsu,
      )

    return rows.map((r) => ({
      l_id_herd: r.l_id_herd,
      l_herd_name: r.l_herd_name,
      l_id_category: r.l_id_category,
      l_category: r.l_category,
      l_specie: r.l_specie,
      l_sex_options: r.l_sex_options,
      l_lsu: r.l_lsu,
      count: Number(r.count),
    })) as HerdCensus[]
  } catch (err) {
    throw handleError(err, "Exception for getCensusForFarm", { b_id_farm, atDate })
  }
}
