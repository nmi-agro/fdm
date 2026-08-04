import { and, count, desc, eq, isNull, lte, or, sql } from "drizzle-orm"
import type { Animal, HerdCensus } from "./animal.types"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"

/**
 * Adds a single individual animal asset to a farm and assigns it to an active herd.
 * Also sets b_farm_livestock = true on the farm. For animals born on the farm,
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
    l_species?: schema.animalsTypeInsert["l_species"]
    l_breed?: schema.animalsTypeInsert["l_breed"]
    l_coatcolor?: schema.animalsTypeInsert["l_coatcolor"]
    l_birth_date?: schema.animalsTypeInsert["l_birth_date"]
    l_sex?: schema.animalsTypeInsert["l_sex"]
    l_arriving_method?: schema.animalArrivingTypeInsert["l_arriving_method"]
    l_arriving_date?: schema.animalArrivingTypeInsert["l_arriving_date"]
  },
): Promise<schema.animalsTypeSelect["l_id_animal"]> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "addAnimal")

    return await fdm.transaction(async (tx) => {
      const l_id_animal = createId()
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

      await tx.insert(schema.animals).values({
        l_id_animal,
        l_id_eartag: properties?.l_id_eartag ?? null,
        l_id_worknumber: properties?.l_id_worknumber ?? null,
        l_species: properties?.l_species ?? "cattle",
        l_breed: properties?.l_breed ?? null,
        l_coatcolor: properties?.l_coatcolor ?? null,
        l_birth_date: birthdate,
        l_sex: properties?.l_sex ?? null,
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

      // Set b_farm_livestock = true on farm
      await tx
        .update(schema.farms)
        .set({ b_farm_livestock: true, updated: new Date() })
        .where(eq(schema.farms.b_id_farm, b_id_farm))

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
 * @param b_id_animal - Animal ID.
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
        l_species: schema.animals.l_species,
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
        l_species: schema.animals.l_species,
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
 * @returns Array of active animals for the farm.
 */
export async function getAnimalsForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<Animal[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getAnimalsForFarm")

    const rows = await fdm
      .select({
        l_id_animal: schema.animals.l_id_animal,
        l_id_eartag: schema.animals.l_id_eartag,
        l_id_worknumber: schema.animals.l_id_worknumber,
        l_species: schema.animals.l_species,
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
          isNull(schema.animalAssigning.l_assigning_end),
        ),
      )
      .where(isNull(schema.animalLeaving.l_leaving_date))
      .orderBy(desc(schema.animals.created))

    return rows as Animal[]
  } catch (err) {
    throw handleError(err, "Exception for getAnimalsForFarm", { b_id_farm })
  }
}

/**
 * Updates properties of an existing animal.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal updating the animal.
 * @param b_id_animal - Animal ID.
 * @param properties - Properties to update.
 */
export async function updateAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  properties: {
    l_id_eartag?: schema.animalsTypeInsert["l_id_eartag"]
    l_id_worknumber?: schema.animalsTypeInsert["l_id_worknumber"]
    l_species?: schema.animalsTypeInsert["l_species"]
    l_breed?: schema.animalsTypeInsert["l_breed"]
    l_coatcolor?: schema.animalsTypeInsert["l_coatcolor"]
    l_birth_date?: schema.animalsTypeInsert["l_birth_date"]
    l_sex?: schema.animalsTypeInsert["l_sex"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "updateAnimal")

    await fdm
      .update(schema.animals)
      .set({
        ...properties,
        updated: new Date(),
      })
      .where(eq(schema.animals.l_id_animal, l_id_animal))
  } catch (err) {
    throw handleError(err, "Exception for updateAnimal", { l_id_animal, properties })
  }
}

/**
 * Removes an animal by closing its herd assignment and setting animal_leaving.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the animal.
 * @param l_id_animal - Animal ID.
 * @param leavingMethod - Reason for leaving.
 */
