import { and, desc, eq, isNull } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { Barn, Housing } from "./barn.types"
import type { FdmType } from "./fdm.types"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"

/**
 * Adds a new barn asset to a farm and records its construction/acquisition event.
 * Physical properties like floor area (`b_floor_area` in m²) and spatial geometry (`b_barn_geometry`)
 * are stored on the barn asset.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal creating the barn.
 * @param b_id_farm - Identifier of the farm acquiring the barn.
 * @param properties - Optional properties for the barn.
 * @returns Unique identifier of the newly created barn.
 */
export async function addBarn(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  properties?: {
    b_barn_name?: schema.barnsTypeInsert["b_barn_name"]
    b_floor_area?: schema.barnsTypeInsert["b_floor_area"]
    b_barn_geometry?: schema.barnsTypeInsert["b_barn_geometry"]
    b_barn_constructing_date?: schema.barnConstructingTypeInsert["b_barn_constructing_date"]
  },
): Promise<schema.barnsTypeSelect["b_id_barn"]> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "addBarn")

    return await fdm.transaction(async (tx) => {
      const b_id_barn = createId()

      await tx.insert(schema.barns).values({
        b_id_barn,
        b_barn_name: properties?.b_barn_name ?? null,
        b_floor_area: properties?.b_floor_area ?? null,
        b_barn_geometry: properties?.b_barn_geometry ?? null,
      })

      await tx.insert(schema.barnConstructing).values({
        b_id_barn,
        b_id_farm,
        b_barn_constructing_date: properties?.b_barn_constructing_date ?? new Date(),
      })

      return b_id_barn
    })
  } catch (err) {
    throw handleError(err, "Exception for addBarn", {
      b_id_farm,
      b_barn_name: properties?.b_barn_name,
      b_floor_area: properties?.b_floor_area,
      b_barn_constructing_date: properties?.b_barn_constructing_date,
    })
  }
}

/**
 * Retrieves details for a specific barn.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting barn details.
 * @param b_id_barn - Identifier of the barn.
 * @returns Barn details object.
 */
export async function getBarn(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_barn: schema.barnsTypeSelect["b_id_barn"],
): Promise<Barn> {
  try {
    await checkPermission(fdm, "barn", "read", b_id_barn, principal_id, "getBarn")

    const rows = await fdm
      .select({
        b_id_barn: schema.barns.b_id_barn,
        b_barn_name: schema.barns.b_barn_name,
        b_floor_area: schema.barns.b_floor_area,
        b_barn_geometry: schema.barns.b_barn_geometry,
        b_id_farm: schema.barnConstructing.b_id_farm,
        b_barn_constructing_date: schema.barnConstructing.b_barn_constructing_date,
        b_barn_decommissioning_date: schema.barnDecommissioning.b_barn_decommissioning_date,
        created: schema.barns.created,
        updated: schema.barns.updated,
      })
      .from(schema.barns)
      .innerJoin(
        schema.barnConstructing,
        eq(schema.barns.b_id_barn, schema.barnConstructing.b_id_barn),
      )
      .leftJoin(
        schema.barnDecommissioning,
        eq(schema.barns.b_id_barn, schema.barnDecommissioning.b_id_barn),
      )
      .where(eq(schema.barns.b_id_barn, b_id_barn))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Barn does not exist")
    }

    return rows[0] as Barn
  } catch (err) {
    throw handleError(err, "Exception for getBarn", { b_id_barn })
  }
}

/**
 * Retrieves all barns for a specified farm.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting barns.
 * @param b_id_farm - Farm ID.
 * @returns Array of barns.
 */
export async function getBarnsForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<Barn[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getBarnsForFarm")

    const rows = await fdm
      .select({
        b_id_barn: schema.barns.b_id_barn,
        b_barn_name: schema.barns.b_barn_name,
        b_floor_area: schema.barns.b_floor_area,
        b_barn_geometry: schema.barns.b_barn_geometry,
        b_id_farm: schema.barnConstructing.b_id_farm,
        b_barn_constructing_date: schema.barnConstructing.b_barn_constructing_date,
        b_barn_decommissioning_date: schema.barnDecommissioning.b_barn_decommissioning_date,
        created: schema.barns.created,
        updated: schema.barns.updated,
      })
      .from(schema.barns)
      .innerJoin(
        schema.barnConstructing,
        eq(schema.barns.b_id_barn, schema.barnConstructing.b_id_barn),
      )
      .leftJoin(
        schema.barnDecommissioning,
        eq(schema.barns.b_id_barn, schema.barnDecommissioning.b_id_barn),
      )
      .where(
        and(
          eq(schema.barnConstructing.b_id_farm, b_id_farm),
          isNull(schema.barnDecommissioning.b_barn_decommissioning_date),
        ),
      )
      .orderBy(desc(schema.barns.created))

    return rows as Barn[]
  } catch (err) {
    throw handleError(err, "Exception for getBarnsForFarm", { b_id_farm })
  }
}

