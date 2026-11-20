import { parseCattleEartag } from "@nmi-agro/fdm-data"
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm"
import type {
  Animal,
  AnimalAssignmentHistory,
  AnimalCategoryCatalogue,
  HerdCensus,
} from "./animal.types"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import { assertAnimalMatchesCategory, getAnimalCategory, getHerdCategory } from "./animal-category"
import { checkPermission } from "./authorization"
import { getEnabledAnimalCategoryCatalogues } from "./catalogues"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { assertHerdRunsOn, insertHerd } from "./herd"
import { createId } from "./id"
import { overlapsHalfOpen } from "./interval"
import { lockFarm, lockFarmOfAnimal, lockFarmOfHerd } from "./livestock-checks"

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

/**
 * SQL condition: the herd assignment runs on `date`, so it started on or before that date and has
 * not ended by then. An animal with a departure in the future is still in its herd until that date.
 */
function activeAssignmentOn(date: Date): SQL {
  return and(
    lte(schema.animalAssigning.l_assigning_start, date),
    or(
      isNull(schema.animalAssigning.l_assigning_end),
      gt(schema.animalAssigning.l_assigning_end, date),
    ),
  ) as SQL
}

/**
 * SQL value for the moment a row is actually written. A column default (`now()`) is the start of
 * the transaction; two moves that wait for the farm lock can start in one order and write in the
 * other, so moves record this instead and `created` follows the order in which they happened.
 */
function writtenAt(): SQL<Date> {
  return sql<Date>`clock_timestamp()`
}

/** SQL condition: the animal has not left the farm by `date`. */
function presentOn(date: Date): SQL {
  return or(
    isNull(schema.animalLeaving.l_leaving_date),
    gt(schema.animalLeaving.l_leaving_date, date),
  ) as SQL
}

