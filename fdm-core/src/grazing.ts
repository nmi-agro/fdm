import { and, desc, eq, inArray, lt, gte, sql, type SQL } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type { Grazing, GrazingCalendarEntry } from "./grazing.types"
import type { Timeframe } from "./timeframe"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { setGrazingIntention } from "./grazing_intention"
import { createId } from "./id"
import { assertIntervalEndNotBeforeStart, overlapsHalfOpen } from "./interval"
import { withTimeframe } from "./timeframe"

/**
 * Records an outdoor pasture grazing action for a herd on a farm field parcel.
 * Allows logging grazing start/end dates, daily grazing hours, grazed area in hectares,
 * and spatial extent (full vs partial field). Total grazing days are derived from the
 * start/end dates in the calculator layer rather than stored here.
 * Grazing intervals for the same herd on the same field (or herd-level) may not overlap.
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
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "herd", "write", l_id_herd, principal_id, "addGrazing")
      const grazingEnd = properties?.l_grazing_end ?? null
      assertIntervalEndNotBeforeStart(l_grazing_start, grazingEnd, "l_grazing")

      const herdFarm = await tx
        .select({ b_id_farm: schema.herdStarting.b_id_farm })
        .from(schema.herdStarting)
        .where(eq(schema.herdStarting.l_id_herd, l_id_herd))
        .limit(1)

      if (herdFarm.length === 0) {
        throw new Error(`Herd ${l_id_herd} does not belong to a farm`)
      }

      const b_id_farm = herdFarm[0].b_id_farm

      if (properties?.b_id) {
        const fieldFarm = await tx
          .select({ b_id_farm: schema.fieldAcquiring.b_id_farm })
          .from(schema.fieldAcquiring)
          .where(eq(schema.fieldAcquiring.b_id, properties.b_id))
          .limit(1)

        if (
          fieldFarm.length === 0 ||
          herdFarm[0].b_id_farm !== fieldFarm[0].b_id_farm
        ) {
          throw new Error(`Field ${properties.b_id} does not belong to the herd's farm`)
        }
      }

      await assertNoOverlappingGrazingForHerd(
        tx,
        l_id_herd,
        l_grazing_start,
        grazingEnd,
        properties?.b_id ?? null,
      )

      const grazingYear = l_grazing_start.getUTCFullYear()
      const grazingYearStart = new Date(Date.UTC(grazingYear, 0, 1))
      const grazingNextYearStart = new Date(Date.UTC(grazingYear + 1, 0, 1))

      const firstGrazingInYear = await tx
        .select({ l_id_grazing: schema.grazing.l_id_grazing })
        .from(schema.grazing)
        .innerJoin(
          schema.herdStarting,
          eq(schema.grazing.l_id_herd, schema.herdStarting.l_id_herd),
        )
        .where(
          and(
            eq(schema.herdStarting.b_id_farm, b_id_farm),
            gte(schema.grazing.l_grazing_start, grazingYearStart),
            lt(schema.grazing.l_grazing_start, grazingNextYearStart),
          ),
        )
        .limit(1)

      if (firstGrazingInYear.length === 0) {
        await setGrazingIntention(tx, principal_id, b_id_farm, grazingYear, true)
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
 * Records multiple outdoor pasture grazing actions for herds on farm field parcels
 * in a single atomic transaction. Applies all permission, interval, farm-consistency,
 * and overlap validations across all rows, as well as automatic first-of-year grazing
 * intention side-effects.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal recording the grazing actions.
 * @param rows - Array of grazing rows to insert.
 */