/**
 * Updates properties of an existing barn.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal updating the barn.
 * @param b_id_barn - Identifier of the barn.
 * @param properties - Properties to update.
 */
export async function updateBarn(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_barn: schema.barnsTypeSelect["b_id_barn"],
  properties: {
    b_barn_name?: schema.barnsTypeInsert["b_barn_name"]
    b_floor_area?: schema.barnsTypeInsert["b_floor_area"]
    b_barn_geometry?: schema.barnsTypeInsert["b_barn_geometry"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "barn", "write", b_id_barn, principal_id, "updateBarn")

    await fdm
      .update(schema.barns)
      .set({
        ...properties,
        updated: new Date(),
      })
      .where(eq(schema.barns.b_id_barn, b_id_barn))
  } catch (err) {
    throw handleError(err, "Exception for updateBarn", {
      b_id_barn,
      b_barn_name: properties.b_barn_name,
      b_floor_area: properties.b_floor_area,
    })
  }
}

/**
 * Removes a barn by setting its end date in barn_decommissioning.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the barn.
 * @param b_id_barn - Identifier of the barn.
 */
export async function removeBarn(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_barn: schema.barnsTypeSelect["b_id_barn"],
): Promise<void> {
  try {
    await checkPermission(fdm, "barn", "write", b_id_barn, principal_id, "removeBarn")

    await fdm.transaction(async (tx) => {
      await tx
        .insert(schema.barnDecommissioning)
        .values({
          b_id_barn,
          b_barn_decommissioning_date: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.barnDecommissioning.b_id_barn,
          set: { b_barn_decommissioning_date: new Date(), updated: new Date() },
        })
    })
  } catch (err) {
    throw handleError(err, "Exception for removeBarn", { b_id_barn })
  }
}

/**
 * Assigns a herd to a barn for a period (housing action).
 * Tracking indoor housing periods alongside outdoor grazing events is fundamental for calculating ammonia emission factors,
 * floor slurry accumulation, and seasonal housing vs grazing days.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal making the housing assignment.
 * @param l_id_herd - Herd ID.
 * @param b_id_barn - Barn ID.
 * @param b_housing_start - Start timestamp.
 * @param b_housing_end - Optional end timestamp.
 */
export async function addHousing(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  b_id_barn: schema.barnsTypeSelect["b_id_barn"],
  b_housing_start = new Date(),
  b_housing_end?: Date,
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "addHousing")

    await fdm.insert(schema.housing).values({
      l_id_herd,
      b_id_barn,
      b_housing_start,
      b_housing_end: b_housing_end ?? null,
    })
  } catch (err) {
    throw handleError(err, "Exception for addHousing", { l_id_herd, b_id_barn, b_housing_start })
  }
}

/**
 * Retrieves housing history for a specified herd.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting housing records.
 * @param l_id_herd - Herd ID.
 * @returns Array of housing records.
 */
export async function getHousingForHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
): Promise<Housing[]> {
  try {
    await checkPermission(fdm, "herd", "read", l_id_herd, principal_id, "getHousingForHerd")

    const rows = await fdm
      .select({
        l_id_herd: schema.housing.l_id_herd,
        b_id_barn: schema.housing.b_id_barn,
        b_housing_start: schema.housing.b_housing_start,
        b_housing_end: schema.housing.b_housing_end,
        created: schema.housing.created,
        updated: schema.housing.updated,
      })
      .from(schema.housing)
      .where(eq(schema.housing.l_id_herd, l_id_herd))
      .orderBy(desc(schema.housing.b_housing_start))

    return rows as Housing[]
  } catch (err) {
    throw handleError(err, "Exception for getHousingForHerd", { l_id_herd })
  }
}
