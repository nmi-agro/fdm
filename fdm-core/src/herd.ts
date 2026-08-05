import { and, desc, eq, isNull } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type { Herd } from "./herd.types"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"

/**
 * Adds a new herd asset to a farm and records its initial starting event.
 *
 * In Dutch livestock reporting (such as RVO compliance and statutory manure standards), animals are grouped into herds
 * sharing common management, feeding, and statutory categories (e.g. `rvo_100` for dairy cows, `rvo_101` for youngstock <1 year).
 * Creating a herd on a farm does not automatically flag the farm as having livestock;
 * `farms.b_farm_livestock` is set when an animal is added via `addAnimal`.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal creating the herd.
 * @param b_id_farm - Identifier of the farm acquiring the herd.
 * @param properties - Optional properties for the herd.
 * @returns Unique identifier of the newly created herd.
 */
export async function addHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  properties?: {
    l_herd_name?: schema.herdsTypeInsert["l_herd_name"]
    l_herd_category?: schema.herdsTypeInsert["l_herd_category"]
    l_start?: schema.herdStartingTypeInsert["l_start"]
    l_end?: schema.herdEndingTypeInsert["l_end"]
  },
): Promise<schema.herdsTypeSelect["l_id_herd"]> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "addHerd")

    return await fdm.transaction(async (tx) => {
      const l_id_herd = createId()

      await tx.insert(schema.herds).values({
        l_id_herd,
        l_herd_name: properties?.l_herd_name ?? null,
        l_herd_category: properties?.l_herd_category ?? null,
      })

      await tx.insert(schema.herdStarting).values({
        l_id_herd,
        b_id_farm,
        l_start: properties?.l_start ?? new Date(),
      })

      if (properties?.l_end) {
        await tx.insert(schema.herdEnding).values({
          l_id_herd,
          l_end: properties.l_end,
        })
      }

      return l_id_herd
    })
  } catch (err) {
    throw handleError(err, "Exception for addHerd", {
      b_id_farm,
      properties,
    })
  }
}

/**
 * Retrieves details for a specific herd.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal requesting herd details.
 * @param l_id_herd - Unique identifier of the herd.
 * @returns Details of the requested herd.
 */
export async function getHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
): Promise<Herd> {
  try {
    await checkPermission(fdm, "herd", "read", l_id_herd, principal_id, "getHerd")

    const rows = await fdm
      .select({
        l_id_herd: schema.herds.l_id_herd,
        l_herd_name: schema.herds.l_herd_name,
        l_herd_category: schema.herds.l_herd_category,
        b_id_farm: schema.herdStarting.b_id_farm,
        l_start: schema.herdStarting.l_start,
        l_end: schema.herdEnding.l_end,
        created: schema.herds.created,
        updated: schema.herds.updated,
      })
      .from(schema.herds)
      .innerJoin(schema.herdStarting, eq(schema.herds.l_id_herd, schema.herdStarting.l_id_herd))
      .leftJoin(schema.herdEnding, eq(schema.herds.l_id_herd, schema.herdEnding.l_id_herd))
      .where(eq(schema.herds.l_id_herd, l_id_herd))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Herd does not exist")
    }

    return rows[0] as Herd
  } catch (err) {
    throw handleError(err, "Exception for getHerd", { l_id_herd })
  }
}

/**
 * Retrieves all currently active herds for a specified farm.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal requesting herds.
 * @param b_id_farm - Unique identifier of the farm.
 * @returns Array of active herds for the farm.
 */
export async function getHerdsForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<Herd[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getHerdsForFarm")

    const rows = await fdm
      .select({
        l_id_herd: schema.herds.l_id_herd,
        l_herd_name: schema.herds.l_herd_name,
        l_herd_category: schema.herds.l_herd_category,
        b_id_farm: schema.herdStarting.b_id_farm,
        l_start: schema.herdStarting.l_start,
        l_end: schema.herdEnding.l_end,
        created: schema.herds.created,
        updated: schema.herds.updated,
      })
      .from(schema.herds)
      .innerJoin(schema.herdStarting, eq(schema.herds.l_id_herd, schema.herdStarting.l_id_herd))
      .leftJoin(schema.herdEnding, eq(schema.herds.l_id_herd, schema.herdEnding.l_id_herd))
      .where(and(eq(schema.herdStarting.b_id_farm, b_id_farm), isNull(schema.herdEnding.l_end)))
      .orderBy(desc(schema.herds.created))

    return rows as Herd[]
  } catch (err) {
    throw handleError(err, "Exception for getHerdsForFarm", { b_id_farm })
  }
}

/**
 * Updates properties of an existing herd asset. Setting `l_end` records that
 * the herd has ended (upserted into `herd_ending`).
 *
 * @remarks
 * Allows updating display name (`l_herd_name`) or primary RVO animal category (`l_herd_category`).
 * Checks write permission on the herd resource chain.
 *
 * @param fdm - The FDM database connection instance.
 * @param principal_id - Identifier of the principal updating the herd.
 * @param l_id_herd - Unique identifier of the herd.
 * @param properties - Object containing updated properties.
 */
export async function updateHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  properties: {
    l_herd_name?: schema.herdsTypeInsert["l_herd_name"]
    l_herd_category?: schema.herdsTypeInsert["l_herd_category"]
    l_end?: schema.herdEndingTypeInsert["l_end"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "updateHerd")

    const { l_end, ...herdProperties } = properties
    const updated = new Date()

    await fdm.transaction(async (tx) => {
      await tx
        .update(schema.herds)
        .set({ ...herdProperties, updated })
        .where(eq(schema.herds.l_id_herd, l_id_herd))

      if (l_end !== undefined) {
        await tx
          .insert(schema.herdEnding)
          .values({ l_id_herd, l_end })
          .onConflictDoUpdate({
            target: schema.herdEnding.l_id_herd,
            set: { l_end, updated },
          })
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for updateHerd", { l_id_herd, properties })
  }
}

/**
 * Hard-deletes a herd asset and its own lifecycle rows (`herd_starting`,
 * `herd_ending`). Guarded: rejected if any animal is currently or was ever
 * assigned to this herd, or if the herd is/was housed in a barn — those
 * represent other assets' history and must be cleaned up first. To record
 * that a herd ended without deleting it, use {@link updateHerd} with `l_end`.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal removing the herd.
 * @param l_id_herd - Unique identifier of the herd.
 */
export async function removeHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "removeHerd")

    await fdm.transaction(async (tx) => {
      const assignedAnimals = await tx
        .select({ l_id_animal: schema.animalAssigning.l_id_animal })
        .from(schema.animalAssigning)
        .where(eq(schema.animalAssigning.l_id_herd, l_id_herd))
        .limit(1)

      if (assignedAnimals.length > 0) {
        throw new Error("Cannot remove herd: an animal is assigned to it")
      }

      const housingRecords = await tx
        .select({ l_id_herd: schema.housing.l_id_herd })
        .from(schema.housing)
        .where(eq(schema.housing.l_id_herd, l_id_herd))
        .limit(1)

      if (housingRecords.length > 0) {
        throw new Error("Cannot remove herd: it is or was housed in a barn")
      }

      await tx.delete(schema.herdEnding).where(eq(schema.herdEnding.l_id_herd, l_id_herd))
      await tx.delete(schema.herdStarting).where(eq(schema.herdStarting.l_id_herd, l_id_herd))
      await tx.delete(schema.herds).where(eq(schema.herds.l_id_herd, l_id_herd))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeHerd", { l_id_herd })
  }
}