export async function addGrazings(
  fdm: FdmType,
  principal_id: PrincipalId,
  rows: {
    l_id_herd: schema.herdsTypeSelect["l_id_herd"]
    l_grazing_start: Date
    b_id?: schema.grazingTypeInsert["b_id"]
    l_grazing_end?: schema.grazingTypeInsert["l_grazing_end"]
    l_grazing_hours?: schema.grazingTypeInsert["l_grazing_hours"]
    l_grazing_area?: schema.grazingTypeInsert["l_grazing_area"]
    l_grazing_type?: schema.grazingTypeInsert["l_grazing_type"]
  }[],
): Promise<void> {
  if (rows.length === 0) {
    return
  }

  try {
    return await fdm.transaction(async (tx) => {
      const distinctHerds = Array.from(new Set(rows.map((r) => r.l_id_herd)))
      for (const l_id_herd of distinctHerds) {
        await checkPermission(tx, "herd", "write", l_id_herd, principal_id, "addGrazings")
      }

      const farmPerHerd = new Map<string, string>()
      for (const l_id_herd of distinctHerds) {
        const herdFarm = await tx
          .select({ b_id_farm: schema.herdStarting.b_id_farm })
          .from(schema.herdStarting)
          .where(eq(schema.herdStarting.l_id_herd, l_id_herd))
          .limit(1)

        if (herdFarm.length === 0) {
          throw new Error(`Herd ${l_id_herd} does not belong to a farm`)
        }
        farmPerHerd.set(l_id_herd, herdFarm[0].b_id_farm)
      }

      const distinctFields = Array.from(
        new Set(rows.map((r) => r.b_id).filter((b_id): b_id is string => Boolean(b_id))),
      )
      const farmPerField = new Map<string, string>()
      for (const b_id of distinctFields) {
        const fieldFarm = await tx
          .select({ b_id_farm: schema.fieldAcquiring.b_id_farm })
          .from(schema.fieldAcquiring)
          .where(eq(schema.fieldAcquiring.b_id, b_id))
          .limit(1)

        if (fieldFarm.length === 0) {
          throw new Error(`Field ${b_id} does not belong to a farm`)
        }
        farmPerField.set(b_id, fieldFarm[0].b_id_farm)
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const grazingEnd = row.l_grazing_end ?? null
        assertIntervalEndNotBeforeStart(row.l_grazing_start, grazingEnd, "l_grazing")

        const b_id_farm = farmPerHerd.get(row.l_id_herd)
        if (row.b_id) {
          const fieldFarm = farmPerField.get(row.b_id)
          if (!fieldFarm || fieldFarm !== b_id_farm) {
            throw new Error(`Field ${row.b_id} does not belong to the herd's farm`)
          }
        }

        await assertNoOverlappingGrazingForHerd(
          tx,
          row.l_id_herd,
          row.l_grazing_start,
          grazingEnd,
          row.b_id ?? null,
        )

        for (let j = 0; j < i; j++) {
          const prev = rows[j]
          if (prev.l_id_herd === row.l_id_herd) {
            const prevEnd = prev.l_grazing_end ?? null
            if (overlapsHalfOpen(row.l_grazing_start, grazingEnd, prev.l_grazing_start, prevEnd)) {
              const rowField = row.b_id ?? null
              const prevField = prev.b_id ?? null
              if (rowField === null || prevField === null || rowField === prevField) {
                throw new Error(
                  "Grazing interval overlaps another grazing interval in this batch for this herd",
                )
              }
            }
          }
        }
      }

      const yearsPerFarm = new Map<string, Set<number>>()
      for (const row of rows) {
        const b_id_farm = farmPerHerd.get(row.l_id_herd)!
        const year = row.l_grazing_start.getUTCFullYear()
        if (!yearsPerFarm.has(b_id_farm)) {
          yearsPerFarm.set(b_id_farm, new Set())
        }
        yearsPerFarm.get(b_id_farm)!.add(year)
      }

      for (const [b_id_farm, years] of yearsPerFarm.entries()) {
        for (const year of years) {
          const yearStart = new Date(Date.UTC(year, 0, 1))
          const nextYearStart = new Date(Date.UTC(year + 1, 0, 1))

          const firstGrazingInYear = await tx
            .select({ l_id_grazing: schema.grazing.l_id_grazing })
            .from(schema.grazing)
            .innerJoin(
              schema.herdStarting,
              eq(schema.grazing.l_id_herd, schema.herdStarting.l_id_herd),
            )
            .where(
              and(
                eq(schema.herdStarting.b_id_farm, b_id_farm),
                gte(schema.grazing.l_grazing_start, yearStart),
                lt(schema.grazing.l_grazing_start, nextYearStart),
              ),
            )
            .limit(1)

          if (firstGrazingInYear.length === 0) {
            await setGrazingIntention(tx, principal_id, b_id_farm, year, true)
          }
        }
      }

      await tx.insert(schema.grazing).values(
        rows.map((r) => ({
          l_id_grazing: createId(),
          l_id_herd: r.l_id_herd,
          l_grazing_start: r.l_grazing_start,
          b_id: r.b_id ?? null,
          l_grazing_end: r.l_grazing_end ?? null,
          l_grazing_hours: r.l_grazing_hours ?? null,
          l_grazing_area: r.l_grazing_area ?? null,
          l_grazing_type: r.l_grazing_type ?? null,
        })),
      )
    })
  } catch (err) {
    throw handleError(err, "Exception for addGrazings", { rowCount: rows.length })
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

/**
 * Retrieves grazing actions joined with herd and field details for a farm calendar.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param b_id_farm - Farm ID.
 * @param timeframe - Optional timeframe filter.
 * @returns Array of calendar grazing records with herd and field details.
 */
export async function getGrazingCalendarForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  timeframe?: Timeframe,
): Promise<GrazingCalendarEntry[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getGrazingCalendarForFarm")

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
        l_herd_name: schema.herds.l_herd_name,
        l_id_category: schema.herds.l_id_category,
        l_category: schema.animalCategoriesCatalogue.l_category,
        l_lsu: schema.animalCategoriesCatalogue.l_lsu,
        b_name: schema.fields.b_name,
        b_area: sql<number | null>`ROUND((ST_Area(${schema.fields.b_geometry}::geography)/10000)::NUMERIC, 2)::FLOAT`,
      })
      .from(schema.grazing)
      .innerJoin(schema.herds, eq(schema.grazing.l_id_herd, schema.herds.l_id_herd))
      .leftJoin(
        schema.animalCategoriesCatalogue,
        eq(schema.herds.l_id_category, schema.animalCategoriesCatalogue.l_id_category),
      )
      .leftJoin(schema.fields, eq(schema.grazing.b_id, schema.fields.b_id))
      .where(dateWhere)
      .orderBy(desc(schema.grazing.l_grazing_start))

    return rows as GrazingCalendarEntry[]
  } catch (err) {
    throw handleError(err, "Exception for getGrazingCalendarForFarm", { b_id_farm, timeframe })
  }
}

