import { and, desc, eq, isNull } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { Barn, Housing } from "./barn.types"
import type { FdmType } from "./fdm.types"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"
import { assertIntervalEndNotBeforeStart, overlapsHalfOpen } from "./interval"

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
    b_barn_decommissioning_date?: schema.barnDecommissioningTypeInsert["b_barn_decommissioning_date"]
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

      if (properties?.b_barn_decommissioning_date) {
        await tx.insert(schema.barnDecommissioning).values({
          b_id_barn,
          b_barn_decommissioning_date: properties.b_barn_decommissioning_date,
        })
      }

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
 * Updates properties of an existing barn. Setting
 * `b_barn_decommissioning_date` records that the barn was decommissioned
 * (upserted into `barn_decommissioning`).
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
    b_barn_decommissioning_date?: schema.barnDecommissioningTypeInsert["b_barn_decommissioning_date"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "barn", "write", b_id_barn, principal_id, "updateBarn")

    const { b_barn_decommissioning_date, ...barnProperties } = properties
    const updated = new Date()

    await fdm.transaction(async (tx) => {
      await tx
        .update(schema.barns)
        .set({ ...barnProperties, updated })
        .where(eq(schema.barns.b_id_barn, b_id_barn))

      if (b_barn_decommissioning_date !== undefined) {
        await tx
          .insert(schema.barnDecommissioning)
          .values({ b_id_barn, b_barn_decommissioning_date })
          .onConflictDoUpdate({
            target: schema.barnDecommissioning.b_id_barn,
            set: { b_barn_decommissioning_date, updated },
          })
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for updateBarn", {
      b_id_barn,
      b_barn_name: properties.b_barn_name,
      b_floor_area: properties.b_floor_area,
    })
  }
}

/**
 * Hard-deletes a barn asset and its own lifecycle rows (`barn_constructing`,
 * `barn_decommissioning`). Guarded: rejected if any herd is currently or was
 * ever housed in this barn — that represents another asset's history and
 * must be cleaned up first. To record that a barn was decommissioned without
 * deleting it, use {@link updateBarn} with `b_barn_decommissioning_date`.
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
      const housingRecords = await tx
        .select({ b_id_barn: schema.housing.b_id_barn })
        .from(schema.housing)
        .where(eq(schema.housing.b_id_barn, b_id_barn))
        .limit(1)

      if (housingRecords.length > 0) {
        throw new Error("Cannot remove barn: a herd is or was housed in it")
      }

      await tx
        .delete(schema.barnDecommissioning)
        .where(eq(schema.barnDecommissioning.b_id_barn, b_id_barn))
      await tx
        .delete(schema.barnConstructing)
        .where(eq(schema.barnConstructing.b_id_barn, b_id_barn))
      await tx.delete(schema.barns).where(eq(schema.barns.b_id_barn, b_id_barn))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeBarn", { b_id_barn })
  }
}

/**
 * Assigns a herd to a barn for a period (housing action).
 * Tracking indoor housing periods alongside outdoor grazing events is fundamental for calculating ammonia emission factors,
 * floor slurry accumulation, and seasonal housing vs grazing days.
 * Housing intervals for the same herd may not overlap, regardless of barn.
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
    await fdm.transaction(async (tx) => {
      await checkPermission(tx, "herd", "write", l_id_herd, principal_id, "addHousing")
      assertIntervalEndNotBeforeStart(b_housing_start, b_housing_end, "b_housing")
      await assertNoOverlappingHousingForHerd(
        tx,
        l_id_herd,
        b_housing_start,
        b_housing_end ?? null,
      )

      await tx.insert(schema.housing).values({
        l_id_herd,
        b_id_barn,
        b_housing_start,
        b_housing_end: b_housing_end ?? null,
      })
    })
  } catch (err) {
    throw handleError(err, "Exception for addHousing", { l_id_herd, b_id_barn, b_housing_start })
  }
}

/**
 * Corrects an existing housing action, identified by its full composite key.
 * The updated interval must remain non-overlapping with other housing intervals for the same herd.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the housing action.
 * @param l_id_herd - Herd ID.
 * @param b_id_barn - Barn ID.
 * @param b_housing_start - Housing start date/time.
 * @param properties - Fields to correct.
 */