export async function removeAnimal(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  leavingMethod: (typeof schema.leavingMethodOptions)[number]["value"] = "sold",
): Promise<void> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "removeAnimal")

    return await fdm.transaction(async (tx) => {
      const now = new Date()

      // Close active assignment
      await tx
        .update(schema.animalAssigning)
        .set({ l_assigning_end: now, updated: now })
        .where(
          and(
            eq(schema.animalAssigning.l_id_animal, l_id_animal),
            isNull(schema.animalAssigning.l_assigning_end),
          ),
        )

      // Set animal leaving
      await tx
        .insert(schema.animalLeaving)
        .values({
          l_id_animal,
          l_leaving_date: now,
          l_leaving_method: leavingMethod,
        })
        .onConflictDoUpdate({
          target: schema.animalLeaving.l_id_animal,
          set: { l_leaving_date: now, l_leaving_method: leavingMethod, updated: now },
        })
    })
  } catch (err) {
    throw handleError(err, "Exception for removeAnimal", { l_id_animal })
  }
}

/**
 * Bulk-adjusts the animal count for a herd.
 * Adding animals creates count placeholder animals; reducing count closes newest assignments and marks animals leaving.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal executing bulk adjustment.
 * @param l_id_herd - Herd ID.
 * @param count - Target active animal count for the herd.
 * @param defaults - Optional default attributes for newly created animals.
 */