/**
 * Retrieves all grazing actions recorded for a specific field.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal ID.
 * @param b_id - Field ID.
 * @param timeframe - Optional timeframe filter.
 * @returns Array of grazing records.
 */
export async function getGrazingForField(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: schema.fieldsTypeSelect["b_id"],
  timeframe?: Timeframe,
): Promise<Grazing[]> {
  try {
    await checkPermission(fdm, "field", "read", b_id, principal_id, "getGrazingForField")

    let dateWhere: SQL | undefined = eq(schema.grazing.b_id, b_id)
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
    throw handleError(err, "Exception for getGrazingForField", { b_id })
  }
}

/**
 * Retrieves a single grazing record by its ID.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the grazing record.
 * @param l_id_grazing - Grazing record ID.
 * @returns The grazing record.
 */
export async function getGrazing(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_grazing: schema.grazingTypeSelect["l_id_grazing"],
): Promise<Grazing> {
  try {
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
      .where(eq(schema.grazing.l_id_grazing, l_id_grazing))
      .limit(1)

    if (rows.length === 0) {
      throw new Error("Grazing record not found")
    }

    await checkPermission(fdm, "herd", "read", rows[0].l_id_herd, principal_id, "getGrazing")

    return rows[0] as Grazing
  } catch (err) {
    throw handleError(err, "Exception for getGrazing", { l_id_grazing })
  }
}

/**
 * Corrects an existing grazing record identified by its ID.
 * The updated interval may not overlap another grazing interval for the same herd on the same field.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the grazing record.
 * @param l_id_grazing - Grazing record ID.
 * @param properties - Fields to correct.
 */