/**
 * Adds a single individual animal asset to a farm and assigns it to an active herd.
 * For animals born on the farm,
 * l_birth_date and l_arriving_date must be equal.
 *
 * The life number (`l_id_eartag`) of cattle is checked with `parseCattleEartag` from
 * `@nmi-agro/fdm-data`: a Dutch life number must have a valid format and check digit and is stored
 * as `NL` followed by its digits; a foreign one is stored as entered. Without an explicit
 * `l_id_worknumber`, the work number is taken from a Dutch life number, or otherwise assigned
 * automatically from 10001 upwards. Work number and life number must not be in use by another
 * animal that is still on the farm.
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
      // Take the farm lock before reading the herd category, so a concurrent category change of
      // the herd (updateHerd takes the same lock) cannot slip in between
      await lockFarm(tx, b_id_farm)

      const arrivingMethod = properties?.l_arriving_method ?? "born"
      let birthdate = properties?.l_birth_date ?? null
      let arrivingDate = properties?.l_arriving_date ?? birthdate ?? new Date()
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

      // The animal joins the herd on its arrival date, so the herd must run on that date
      const herdFarm = await assertHerdRunsOn(tx, l_id_herd, arrivingDate)
      if (herdFarm !== b_id_farm) {
        throw new Error(`Herd ${l_id_herd} does not belong to farm ${b_id_farm}`)
      }

      const category = await getHerdCategory(tx, l_id_herd)
      const l_specie = properties?.l_specie ?? category.l_specie
      const l_sex = properties?.l_sex ?? null
      assertAnimalMatchesCategory(category, l_specie, l_sex)

      const l_id_animal = createId()
      const eartag = properties?.l_id_eartag
        ? normalizeEartag(properties.l_id_eartag, l_specie)
        : null
      let l_id_worknumber = properties?.l_id_worknumber ?? eartag?.worknumber
      if (l_id_worknumber === undefined || l_id_worknumber === null) {
        const next = await getNextWorknumber(tx, b_id_farm)
        assertWorknumberRange(next, 1)
        l_id_worknumber = String(next)
      }

      // Departed animals don't block a number, so an animal recorded as already gone isn't checked
      const isPresent =
        !properties?.l_leaving_date || new Date(properties.l_leaving_date) > new Date()
      if (isPresent) {
        await assertIdentifierAvailable(tx, b_id_farm, "l_id_worknumber", l_id_worknumber)
        if (eartag?.l_id_eartag) {
          await assertIdentifierAvailable(tx, b_id_farm, "l_id_eartag", eartag.l_id_eartag)
        }
      }

      await tx.insert(schema.animals).values({
        l_id_animal,
        l_id_eartag: eartag?.l_id_eartag ?? null,
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

      // An animal stays in its herd until it leaves the farm
      await tx.insert(schema.animalAssigning).values({
        l_id_animal,
        l_id_herd,
        l_assigning_start: arrivingDate,
        l_assigning_end: properties?.l_leaving_date ?? null,
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

    // The herd the animal is in now; an animal with a departure in the future is still in it
    const now = new Date()
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
          activeAssignmentOn(now),
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

    // Animals in the herd now; an animal with a departure in the future is still in it
    const now = new Date()
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
          activeAssignmentOn(now),
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
      .where(presentOn(now))
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
          activeAssignmentOn(atDate),
        ),
      )
      .leftJoin(schema.herds, eq(schema.animalAssigning.l_id_herd, schema.herds.l_id_herd))
      .leftJoin(
        schema.animalCategoriesCatalogue,
        eq(schema.herds.l_id_category, schema.animalCategoriesCatalogue.l_id_category),
      )
      .where(
        and(
          or(
            isNull(schema.animalArriving.l_arriving_date),
            lte(schema.animalArriving.l_arriving_date, atDate),
          ),
          presentOn(atDate),
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
 * A life number (`l_id_eartag`) is checked and normalized as in {@link addAnimal}; an empty string
 * or `null` removes it. The work number is not derived here: pass `l_id_worknumber` to change it.
 * While the animal is on the farm, its work number and life number must not be in use by another
 * animal that is still on the farm.
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
      // Serialize with every other livestock change on this farm before reading anything
      await lockFarmOfAnimal(tx, l_id_animal)

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

      const identifiersChange =
        properties.l_id_eartag !== undefined || properties.l_id_worknumber !== undefined
      const leavingDateChanges = l_leaving_date !== undefined

      if (identifiersChange || leavingDateChanges) {
        const current = await tx
          .select({
            l_specie: schema.animals.l_specie,
            l_id_eartag: schema.animals.l_id_eartag,
            l_id_worknumber: schema.animals.l_id_worknumber,
            b_id_farm: schema.animalArriving.b_id_farm,
            l_leaving_date: schema.animalLeaving.l_leaving_date,
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
          .where(eq(schema.animals.l_id_animal, l_id_animal))
          .limit(1)

        if (current.length === 0) {
          throw new Error("Animal does not exist")
        }

        const { b_id_farm } = current[0]
        if (properties.l_id_eartag !== undefined) {
          // An empty or null life number clears it
          animalProperties.l_id_eartag = properties.l_id_eartag
            ? normalizeEartag(properties.l_id_eartag, properties.l_specie ?? current[0].l_specie)
                .l_id_eartag
            : null
        }

        const leavingDate = leavingDateChanges ? l_leaving_date : current[0].l_leaving_date
        const isPresent = !leavingDate || new Date(leavingDate) > new Date()
        // Check the numbers that the animal will have, also when a corrected departure makes it
        // present again with its stored numbers
        if (isPresent) {
          const worknumber =
            properties.l_id_worknumber !== undefined
              ? properties.l_id_worknumber
              : current[0].l_id_worknumber
          const eartag =
            properties.l_id_eartag !== undefined
              ? animalProperties.l_id_eartag
              : current[0].l_id_eartag
          if (worknumber) {
            await assertIdentifierAvailable(
              tx,
              b_id_farm,
              "l_id_worknumber",
              worknumber,
              l_id_animal,
            )
          }
          if (eartag) {
            await assertIdentifierAvailable(tx, b_id_farm, "l_id_eartag", eartag, l_id_animal)
          }
        }
      }

      // The departure ends the animal's last herd assignment, so it cannot come before a move
      // that is already recorded for a later date
      if (l_leaving_date) {
        await assertNoMoveAfter(tx, [l_id_animal], l_leaving_date)
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

        // The herd assignment ends when the animal leaves. Setting, moving or clearing the
        // departure sets, moves or clears the end of the animal's last assignment, identified by
        // its key, so an earlier assignment that ends on the same date is left alone
        if (leavingDateChanges) {
          const [last] = await tx
            .select({
              l_id_herd: schema.animalAssigning.l_id_herd,
              l_assigning_start: schema.animalAssigning.l_assigning_start,
            })
            .from(schema.animalAssigning)
            .where(eq(schema.animalAssigning.l_id_animal, l_id_animal))
            // Two moves on one day give two assignments with the same start; the one opened last
            // (the latest move, so the later `created`) is the animal's last assignment
            .orderBy(
              desc(schema.animalAssigning.l_assigning_start),
              desc(schema.animalAssigning.created),
            )
            .limit(1)
          if (last) {
            await tx
              .update(schema.animalAssigning)
              .set({ l_assigning_end: l_leaving_date ?? null, updated })
              .where(
                and(
                  eq(schema.animalAssigning.l_id_animal, l_id_animal),
                  eq(schema.animalAssigning.l_id_herd, last.l_id_herd),
                  eq(schema.animalAssigning.l_assigning_start, last.l_assigning_start),
                ),
              )
          }
        }
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for updateAnimal", { l_id_animal, properties })
  }
}

/**
 * Hard-deletes an animal and all of its own history rows (`animal_arriving`,
 * `animal_assigning`, `animal_leaving`, `animal_milking`, `animal_feeding`).
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
      await tx.delete(schema.animalMilking).where(eq(schema.animalMilking.l_id_animal, l_id_animal))
      await tx.delete(schema.animalFeeding).where(eq(schema.animalFeeding.l_id_animal, l_id_animal))
      await tx.delete(schema.animalLeaving).where(eq(schema.animalLeaving.l_id_animal, l_id_animal))
      await tx
        .delete(schema.animalAssigning)
        .where(eq(schema.animalAssigning.l_id_animal, l_id_animal))
      await tx
        .delete(schema.animalArriving)
        .where(eq(schema.animalArriving.l_id_animal, l_id_animal))
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
 * @param options - Optional `expected_count`: the number of animals the caller saw in the herd.
 *   When the herd holds a different number now, nothing is added, so two changes made from the
 *   same stale count don't both apply.
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
  options?: { expected_count?: number },
): Promise<string[]> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "addAnimalsToHerd")
    assertAnimalCount(count)

    return await fdm.transaction(async (tx) => {
      const now = new Date()
      await lockFarmOfHerd(tx, l_id_herd)
      await assertExpectedCount(tx, l_id_herd, now, options?.expected_count)
      const b_id_farm = await assertHerdRunsOn(tx, l_id_herd, now)
      const category = await getHerdCategory(tx, l_id_herd)
      const l_specie = defaults?.l_specie ?? category.l_specie
      assertAnimalMatchesCategory(category, l_specie, null)
      const firstWorknumber = await getNextWorknumber(tx, b_id_farm)
      assertWorknumberRange(firstWorknumber, count)

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
 * Returns the next automatic work number of a farm: one above the highest numeric work number of
 * all animals that ever arrived on the farm, and at least 10001. Numbers of departed animals count
 * too, so an automatic number is never handed out twice. Automatic numbers have 5 digits, while a
 * work number taken from a Dutch life number has 4, so the two never collide.
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
    // Every number that can be counted exactly counts, also one the allocator made itself. A number
    // typed in by hand that is too large to count exactly is skipped: the allocator never makes it.
    // When the next number is no longer exact, the callers refuse to allocate (assertWorknumberRange)
    if (row.l_id_worknumber && /^\d+$/.test(row.l_id_worknumber)) {
      const worknumber = Number(row.l_id_worknumber)
      if (Number.isSafeInteger(worknumber)) {
        nextWorknumber = Math.max(nextWorknumber, worknumber + 1)
      }
    }
  }

  return nextWorknumber
}

/**
 * Checks the number of animals for a bulk operation.
 *
 * @param count - The number of animals.
 * @throws When the count is not a whole number of 0 or more.
 */
function assertAnimalCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Invalid number of animals: ${count}`)
  }
}

/**
 * Checks that a herd still holds the number of animals the caller saw, counted as the census
 * does: animals in the herd on `date` that have not left by then. Run it after the farm lock.
 *
 * @param tx - The transaction.
 * @param l_id_herd - The herd.
 * @param date - The date to count on.
 * @param expected_count - The number the caller saw; nothing is checked when it is undefined.
 * @throws When the herd holds a different number of animals.
 */
async function assertExpectedCount(
  tx: FdmType,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  date: Date,
  expected_count: number | undefined,
): Promise<void> {
  if (expected_count === undefined) return
  const [row] = await tx
    .select({ n: count() })
    .from(schema.animalAssigning)
    .leftJoin(
      schema.animalLeaving,
      eq(schema.animalAssigning.l_id_animal, schema.animalLeaving.l_id_animal),
    )
    .where(
      and(
        eq(schema.animalAssigning.l_id_herd, l_id_herd),
        activeAssignmentOn(date),
        presentOn(date),
      ),
    )
  if (Number(row?.n ?? 0) !== expected_count) {
    throw new Error("Number of animals in the herd has changed")
  }
}

/**
 * Checks that a range of automatic work numbers can be counted exactly.
 *
 * @param firstWorknumber - The first work number of the range.
 * @param count - The number of animals in the range.
 * @throws When the last number of the range is too large to count from exactly.
 */
function assertWorknumberRange(firstWorknumber: number, count: number): void {
  // Check the first number itself, and add `count - 1` in one step: past the largest exact
  // number, adding 1 and subtracting 1 again can round back into the exact range
  if (
    count > 0 &&
    (!Number.isSafeInteger(firstWorknumber) || !Number.isSafeInteger(firstWorknumber + (count - 1)))
  ) {
    throw new Error("No automatic work numbers left for this many animals")
  }
}

/**
 * Checks that none of the animals has a herd assignment that starts after a date, such as a move
 * to another herd recorded for later. A departure or a herd ending on that date would otherwise
 * leave that later assignment behind.
 *
 * @param tx - The transaction.
 * @param l_id_animals - The animals.
 * @param date - The date of the departure.
 * @throws When an animal has an assignment that starts after the date.
 */
async function assertNoMoveAfter(
  tx: FdmType,
  l_id_animals: schema.animalsTypeSelect["l_id_animal"][],
  date: Date,
): Promise<void> {
  if (l_id_animals.length === 0) return
  const assignments = await tx
    .select({
      l_id_animal: schema.animalAssigning.l_id_animal,
      l_assigning_start: schema.animalAssigning.l_assigning_start,
    })
    .from(schema.animalAssigning)
    .where(inArray(schema.animalAssigning.l_id_animal, l_id_animals))
    .orderBy(asc(schema.animalAssigning.l_assigning_start), asc(schema.animalAssigning.created))

  // A move is any assignment after the animal's first one (its arrival in a herd), also one that
  // starts at the same moment as the arrival
  const seen = new Set<string>()
  for (const row of assignments) {
    if (!seen.has(row.l_id_animal)) {
      seen.add(row.l_id_animal)
    } else if (row.l_assigning_start.getTime() > date.getTime()) {
      throw new Error(
        `Departure cannot be before the move to another herd on ${row.l_assigning_start.toISOString()}`,
      )
    }
  }
}

/**
 * Checks that no other animal still on the farm uses the work number or life number. Animals with
 * a leaving date in the past don't count, so their numbers can be used again.
 */
async function assertIdentifierAvailable(
  tx: FdmType,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  column: "l_id_worknumber" | "l_id_eartag",
  value: string,
  exceptAnimalId?: schema.animalsTypeSelect["l_id_animal"],
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
    .leftJoin(
      schema.animalLeaving,
      eq(schema.animals.l_id_animal, schema.animalLeaving.l_id_animal),
    )
    .where(
      and(
        eq(schema.animals[column], value),
        exceptAnimalId ? ne(schema.animals.l_id_animal, exceptAnimalId) : undefined,
        or(
          isNull(schema.animalLeaving.l_leaving_date),
          gt(schema.animalLeaving.l_leaving_date, new Date()),
        ),
      ),
    )
    .limit(1)

  if (rows.length > 0) {
    const label = column === "l_id_worknumber" ? "Work number" : "Life number"
    throw new Error(`${label} ${value} is already used by another animal on farm ${b_id_farm}`)
  }
}

/**
 * Checks and normalizes the life number of an animal. For cattle, a Dutch life number must pass
 * {@link parseCattleEartag} and is stored as `NL` followed by its digits; its work number is
 * returned as well. Other species and foreign life numbers are only trimmed.
 */
function normalizeEartag(
  l_id_eartag: string,
  l_specie: schema.animalsTypeSelect["l_specie"],
): { l_id_eartag: string | null; worknumber: string | null } {
  const trimmed = l_id_eartag.trim()
  if (!trimmed || l_specie !== "cattle") {
    return { l_id_eartag: trimmed || null, worknumber: null }
  }

  const result = parseCattleEartag(trimmed)
  if (result.kind === "invalid") {
    throw new Error(
      result.reason === "check_digit"
        ? `Life number ${trimmed} has an invalid check digit`
        : `Life number ${trimmed} is not a valid Dutch cattle life number`,
    )
  }
  if (result.kind === "foreign") {
    return { l_id_eartag: result.eartag, worknumber: null }
  }
  return { l_id_eartag: result.eartag, worknumber: result.worknumber }
}

/**
 * Builds the insert rows for `count` new placeholder animals arriving onto a
 * farm and assigned into a herd, sharing default attributes. Used by both
 * {@link addAnimalsToHerd} and {@link createHerdWithAnimals}.
 */
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
 * @param options - Optional `expected_count`: the number of animals the caller saw in the herd.
 *   When the herd holds a different number now, no animal leaves, so two changes made from the
 *   same stale count don't both apply.
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
  options?: { expected_count?: number },
): Promise<string[]> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "herd", "write", l_id_herd, principal_id, "removeAnimalsFromHerd")
      assertAnimalCount(count)
      if (count === 0) {
        return []
      }

      // Serialize with every other livestock change on this farm, so two reductions don't pick
      // the same animals. Animals that already have a departure (also one in the future) are
      // leaving anyway and are not picked again; animals that only join later can't leave yet.
      await lockFarmOfHerd(tx, l_id_herd)
      await assertExpectedCount(tx, l_id_herd, new Date(), options?.expected_count)
      const leavingDate = properties?.l_leaving_date ?? new Date()

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
            lte(schema.animalAssigning.l_assigning_start, leavingDate),
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
 * (`animal_arriving`, `animal_assigning`, `animal_leaving`, `animal_milking`,
 * `animal_feeding`). The caller explicitly chooses which animals to remove.
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
        .delete(schema.animalMilking)
        .where(inArray(schema.animalMilking.l_id_animal, l_id_animals))
      await tx
        .delete(schema.animalFeeding)
        .where(inArray(schema.animalFeeding.l_id_animal, l_id_animals))
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
 * Moves an animal to another herd: closes the animal's current herd assignment (if any) at
 * `l_assigning_start` and opens a new one in the target herd, so the history of the animal is
 * kept. The caller chooses the herd, also when the farm has several herds of the same category.
 *
 * An animal has no category of its own; it takes the category of its herd. Moving it to a herd of
 * another category, for example a heifer that calves and joins the dairy cows, changes its
 * category. The animal must fit the category of the target herd.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal moving the animal.
 * @param l_id_animal - Unique identifier of the animal.
 * @param target_l_id_herd - Identifier of the herd to move the animal into.
 * @param l_assigning_start - Moment of the move. Defaults to now; a date in the past records a
 *   move that already happened.
 * @throws When the animal does not exist or has left the farm by then, is already in the target
 *   herd, or does not fit its category; when the target herd belongs to another farm, has not
 *   started yet or has already ended on that date; or when the date is before the animal's current
 *   herd assignment.
 */
export async function assignAnimalToHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  target_l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  l_assigning_start: Date = new Date(),
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "assignAnimalToHerd")

    await fdm.transaction(async (tx) => {
      // Serialize with every other livestock change on this farm (other moves, bulk moves, a
      // category change of the target herd) before reading anything
      await lockFarmOfAnimal(tx, l_id_animal)

      const rows = await tx
        .select({
          b_id_farm: schema.animalArriving.b_id_farm,
          l_specie: schema.animals.l_specie,
          l_sex: schema.animals.l_sex,
          l_leaving_date: schema.animalLeaving.l_leaving_date,
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
        .where(eq(schema.animals.l_id_animal, l_id_animal))
        .limit(1)

      if (rows.length === 0) {
        throw new Error("Animal does not exist")
      }
      const animal = rows[0]
      if (animal.l_leaving_date && animal.l_leaving_date <= l_assigning_start) {
        throw new Error("Animal has left the farm")
      }

      // The assignment the animal is in on the date of the move; for a move in the past this is
      // not always the open one (a departure in the future or a later move may have ended it)
      const assignments = await tx
        .select({
          l_id_herd: schema.animalAssigning.l_id_herd,
          l_assigning_start: schema.animalAssigning.l_assigning_start,
          l_assigning_end: schema.animalAssigning.l_assigning_end,
        })
        .from(schema.animalAssigning)
        .where(eq(schema.animalAssigning.l_id_animal, l_id_animal))
      const current = assignments.find(
        (row) =>
          row.l_assigning_start <= l_assigning_start &&
          (row.l_assigning_end === null || row.l_assigning_end > l_assigning_start),
      )
      if (!current && assignments.length > 0) {
        throw new Error("Move cannot be before the current herd assignment")
      }
      if (current?.l_id_herd === target_l_id_herd) {
        throw new Error(`Animal already belongs to herd ${target_l_id_herd}`)
      }

      const herdFarm = await assertHerdRunsOn(tx, target_l_id_herd, l_assigning_start)
      if (herdFarm !== animal.b_id_farm) {
        throw new Error(`Herd ${target_l_id_herd} does not belong to the animal's farm`)
      }

      const category = await getHerdCategory(tx, target_l_id_herd)
      assertAnimalMatchesCategory(category, animal.l_specie, animal.l_sex)

      if (current) {
        await tx
          .update(schema.animalAssigning)
          .set({ l_assigning_end: l_assigning_start, updated: new Date() })
          .where(
            and(
              eq(schema.animalAssigning.l_id_animal, l_id_animal),
              eq(schema.animalAssigning.l_id_herd, current.l_id_herd),
              eq(schema.animalAssigning.l_assigning_start, current.l_assigning_start),
            ),
          )
      }

      // The new assignment keeps the end the old one had, such as a departure in the future
      await tx.insert(schema.animalAssigning).values({
        l_id_animal,
        l_id_herd: target_l_id_herd,
        l_assigning_start,
        l_assigning_end: current ? current.l_assigning_end : (animal.l_leaving_date ?? null),
        created: writtenAt(),
      })
    })
  } catch (err) {
    throw handleError(err, "Exception for assignAnimalToHerd", {
      l_id_animal,
      target_l_id_herd,
      l_assigning_start,
    })
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
      // Serialize with every other livestock change on this farm before reading anything
      await lockFarmOfHerd(tx, l_id_herd)

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

      // The animals in the herd on the leaving date, including those with a departure after it;
      // their departure moves forward to the herd's leaving date
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
            or(
              isNull(schema.animalAssigning.l_assigning_end),
              gt(schema.animalAssigning.l_assigning_end, l_leaving_date),
            ),
            presentOn(l_leaving_date),
          ),
        )

      if (activeAssignments.some((row) => l_leaving_date < row.l_assigning_start)) {
        throw new Error("Herd leaving date cannot be before an active animal assignment")
      }

      const now = new Date()
      const animalIds = activeAssignments.map((row) => row.l_id_animal)
      // An animal that already moves to another herd after the leaving date would keep that move
      await assertNoMoveAfter(tx, animalIds, l_leaving_date)

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
              or(
                isNull(schema.animalAssigning.l_assigning_end),
                gt(schema.animalAssigning.l_assigning_end, l_leaving_date),
              ),
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

      await checkPermission(
        tx,
        "herd",
        "write",
        source_l_id_herd,
        principal_id,
        "reassignHerdAnimals",
      )
      await checkPermission(
        tx,
        "herd",
        "write",
        target_l_id_herd,
        principal_id,
        "reassignHerdAnimals",
      )

      // Serialize with every other livestock change on this farm (such as a single move of one of
      // these animals) before reading the assignments
      const sourceFarm = await lockFarmOfHerd(tx, source_l_id_herd)
      if (!sourceFarm) {
        throw new Error("Source or target herd does not exist")
      }
      const targetFarm = await assertHerdRunsOn(tx, target_l_id_herd, l_reassign_date)
      if (sourceFarm !== targetFarm) {
        throw new Error("Source and target herd must belong to the same farm")
      }

      // The animals in the source herd on the reassignment date, including those with a departure
      // after it; they keep that departure in the target herd
      const activeAssignments = await tx
        .select({
          l_id_animal: schema.animalAssigning.l_id_animal,
          l_assigning_start: schema.animalAssigning.l_assigning_start,
          l_assigning_end: schema.animalAssigning.l_assigning_end,
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
            or(
              isNull(schema.animalAssigning.l_assigning_end),
              gt(schema.animalAssigning.l_assigning_end, l_reassign_date),
            ),
            presentOn(l_reassign_date),
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
            or(
              isNull(schema.animalAssigning.l_assigning_end),
              gt(schema.animalAssigning.l_assigning_end, l_reassign_date),
            ),
          ),
        )

      await tx.insert(schema.animalAssigning).values(
        activeAssignments.map((row) => ({
          l_id_animal: row.l_id_animal,
          l_id_herd: target_l_id_herd,
          l_assigning_start: l_reassign_date,
          l_assigning_end: row.l_assigning_end,
          created: writtenAt(),
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
      // Serialize with every other livestock change on this farm, so the checks below hold
      await lockFarmOfAnimal(tx, l_id_animal)

      const assignments = await tx
        .select({
          l_id_herd: schema.animalAssigning.l_id_herd,
          l_assigning_start: schema.animalAssigning.l_assigning_start,
          l_assigning_end: schema.animalAssigning.l_assigning_end,
        })
        .from(schema.animalAssigning)
        .where(eq(schema.animalAssigning.l_id_animal, l_id_animal))
      const isRecord = (row: (typeof assignments)[number]) =>
        row.l_id_herd === l_id_herd &&
        row.l_assigning_start.getTime() === l_assigning_start.getTime()
      const record = assignments.find(isRecord)
      if (!record) {
        throw new Error("Animal assignment record not found")
      }

      const nextHerd = properties.l_id_herd ?? l_id_herd
      const nextStart = properties.l_assigning_start ?? l_assigning_start
      const nextEnd =
        properties.l_assigning_end === undefined
          ? record.l_assigning_end
          : properties.l_assigning_end
      if (nextEnd && nextEnd <= nextStart) {
        throw new Error("Assignment end must be after its start")
      }
      // An animal is in one herd at a time. An empty assignment (two moves on the same day) covers
      // no time, so it overlaps nothing
      const isEmpty = (row: (typeof assignments)[number]) =>
        row.l_assigning_end !== null &&
        row.l_assigning_end.getTime() <= row.l_assigning_start.getTime()
      if (
        assignments.some(
          (row) =>
            !isRecord(row) &&
            !isEmpty(row) &&
            overlapsHalfOpen(nextStart, nextEnd, row.l_assigning_start, row.l_assigning_end),
        )
      ) {
        throw new Error("Assignment overlaps another assignment of this animal")
      }

      if (properties.l_id_herd || properties.l_assigning_start) {
        const arriving = await tx
          .select({ b_id_farm: schema.animalArriving.b_id_farm })
          .from(schema.animalArriving)
          .where(eq(schema.animalArriving.l_id_animal, l_id_animal))
          .limit(1)

        // The herd must run when the (corrected) assignment starts
        const herdFarm = await assertHerdRunsOn(tx, nextHerd, nextStart)

        if (arriving.length === 0 || herdFarm !== arriving[0].b_id_farm) {
          throw new Error(`Herd ${nextHerd} does not belong to the animal's farm`)
        }
      }

      if (properties.l_id_herd) {
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
 * @param herdProperties - Herd properties: the animal category (required, enabled for the farm),
 *   and optionally the name and start date. Without a start date the herd has no known start.
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
    l_id_category: schema.herdsTypeInsert["l_id_category"]
    l_start?: schema.herdStartingTypeInsert["l_start"]
  },
  count: number,
  animalProperties?: {
    l_specie?: schema.animalsTypeInsert["l_specie"]
    l_breed?: schema.animalsTypeInsert["l_breed"]
    l_arriving_method?: schema.animalArrivingTypeInsert["l_arriving_method"]
  },
): Promise<{ l_id_herd: string; l_id_animals: string[] }> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "createHerdWithAnimals")
    assertAnimalCount(count)

    return await fdm.transaction(async (tx) => {
      const now = new Date()
      await lockFarm(tx, b_id_farm)

      const category = await getAnimalCategory(tx, herdProperties.l_id_category, b_id_farm)
      const l_id_herd = await insertHerd(tx, b_id_farm, herdProperties)
      // The animals join the herd now, so a herd that only starts later cannot get them yet
      if (count > 0) {
        await assertHerdRunsOn(tx, l_id_herd, now)
      }

      const firstWorknumber = await getNextWorknumber(tx, b_id_farm)
      assertWorknumberRange(firstWorknumber, count)
      const l_specie = animalProperties?.l_specie ?? category.l_specie
      assertAnimalMatchesCategory(category, l_specie, null)
      const animalRows = buildAnimalRows(count, l_id_herd, b_id_farm, now, firstWorknumber, {
        ...animalProperties,
        l_specie,
      })

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
          activeAssignmentOn(atDate),
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
        and(
          eq(schema.herdStarting.b_id_farm, b_id_farm),
          // The herds that run on the census date
          or(isNull(schema.herdStarting.l_start), lte(schema.herdStarting.l_start, atDate)),
          or(isNull(schema.herdEnding.l_end), gt(schema.herdEnding.l_end, atDate)),
        ),
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