export async function addAnimalsToHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  count: number,
  defaults?: {
    l_species?: schema.animalsTypeInsert["l_species"]
    l_breed?: schema.animalsTypeInsert["l_breed"]
    l_arriving_method?: schema.animalArrivingTypeInsert["l_arriving_method"]
  },
): Promise<string[]> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "addAnimalsToHerd")

    return await fdm.transaction(async (tx) => {
      // Find farm for this herd
      const herdRow = await tx
        .select({
          b_id_farm: schema.herdStarting.b_id_farm,
        })
        .from(schema.herdStarting)
        .where(eq(schema.herdStarting.l_id_herd, l_id_herd))
        .limit(1)

      if (herdRow.length === 0) {
        throw new Error("Herd does not exist")
      }

      const b_id_farm = herdRow[0].b_id_farm

      // Get current active assignments for this herd
      const currentActive = await tx
        .select({
          l_id_animal: schema.animalAssigning.l_id_animal,
          l_assigning_start: schema.animalAssigning.l_assigning_start,
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
        .orderBy(desc(schema.animalAssigning.l_assigning_start), desc(schema.animals.created))

      const currentCount = currentActive.length
      const now = new Date()

      if (count > currentCount) {
        const needed = count - currentCount
        for (let i = 0; i < needed; i++) {
          const l_id_animal = createId()

          await tx.insert(schema.animals).values({
            l_id_animal,
            l_species: defaults?.l_species ?? "cattle",
            l_breed: defaults?.l_breed ?? null,
          })

          await tx.insert(schema.animalArriving).values({
            l_id_animal,
            b_id_farm,
            l_arriving_date: now,
            l_arriving_method: defaults?.l_arriving_method ?? "born",
          })

          await tx.insert(schema.animalAssigning).values({
            l_id_animal,
            l_id_herd,
            l_assigning_start: now,
            l_assigning_end: null,
          })
        }

        // Set b_farm_livestock = true on farm
        await tx
          .update(schema.farms)
          .set({ b_farm_livestock: true, updated: now })
          .where(eq(schema.farms.b_id_farm, b_id_farm))
      } else if (count < currentCount) {
        const surplus = currentCount - count
        const toRemove = currentActive.slice(0, surplus)

        for (const item of toRemove) {
          await tx
            .update(schema.animalAssigning)
            .set({ l_assigning_end: now, updated: now })
            .where(
              and(
                eq(schema.animalAssigning.l_id_animal, item.l_id_animal),
                eq(schema.animalAssigning.l_id_herd, l_id_herd),
                isNull(schema.animalAssigning.l_assigning_end),
              ),
            )

          await tx.insert(schema.animalLeaving).values({
            l_id_animal: item.l_id_animal,
            l_leaving_date: now,
            l_leaving_method: "sold",
          })
        }
      }

      // Query active animal IDs for this herd after update
      const activeRows = await tx
        .select({
          l_id_animal: schema.animalAssigning.l_id_animal,
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

      return activeRows.map((r) => r.l_id_animal)
    })
  } catch (err) {
    throw handleError(err, "Exception for addAnimalsToHerd", { l_id_herd, count })
  }
}

/**
 * Reassigns an animal to a new RVO statutory category (e.g. transitioning youngstock `rvo_101` to dairy cow `rvo_100` upon calving).
 * Closes the current herd assignment and opens a new assignment in a herd matching the target category (creating the herd if needed).
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal updating the category.
 * @param l_id_animal - Unique identifier of the animal.
 * @param new_category - Target RVO animal category code.
 * @returns Unique identifier of the target herd.
 */
export async function setAnimalCategory(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_animal: schema.animalsTypeSelect["l_id_animal"],
  new_category: (typeof schema.animalCategoryOptions)[number]["value"],
): Promise<string> {
  try {
    await checkPermission(fdm, "animal", "write", l_id_animal, principal_id, "setAnimalCategory")

    return await fdm.transaction(async (tx) => {
      // Find farm for this animal
      const arriving = await tx
        .select({
          b_id_farm: schema.animalArriving.b_id_farm,
        })
        .from(schema.animalArriving)
        .where(eq(schema.animalArriving.l_id_animal, l_id_animal))
        .limit(1)

      if (arriving.length === 0) {
        throw new Error("Animal farm association not found")
      }

      const b_id_farm = arriving[0].b_id_farm
      const now = new Date()

      // Find existing herd on farm for new_category
      const categoryHerds = await tx
        .select({
          l_id_herd: schema.herds.l_id_herd,
        })
        .from(schema.herds)
        .innerJoin(schema.herdStarting, eq(schema.herds.l_id_herd, schema.herdStarting.l_id_herd))
        .leftJoin(schema.herdEnding, eq(schema.herds.l_id_herd, schema.herdEnding.l_id_herd))
        .where(
          and(
            eq(schema.herdStarting.b_id_farm, b_id_farm),
            eq(schema.herds.l_herd_category, new_category),
            isNull(schema.herdEnding.l_end),
          ),
        )
        .limit(1)

      let targetHerdId: string
      if (categoryHerds.length > 0) {
        targetHerdId = categoryHerds[0].l_id_herd
      } else {
        // Create new herd for this category on the farm
        targetHerdId = createId()
        const optionLabel =
          schema.animalCategoryOptions.find((o) => o.value === new_category)?.label ??
          `Category ${new_category}`

        await tx.insert(schema.herds).values({
          l_id_herd: targetHerdId,
          l_herd_name: optionLabel,
          l_herd_category: new_category,
        })

        await tx.insert(schema.herdStarting).values({
          l_id_herd: targetHerdId,
          b_id_farm,
          l_start: now,
        })
      }

      // Close current active assignment for animal
      await tx
        .update(schema.animalAssigning)
        .set({ l_assigning_end: now, updated: now })
        .where(
          and(
            eq(schema.animalAssigning.l_id_animal, l_id_animal),
            isNull(schema.animalAssigning.l_assigning_end),
          ),
        )

      // Open new assignment into target herd
      await tx.insert(schema.animalAssigning).values({
        l_id_animal,
        l_id_herd: targetHerdId,
        l_assigning_start: now,
        l_assigning_end: null,
      })

      return targetHerdId
    })
  } catch (err) {
    throw handleError(err, "Exception for setAnimalCategory", { l_id_animal, new_category })
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
        l_herd_category: schema.herds.l_herd_category,
        count: count(schema.animalAssigning.l_id_animal),
      })
      .from(schema.herds)
      .innerJoin(schema.herdStarting, eq(schema.herds.l_id_herd, schema.herdStarting.l_id_herd))
      .leftJoin(schema.herdEnding, eq(schema.herds.l_id_herd, schema.herdEnding.l_id_herd))
      .leftJoin(
        schema.animalAssigning,
        and(
          eq(schema.herds.l_id_herd, schema.animalAssigning.l_id_herd),
          lte(schema.animalAssigning.l_assigning_start, atDate),
          or(
            isNull(schema.animalAssigning.l_assigning_end),
            sql`${schema.animalAssigning.l_assigning_end} > ${atDate}`,
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
        and(
          eq(schema.herdStarting.b_id_farm, b_id_farm),
          isNull(schema.herdEnding.l_end),
          isNull(schema.animalLeaving.l_leaving_date),
        ),
      )
      .groupBy(schema.herds.l_id_herd, schema.herds.l_herd_name, schema.herds.l_herd_category)

    return rows.map((r) => ({
      l_id_herd: r.l_id_herd,
      l_herd_name: r.l_herd_name,
      l_herd_category: r.l_herd_category,
      count: Number(r.count),
    }))
  } catch (err) {
    throw handleError(err, "Exception for getCensusForFarm", { b_id_farm, atDate })
  }
}
