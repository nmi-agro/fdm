import { and, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type { ManureDelivery } from "./manure.types"
import type { Timeframe } from "./timeframe"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"

/**
 * Adds a new manure pit asset to a farm.
 * Manure pits, cellars, and lagoons store excreted animal slurry under housing floors or in external storages.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal creating the manure pit.
 * @param b_id_farm - Identifier of the farm acquiring the manure pit.
 * @param properties - Optional pit name and pit area in m².
 * @returns Unique identifier of the new manure pit.
 */
export async function addManurePit(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  properties?: {
    b_manurepit_name?: schema.manurePitsTypeInsert["b_manurepit_name"]
    b_pit_area?: schema.manurePitsTypeInsert["b_pit_area"]
  },
): Promise<schema.manurePitsTypeSelect["b_id_manurepit"]> {
  try {
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "addManurePit")

    return await fdm.transaction(async (tx) => {
      const b_id_manurepit = createId()

      await tx.insert(schema.manurePits).values({
        b_id_manurepit,
        b_id_farm,
        b_manurepit_name: properties?.b_manurepit_name ?? null,
        b_pit_area: properties?.b_pit_area ?? null,
      })

      return b_id_manurepit
    })
  } catch (err) {
    throw handleError(err, "Exception for addManurePit", { b_id_farm, properties })
  }
}

/**
 * Records an excreting action connecting a herd to a target manure pit where produced slurry is accumulated.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal recording the excreting action.
 * @param l_id_herd - Herd ID.
 * @param b_id_manurepit - Manure pit ID.
 * @param properties - Optional start/end dates and manure amount.
 * @returns Unique identifier of the new excreting action.
 */
export async function addExcreting(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  b_id_manurepit: schema.manurePitsTypeSelect["b_id_manurepit"],
  properties?: {
    l_excreting_start?: schema.excretingTypeInsert["l_excreting_start"]
    l_excreting_end?: schema.excretingTypeInsert["l_excreting_end"]
    p_excreting_amount?: schema.excretingTypeInsert["p_excreting_amount"]
  },
): Promise<schema.excretingTypeSelect["l_id_excreting"]> {
  try {
    await checkPermission(fdm, "herd", "write", l_id_herd, principal_id, "addExcreting")

    return await fdm.transaction(async (tx) => {
      const l_id_excreting = createId()

      await tx.insert(schema.excreting).values({
        l_id_excreting,
        l_id_herd,
        b_id_manurepit,
        l_excreting_start: properties?.l_excreting_start ?? new Date(),
        l_excreting_end: properties?.l_excreting_end ?? null,
        p_excreting_amount: properties?.p_excreting_amount ?? null,
      })

      return l_id_excreting
    })
  } catch (err) {
    throw handleError(err, "Exception for addExcreting", { l_id_herd, b_id_manurepit, properties })
  }
}

/**
 * Records an off-farm manure disposal/transport action from a manure pit, optionally attaching official laboratory slurry analysis
 * parameters including total N (`p_n_rt`), phosphate (`p_p_rt`), dry matter (`p_dm`), and organic matter (`p_om`).
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal recording the disposal.
 * @param b_id_manurepit - Identifier of the source manure pit.
 * @param p_disposing_date - Disposal/transport dispatch date.
 * @param p_disposing_amount - Quantity of manure disposed/transported (kg or m³).
 * @param properties - Optional laboratory nutrient analysis parameters.
 * @returns Unique identifier of the created manure delivery.
 */