export async function updateHousing(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  b_id_barn: schema.barnsTypeSelect["b_id_barn"],
  b_housing_start: schema.housingTypeSelect["b_housing_start"],
  properties: {
    b_housing_end?: schema.housingTypeInsert["b_housing_end"]
  },
): Promise<void> {
  try {
    await fdm.transaction(async (tx) => {
      await checkPermission(tx, "herd", "write", l_id_herd, principal_id, "updateHousing")

      const existingRows = await tx
        .select({
          b_housing_end: schema.housing.b_housing_end,
        })
        .from(schema.housing)
        .where(
          and(
            eq(schema.housing.l_id_herd, l_id_herd),
            eq(schema.housing.b_id_barn, b_id_barn),
            eq(schema.housing.b_housing_start, b_housing_start),
          ),
        )
        .limit(1)

      if (existingRows.length === 0) {
        throw new Error("Housing record not found")
      }

      const nextEnd =
        properties.b_housing_end === undefined ? existingRows[0].b_housing_end : properties.b_housing_end

      assertIntervalEndNotBeforeStart(b_housing_start, nextEnd, "b_housing")
      await assertNoOverlappingHousingForHerd(tx, l_id_herd, b_housing_start, nextEnd, {
        b_id_barn,
        b_housing_start,
      })

      await tx
        .update(schema.housing)
        .set({ ...properties, updated: new Date() })
        .where(
          and(
            eq(schema.housing.l_id_herd, l_id_herd),
            eq(schema.housing.b_id_barn, b_id_barn),
            eq(schema.housing.b_housing_start, b_housing_start),
          ),
        )
    })
  } catch (err) {
    throw handleError(err, "Exception for updateHousing", {
      l_id_herd,
      b_id_barn,
      b_housing_start,
      properties,
    })
  }
}

async function assertNoOverlappingHousingForHerd(
  tx: FdmType,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  b_housing_start: Date,
  b_housing_end: Date | null,
  exclude?: {
    b_id_barn: schema.barnsTypeSelect["b_id_barn"]
    b_housing_start: schema.housingTypeSelect["b_housing_start"]
  },
): Promise<void> {
  const housingRows = await tx
    .select({
      b_id_barn: schema.housing.b_id_barn,
      b_housing_start: schema.housing.b_housing_start,
      b_housing_end: schema.housing.b_housing_end,
    })
    .from(schema.housing)
    .where(eq(schema.housing.l_id_herd, l_id_herd))

  for (const row of housingRows) {
    if (
      exclude &&
      row.b_id_barn === exclude.b_id_barn &&
      row.b_housing_start.getTime() === exclude.b_housing_start.getTime()
    ) {
      continue
    }

    if (overlapsHalfOpen(b_housing_start, b_housing_end, row.b_housing_start, row.b_housing_end)) {
      throw new Error("Housing interval overlaps an existing housing interval for this herd")
    }
  }
}

/**
 * Hard-deletes a housing action, identified by its full composite key.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the housing action.
 * @param l_id_herd - Herd ID.
 * @param b_id_barn - Barn ID.
 * @param b_housing_start - Housing start date/time.
 */
export async function removeHousing(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  b_id_barn: schema.barnsTypeSelect["b_id_barn"],
  b_housing_start: schema.housingTypeSelect["b_housing_start"],
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "removeHousing")

    const result = await fdm
      .delete(schema.housing)
      .where(
        and(
          eq(schema.housing.l_id_herd, l_id_herd),
          eq(schema.housing.b_id_barn, b_id_barn),
          eq(schema.housing.b_housing_start, b_housing_start),
        ),
      )
      .returning({ l_id_herd: schema.housing.l_id_herd })

    if (result.length === 0) {
      throw new Error("Housing record not found")
    }
  } catch (err) {
    throw handleError(err, "Exception for removeHousing", {
      l_id_herd,
      b_id_barn,
      b_housing_start,
    })
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

/**
 * Retrieves housing records for a farm.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting housing records.
 * @param b_id_farm - Farm ID.
 * @returns Array of housing records for the farm.
 */
export async function getHousingForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<Housing[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getHousingForFarm")

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
      .innerJoin(
        schema.barnConstructing,
        eq(schema.housing.b_id_barn, schema.barnConstructing.b_id_barn),
      )
      .where(eq(schema.barnConstructing.b_id_farm, b_id_farm))
      .orderBy(desc(schema.housing.b_housing_start))

    return rows as Housing[]
  } catch (err) {
    throw handleError(err, "Exception for getHousingForFarm", { b_id_farm })
  }
}
