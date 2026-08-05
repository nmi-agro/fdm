import { desc, eq, inArray, type SQL } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type { Grazing } from "./grazing.types"
import type { Timeframe } from "./timeframe"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"
import { withTimeframe } from "./timeframe"

/**
 * Records an outdoor pasture grazing action for a herd on a farm field parcel.
 * Allows logging grazing start/end dates, daily grazing hours, grazed area in hectares,
 * and grazing regime (full vs partial day). Total grazing days are derived from the
 * start/end dates in the calculator layer rather than stored here.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal recording the grazing action.
 * @param l_id_herd - Herd ID.
 * @param l_grazing_start - Start timestamp.
 * @param properties - Optional field ID, end timestamp, hours, area, and grazing type.
 */
export async function addGrazing(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  l_grazing_start = new Date(),
  properties?: {
    b_id?: schema.grazingTypeInsert["b_id"]
    l_grazing_end?: schema.grazingTypeInsert["l_grazing_end"]
    l_grazing_hours?: schema.grazingTypeInsert["l_grazing_hours"]
    l_grazing_area?: schema.grazingTypeInsert["l_grazing_area"]
    l_grazing_type?: schema.grazingTypeInsert["l_grazing_type"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "addGrazing")

    return await fdm.transaction(async (tx) => {
      if (properties?.b_id) {
        const herdFarm = await tx
          .select({ b_id_farm: schema.herdStarting.b_id_farm })
          .from(schema.herdStarting)
          .where(eq(schema.herdStarting.l_id_herd, l_id_herd))
          .limit(1)

        const fieldFarm = await tx
          .select({ b_id_farm: schema.fieldAcquiring.b_id_farm })
          .from(schema.fieldAcquiring)
          .where(eq(schema.fieldAcquiring.b_id, properties.b_id))
          .limit(1)

        if (
          herdFarm.length === 0 ||
          fieldFarm.length === 0 ||
          herdFarm[0].b_id_farm !== fieldFarm[0].b_id_farm
        ) {
          throw new Error(`Field ${properties.b_id} does not belong to the herd's farm`)
        }
      }

      await tx.insert(schema.grazing).values({
        l_id_grazing: createId(),
        l_id_herd,
        l_grazing_start,
        b_id: properties?.b_id ?? null,
        l_grazing_end: properties?.l_grazing_end ?? null,
        l_grazing_hours: properties?.l_grazing_hours ?? null,
        l_grazing_area: properties?.l_grazing_area ?? null,
        l_grazing_type: properties?.l_grazing_type ?? null,
      })
    })
  } catch (err) {
    throw handleError(err, "Exception for addGrazing", { l_id_herd, l_grazing_start, properties })
  }
}

/**
 * Retrieves grazing actions for a specified herd.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param l_id_herd - Herd ID.
 * @param timeframe - Optional timeframe filter.
 * @returns Array of grazing records.
 */
export async function getGrazingForHerd(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  timeframe?: Timeframe,
): Promise<Grazing[]> {
  try {
    await checkPermission(fdm, "herd", "read", l_id_herd, principal_id, "getGrazingForHerd")

    let dateWhere: SQL | undefined = eq(schema.grazing.l_id_herd, l_id_herd)
    dateWhere = withTimeframe(dateWhere, schema.grazing.l_grazing_start, timeframe)

    const rows = await fdm
      .select({
        l_id_grazing: schema.grazing.l_id_grazing,
        b_id: schema.grazing.b_id,
        l_id_herd: schema.grazing.l_id_herd,
        l_grazing_start: schema.grazing.l_grazing_start,
        l_grazing_end: schema.grazing.l_grazing_end,
        l_grazing_hours: schema.grazing.l_grazing_hours,
        l_grazing_area: schema.grazing.l_grazing_area,
        l_grazing_type: schema.grazing.l_grazing_type,
        created: schema.grazing.created,
        updated: schema.grazing.updated,
      })
      .from(schema.grazing)
      .where(dateWhere)
      .orderBy(desc(schema.grazing.l_grazing_start))

    return rows as Grazing[]
  } catch (err) {
    throw handleError(err, "Exception for getGrazingForHerd", { l_id_herd })
  }
}

/**
 * Retrieves all grazing actions across herds for a farm.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param b_id_farm - Farm ID.
 * @param timeframe - Optional timeframe filter.
 * @returns Array of grazing records.
 */
export async function getGrazingForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  timeframe?: Timeframe,
): Promise<Grazing[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getGrazingForFarm")

    const herdRows = await fdm
      .select({ l_id_herd: schema.herdStarting.l_id_herd })
      .from(schema.herdStarting)
      .where(eq(schema.herdStarting.b_id_farm, b_id_farm))

    const herdIds = herdRows.map((h) => h.l_id_herd)

    if (herdIds.length === 0) {
      return []
    }

    let dateWhere: SQL | undefined = inArray(schema.grazing.l_id_herd, herdIds)
    dateWhere = withTimeframe(dateWhere, schema.grazing.l_grazing_start, timeframe)

    const rows = await fdm
      .select({
        l_id_grazing: schema.grazing.l_id_grazing,
        b_id: schema.grazing.b_id,
        l_id_herd: schema.grazing.l_id_herd,
        l_grazing_start: schema.grazing.l_grazing_start,
        l_grazing_end: schema.grazing.l_grazing_end,
        l_grazing_hours: schema.grazing.l_grazing_hours,
        l_grazing_area: schema.grazing.l_grazing_area,
        l_grazing_type: schema.grazing.l_grazing_type,
        created: schema.grazing.created,
        updated: schema.grazing.updated,
      })
      .from(schema.grazing)
      .where(dateWhere)
      .orderBy(desc(schema.grazing.l_grazing_start))

    return rows as Grazing[]
  } catch (err) {
    throw handleError(err, "Exception for getGrazingForFarm", { b_id_farm })
  }
}