export async function addManureDisposing(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_manurepit: schema.manurePitsTypeSelect["b_id_manurepit"],
  p_disposing_date: Date,
  p_disposing_amount: schema.manureDisposingTypeInsert["p_disposing_amount"],
  properties?: {
    p_n_rt?: schema.manureAnalysesTypeInsert["p_n_rt"]
    p_p_rt?: schema.manureAnalysesTypeInsert["p_p_rt"]
    p_dm?: schema.manureAnalysesTypeInsert["p_dm"]
    p_om?: schema.manureAnalysesTypeInsert["p_om"]
    p_sampling_date?: Date
  },
): Promise<schema.manureDeliveriesTypeSelect["p_id_delivery"]> {
  try {
    await checkPermission(
      fdm,
      "manure",
      "write",
      b_id_manurepit,
      principal_id,
      "addManureDisposing",
    )

    return await fdm.transaction(async (tx) => {
      const p_id_delivery = createId()
      const p_id_disposing = createId()

      await tx.insert(schema.manureDeliveries).values({
        p_id_delivery,
      })

      await tx.insert(schema.manureDisposing).values({
        p_id_disposing,
        b_id_manurepit,
        p_id_delivery,
        p_disposing_date,
        p_disposing_amount,
      })

      if (
        properties &&
        (properties.p_n_rt !== undefined ||
          properties.p_p_rt !== undefined ||
          properties.p_dm !== undefined ||
          properties.p_om !== undefined)
      ) {
        const p_id_analysis = createId()

        await tx.insert(schema.manureAnalyses).values({
          p_id_analysis,
          p_n_rt: properties.p_n_rt ?? null,
          p_p_rt: properties.p_p_rt ?? null,
          p_dm: properties.p_dm ?? null,
          p_om: properties.p_om ?? null,
        })

        await tx.insert(schema.manureSampling).values({
          p_id_delivery,
          p_id_analysis,
          p_sampling_date: properties.p_sampling_date ?? p_disposing_date,
        })
      }

      return p_id_delivery
    })
  } catch (err) {
    throw handleError(err, "Exception for addManureDisposing", {
      b_id_manurepit,
      p_disposing_date,
      p_disposing_amount,
    })
  }
}

/**
 * Retrieves all off-farm manure disposal records for a farm within an optional timeframe.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal requesting the records.
 * @param b_id_farm - Unique identifier of the farm.
 * @param timeframe - Optional timeframe filter.
 * @returns Array of manure delivery objects ordered by disposal date descending.
 */
export async function getManureDisposalsForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  timeframe?: Timeframe,
): Promise<ManureDelivery[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getManureDisposalsForFarm")

    return await fdm.transaction(async (tx) => {
      // Find manure pit IDs belonging to this farm
      const farmPits = await tx
        .select({ b_id_manurepit: schema.manurePits.b_id_manurepit })
        .from(schema.manurePits)
        .where(eq(schema.manurePits.b_id_farm, b_id_farm))

      const pitIds = [...new Set(farmPits.map((p) => p.b_id_manurepit))]

      if (pitIds.length === 0) {
        return []
      }

      let whereClause: SQL | undefined = inArray(schema.manureDisposing.b_id_manurepit, pitIds)
      if (timeframe?.start && timeframe?.end) {
        whereClause = and(
          whereClause,
          gte(schema.manureDisposing.p_disposing_date, timeframe.start),
          lte(schema.manureDisposing.p_disposing_date, timeframe.end),
        )
      } else if (timeframe?.start) {
        whereClause = and(
          whereClause,
          gte(schema.manureDisposing.p_disposing_date, timeframe.start),
        )
      } else if (timeframe?.end) {
        whereClause = and(whereClause, lte(schema.manureDisposing.p_disposing_date, timeframe.end))
      }

      const rows = await tx
        .select({
          p_id_delivery: schema.manureDeliveries.p_id_delivery,
          b_id_manurepit: schema.manureDisposing.b_id_manurepit,
          p_id_disposing: schema.manureDisposing.p_id_disposing,
          p_disposing_date: schema.manureDisposing.p_disposing_date,
          p_disposing_amount: schema.manureDisposing.p_disposing_amount,
          p_id_analysis: schema.manureAnalyses.p_id_analysis,
          p_n_rt: schema.manureAnalyses.p_n_rt,
          p_p_rt: schema.manureAnalyses.p_p_rt,
          p_dm: schema.manureAnalyses.p_dm,
          p_om: schema.manureAnalyses.p_om,
          p_sampling_date: schema.manureSampling.p_sampling_date,
          created: schema.manureDeliveries.created,
          updated: schema.manureDeliveries.updated,
        })
        .from(schema.manureDeliveries)
        .innerJoin(
          schema.manureDisposing,
          eq(schema.manureDeliveries.p_id_delivery, schema.manureDisposing.p_id_delivery),
        )
        .leftJoin(
          schema.manureSampling,
          eq(schema.manureDeliveries.p_id_delivery, schema.manureSampling.p_id_delivery),
        )
        .leftJoin(
          schema.manureAnalyses,
          eq(schema.manureSampling.p_id_analysis, schema.manureAnalyses.p_id_analysis),
        )
        .where(whereClause)
        .orderBy(desc(schema.manureDisposing.p_disposing_date))

      return rows as ManureDelivery[]
    })
  } catch (err) {
    throw handleError(err, "Exception for getManureDisposalsForFarm", { b_id_farm })
  }
}
