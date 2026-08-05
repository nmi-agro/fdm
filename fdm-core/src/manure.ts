import { desc, eq, inArray, type SQL } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type { Excreting, ManureDelivery, ManurePit } from "./manure.types"
import type { Timeframe } from "./timeframe"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { createId } from "./id"
import { withTimeframe } from "./timeframe"

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
 * Retrieves a single manure pit by its ID.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the manure pit.
 * @param b_id_manurepit - Identifier of the manure pit.
 * @returns The manure pit.
 */
export async function getManurePit(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_manurepit: schema.manurePitsTypeSelect["b_id_manurepit"],
): Promise<ManurePit> {
  try {
    await checkPermission(fdm, "manure", "read", b_id_manurepit, principal_id, "getManurePit")

    const rows = await fdm
      .select({
        b_id_manurepit: schema.manurePits.b_id_manurepit,
        b_id_farm: schema.manurePits.b_id_farm,
        b_manurepit_name: schema.manurePits.b_manurepit_name,
        b_pit_area: schema.manurePits.b_pit_area,
        created: schema.manurePits.created,
        updated: schema.manurePits.updated,
      })
      .from(schema.manurePits)
      .where(eq(schema.manurePits.b_id_manurepit, b_id_manurepit))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Manure pit not found")
    }

    return rows[0] as ManurePit
  } catch (err) {
    throw handleError(err, "Exception for getManurePit", { b_id_manurepit })
  }
}

/**
 * Retrieves all manure pits for a specified farm.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the manure pits.
 * @param b_id_farm - Farm ID.
 * @returns Array of manure pits.
 */
export async function getManurePitsForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
): Promise<ManurePit[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getManurePitsForFarm")

    const rows = await fdm
      .select({
        b_id_manurepit: schema.manurePits.b_id_manurepit,
        b_id_farm: schema.manurePits.b_id_farm,
        b_manurepit_name: schema.manurePits.b_manurepit_name,
        b_pit_area: schema.manurePits.b_pit_area,
        created: schema.manurePits.created,
        updated: schema.manurePits.updated,
      })
      .from(schema.manurePits)
      .where(eq(schema.manurePits.b_id_farm, b_id_farm))
      .orderBy(desc(schema.manurePits.created))

    return rows as ManurePit[]
  } catch (err) {
    throw handleError(err, "Exception for getManurePitsForFarm", { b_id_farm })
  }
}

/**
 * Updates properties of an existing manure pit.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal updating the manure pit.
 * @param b_id_manurepit - Identifier of the manure pit.
 * @param properties - Properties to update.
 */
export async function updateManurePit(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_manurepit: schema.manurePitsTypeSelect["b_id_manurepit"],
  properties: {
    b_manurepit_name?: schema.manurePitsTypeInsert["b_manurepit_name"]
    b_pit_area?: schema.manurePitsTypeInsert["b_pit_area"]
  },
): Promise<void> {
  try {
    await checkPermission(fdm, "manure", "write", b_id_manurepit, principal_id, "updateManurePit")

    await fdm
      .update(schema.manurePits)
      .set({ ...properties, updated: new Date() })
      .where(eq(schema.manurePits.b_id_manurepit, b_id_manurepit))
  } catch (err) {
    throw handleError(err, "Exception for updateManurePit", { b_id_manurepit, properties })
  }
}

/**
 * Hard-deletes a manure pit asset. Guarded: rejected if any excreting or
 * manure disposing record still references this pit — those represent
 * other actions' history and must be cleaned up first.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the manure pit.
 * @param b_id_manurepit - Identifier of the manure pit.
 */