export async function updateGrazing(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_grazing: schema.grazingTypeSelect["l_id_grazing"],
  properties: {
    l_grazing_start?: schema.grazingTypeInsert["l_grazing_start"]
    l_grazing_end?: schema.grazingTypeInsert["l_grazing_end"]
    l_grazing_hours?: schema.grazingTypeInsert["l_grazing_hours"]
    l_grazing_area?: schema.grazingTypeInsert["l_grazing_area"]
    l_grazing_type?: schema.grazingTypeInsert["l_grazing_type"]
  },
): Promise<void> {
  try {
    await fdm.transaction(async (tx) => {
      const existing = await tx
        .select({
          l_id_herd: schema.grazing.l_id_herd,
          b_id: schema.grazing.b_id,
          l_grazing_start: schema.grazing.l_grazing_start,
          l_grazing_end: schema.grazing.l_grazing_end,
        })
        .from(schema.grazing)
        .where(eq(schema.grazing.l_id_grazing, l_id_grazing))
        .limit(1)

      if (existing.length === 0) {
        throw new Error("Grazing record not found")
      }

      await checkPermission(
        tx,
        "herd",
        "write",
        existing[0].l_id_herd,
        principal_id,
        "updateGrazing",
      )

      const nextStart = properties.l_grazing_start ?? existing[0].l_grazing_start
      const nextEnd =
        properties.l_grazing_end === undefined ? existing[0].l_grazing_end : properties.l_grazing_end
      assertIntervalEndNotBeforeStart(nextStart, nextEnd, "l_grazing")
      await assertNoOverlappingGrazingForHerd(
        tx,
        existing[0].l_id_herd,
        nextStart,
        nextEnd,
        existing[0].b_id ?? null,
        l_id_grazing,
      )

      await tx
        .update(schema.grazing)
        .set({ ...properties, updated: new Date() })
        .where(eq(schema.grazing.l_id_grazing, l_id_grazing))
    })
  } catch (err) {
    throw handleError(err, "Exception for updateGrazing", { l_id_grazing, properties })
  }
}

async function assertNoOverlappingGrazingForHerd(
  tx: FdmType,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  l_grazing_start: Date,
  l_grazing_end: Date | null,
  b_id: schema.grazingTypeInsert["b_id"],
  exclude_l_id_grazing?: schema.grazingTypeSelect["l_id_grazing"],
): Promise<void> {
  const grazingRows = await tx
    .select({
      l_id_grazing: schema.grazing.l_id_grazing,
      b_id: schema.grazing.b_id,
      l_grazing_start: schema.grazing.l_grazing_start,
      l_grazing_end: schema.grazing.l_grazing_end,
    })
    .from(schema.grazing)
    .where(eq(schema.grazing.l_id_herd, l_id_herd))

  const targetField = b_id ?? null

  for (const row of grazingRows) {
    if (row.l_id_grazing === exclude_l_id_grazing) {
      continue
    }

    if (overlapsHalfOpen(l_grazing_start, l_grazing_end, row.l_grazing_start, row.l_grazing_end)) {
      const existingField = row.b_id ?? null
      if (targetField === null || existingField === null || targetField === existingField) {
        throw new Error("Grazing interval overlaps an existing grazing interval for this herd")
      }
    }
  }
}

/**
 * Hard-deletes a grazing record.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal removing the grazing record.
 * @param l_id_grazing - Grazing record ID.
 */
export async function removeGrazing(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_grazing: schema.grazingTypeSelect["l_id_grazing"],
): Promise<void> {
  try {
    const existing = await fdm
      .select({ l_id_herd: schema.grazing.l_id_herd })
      .from(schema.grazing)
      .where(eq(schema.grazing.l_id_grazing, l_id_grazing))
      .limit(1)

    if (existing.length === 0) {
      throw new Error("Grazing record not found")
    }

    await checkPermission(
      fdm,
      "herd",
      "write",
      existing[0].l_id_herd,
      principal_id,
      "removeGrazing",
    )

    await fdm.delete(schema.grazing).where(eq(schema.grazing.l_id_grazing, l_id_grazing))
  } catch (err) {
    throw handleError(err, "Exception for removeGrazing", { l_id_grazing })
  }
}