export async function removeManurePit(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_manurepit: schema.manurePitsTypeSelect["b_id_manurepit"],
): Promise<void> {
  try {
    await checkPermission(fdm, "manure", "write", b_id_manurepit, principal_id, "removeManurePit")

    await fdm.transaction(async (tx) => {
      const excretingRecords = await tx
        .select({ l_id_excreting: schema.excreting.l_id_excreting })
        .from(schema.excreting)
        .where(eq(schema.excreting.b_id_manurepit, b_id_manurepit))
        .limit(1)

      if (excretingRecords.length > 0) {
        throw new Error("Cannot remove manure pit: an excreting record references it")
      }

      const disposingRecords = await tx
        .select({ p_id_disposing: schema.manureDisposing.p_id_disposing })
        .from(schema.manureDisposing)
        .where(eq(schema.manureDisposing.b_id_manurepit, b_id_manurepit))
        .limit(1)

      if (disposingRecords.length > 0) {
        throw new Error("Cannot remove manure pit: a manure disposing record references it")
      }

      await tx.delete(schema.manurePits).where(eq(schema.manurePits.b_id_manurepit, b_id_manurepit))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeManurePit", { b_id_manurepit })
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
 * Retrieves a single excreting action by its ID.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the excreting action.
 * @param l_id_excreting - Identifier of the excreting action.
 * @returns The excreting record.
 */
export async function getExcreting(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_excreting: schema.excretingTypeSelect["l_id_excreting"],
): Promise<Excreting> {
  try {
    const rows = await fdm
      .select({
        l_id_excreting: schema.excreting.l_id_excreting,
        l_id_herd: schema.excreting.l_id_herd,
        b_id_manurepit: schema.excreting.b_id_manurepit,
        l_excreting_start: schema.excreting.l_excreting_start,
        l_excreting_end: schema.excreting.l_excreting_end,
        p_excreting_amount: schema.excreting.p_excreting_amount,
        created: schema.excreting.created,
        updated: schema.excreting.updated,
      })
      .from(schema.excreting)
      .where(eq(schema.excreting.l_id_excreting, l_id_excreting))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Excreting record not found")
    }

    await checkPermission(fdm, "herd", "read", rows[0].l_id_herd, principal_id, "getExcreting")

    return rows[0] as Excreting
  } catch (err) {
    throw handleError(err, "Exception for getExcreting", { l_id_excreting })
  }
}

/**
 * Corrects an existing excreting action.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the excreting action.
 * @param l_id_excreting - Identifier of the excreting action.
 * @param properties - Fields to correct.
 */
export async function updateExcreting(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_excreting: schema.excretingTypeSelect["l_id_excreting"],
  properties: {
    b_id_manurepit?: schema.excretingTypeInsert["b_id_manurepit"]
    l_excreting_start?: schema.excretingTypeInsert["l_excreting_start"]
    l_excreting_end?: schema.excretingTypeInsert["l_excreting_end"]
    p_excreting_amount?: schema.excretingTypeInsert["p_excreting_amount"]
  },
): Promise<void> {
  try {
    const existing = await fdm
      .select({ l_id_herd: schema.excreting.l_id_herd })
      .from(schema.excreting)
      .where(eq(schema.excreting.l_id_excreting, l_id_excreting))
      .limit(1)

    if (existing.length === 0) {
      throw new Error("Excreting record not found")
    }

    await checkPermission(
      fdm,
      "herd",
      "write",
      existing[0].l_id_herd,
      principal_id,
      "updateExcreting",
    )

    await fdm
      .update(schema.excreting)
      .set({ ...properties, updated: new Date() })
      .where(eq(schema.excreting.l_id_excreting, l_id_excreting))
  } catch (err) {
    throw handleError(err, "Exception for updateExcreting", { l_id_excreting, properties })
  }
}

/**
 * Hard-deletes an excreting action.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the excreting action.
 * @param l_id_excreting - Identifier of the excreting action.
 */
export async function removeExcreting(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_excreting: schema.excretingTypeSelect["l_id_excreting"],
): Promise<void> {
  try {
    const existing = await fdm
      .select({ l_id_herd: schema.excreting.l_id_herd })
      .from(schema.excreting)
      .where(eq(schema.excreting.l_id_excreting, l_id_excreting))
      .limit(1)

    if (existing.length === 0) {
      throw new Error("Excreting record not found")
    }

    await checkPermission(
      fdm,
      "herd",
      "write",
      existing[0].l_id_herd,
      principal_id,
      "removeExcreting",
    )

    await fdm.delete(schema.excreting).where(eq(schema.excreting.l_id_excreting, l_id_excreting))
  } catch (err) {
    throw handleError(err, "Exception for removeExcreting", { l_id_excreting })
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
 * @param p_disposing_amount - Quantity of manure disposed/transported (kg).
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
 * Retrieves a single manure disposing action by its ID, including its
 * associated laboratory analysis parameters if present.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the disposing action.
 * @param p_id_disposing - Identifier of the disposing action.
 * @returns The manure delivery/disposal record.
 */
export async function getManureDisposing(
  fdm: FdmType,
  principal_id: PrincipalId,
  p_id_disposing: schema.manureDisposingTypeSelect["p_id_disposing"],
): Promise<ManureDelivery> {
  try {
    const rows = await fdm
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
      .from(schema.manureDisposing)
      .innerJoin(
        schema.manureDeliveries,
        eq(schema.manureDisposing.p_id_delivery, schema.manureDeliveries.p_id_delivery),
      )
      .leftJoin(
        schema.manureSampling,
        eq(schema.manureDisposing.p_id_delivery, schema.manureSampling.p_id_delivery),
      )
      .leftJoin(
        schema.manureAnalyses,
        eq(schema.manureSampling.p_id_analysis, schema.manureAnalyses.p_id_analysis),
      )
      .where(eq(schema.manureDisposing.p_id_disposing, p_id_disposing))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Manure disposing record not found")
    }

    await checkPermission(
      fdm,
      "manure",
      "read",
      rows[0].b_id_manurepit,
      principal_id,
      "getManureDisposing",
    )

    return rows[0] as ManureDelivery
  } catch (err) {
    throw handleError(err, "Exception for getManureDisposing", { p_id_disposing })
  }
}

/**
 * Corrects an existing manure disposing action.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the disposing action.
 * @param p_id_disposing - Identifier of the disposing action.
 * @param properties - Fields to correct.
 */
export async function updateManureDisposing(
  fdm: FdmType,
  principal_id: PrincipalId,
  p_id_disposing: schema.manureDisposingTypeSelect["p_id_disposing"],
  properties: {
    p_disposing_date?: schema.manureDisposingTypeInsert["p_disposing_date"]
    p_disposing_amount?: schema.manureDisposingTypeInsert["p_disposing_amount"]
  },
): Promise<void> {
  try {
    const existing = await fdm
      .select({ b_id_manurepit: schema.manureDisposing.b_id_manurepit })
      .from(schema.manureDisposing)
      .where(eq(schema.manureDisposing.p_id_disposing, p_id_disposing))
      .limit(1)

    if (existing.length === 0) {
      throw new Error("Manure disposing record not found")
    }

    await checkPermission(
      fdm,
      "manure",
      "write",
      existing[0].b_id_manurepit,
      principal_id,
      "updateManureDisposing",
    )

    await fdm
      .update(schema.manureDisposing)
      .set({ ...properties, updated: new Date() })
      .where(eq(schema.manureDisposing.p_id_disposing, p_id_disposing))
  } catch (err) {
    throw handleError(err, "Exception for updateManureDisposing", { p_id_disposing, properties })
  }
}

/**
 * Hard-deletes a manure disposing action and its own `manure_deliveries` and
 * `manure_sampling`/`manure_analyses` rows.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the disposing action.
 * @param p_id_disposing - Identifier of the disposing action.
 */
export async function removeManureDisposing(
  fdm: FdmType,
  principal_id: PrincipalId,
  p_id_disposing: schema.manureDisposingTypeSelect["p_id_disposing"],
): Promise<void> {
  try {
    const existing = await fdm
      .select({
        b_id_manurepit: schema.manureDisposing.b_id_manurepit,
        p_id_delivery: schema.manureDisposing.p_id_delivery,
      })
      .from(schema.manureDisposing)
      .where(eq(schema.manureDisposing.p_id_disposing, p_id_disposing))
      .limit(1)

    if (existing.length === 0) {
      throw new Error("Manure disposing record not found")
    }

    await checkPermission(
      fdm,
      "manure",
      "write",
      existing[0].b_id_manurepit,
      principal_id,
      "removeManureDisposing",
    )

    const { p_id_delivery } = existing[0]

    await fdm.transaction(async (tx) => {
      const samplings = await tx
        .select({ p_id_analysis: schema.manureSampling.p_id_analysis })
        .from(schema.manureSampling)
        .where(eq(schema.manureSampling.p_id_delivery, p_id_delivery))

      await tx
        .delete(schema.manureSampling)
        .where(eq(schema.manureSampling.p_id_delivery, p_id_delivery))

      for (const sampling of samplings) {
        await tx
          .delete(schema.manureAnalyses)
          .where(eq(schema.manureAnalyses.p_id_analysis, sampling.p_id_analysis))
      }

      await tx
        .delete(schema.manureDisposing)
        .where(eq(schema.manureDisposing.p_id_disposing, p_id_disposing))
      await tx
        .delete(schema.manureDeliveries)
        .where(eq(schema.manureDeliveries.p_id_delivery, p_id_delivery))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeManureDisposing", { p_id_disposing })
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
      whereClause = withTimeframe(whereClause, schema.manureDisposing.p_disposing_date, timeframe)

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
