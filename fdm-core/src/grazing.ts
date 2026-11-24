import type * as GeoJSON from "geojson"
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  max,
  ne,
  sql,
  type SQL,
} from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type {
  GrazedFieldArea,
  Grazing,
  GrazingCalendarEntry,
  GrazingZone,
  GrazingZoneInput,
} from "./grazing.types"
import type { Timeframe } from "./timeframe"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { setGrazingIntention } from "./grazing_intention"
import { createId } from "./id"
import { assertIntervalEndNotBeforeStart, dayNumber, sharesCalendarDay } from "./interval"
import { lockFarm, lockFarmOfHerd } from "./livestock-checks"
import { withPeriodTimeframe } from "./timeframe"
import { clippedZone, geographyArea, normalizeZone } from "./zone"

/** SQL expression for the area (ha) of a geometry, rounded to 2 decimals. */
function areaHa(geometry: SQL | typeof schema.fields.b_geometry): SQL {
  return sql`ROUND((${geographyArea(geometry)}/10000)::NUMERIC, 2)`
}

/**
 * Columns returned for a grazing record. The queries using them must left-join `fields` on
 * `herd_grazing.b_id`, because the grazed area is derived from the field geometry.
 */
function grazingColumns() {
  const fieldArea = areaHa(schema.fields.b_geometry)
  const zoneArea = areaHa(
    clippedZone(schema.herdGrazing.l_grazing_geometry_zone, schema.fields.b_geometry),
  )
  return {
    l_id_grazing: schema.herdGrazing.l_id_grazing,
    b_id: schema.herdGrazing.b_id,
    l_id_herd: schema.herdGrazing.l_id_herd,
    l_grazing_start: schema.herdGrazing.l_grazing_start,
    l_grazing_end: schema.herdGrazing.l_grazing_end,
    l_grazing_hours: schema.herdGrazing.l_grazing_hours,
    l_grazing_area: schema.herdGrazing.l_grazing_area,
    l_grazing_geometry_zone: schema.herdGrazing.l_grazing_geometry_zone,
    l_grazing_area_grazed: sql<number | null>`(CASE
      WHEN ${schema.herdGrazing.l_grazing_geometry_zone} IS NOT NULL THEN ${zoneArea}
      WHEN ${schema.fields.b_geometry} IS NULL THEN ${schema.herdGrazing.l_grazing_area}
      WHEN ${schema.herdGrazing.l_grazing_area} IS NOT NULL THEN LEAST(${schema.herdGrazing.l_grazing_area}, ${fieldArea})
      ELSE ${fieldArea} END)::FLOAT`,
    created: schema.herdGrazing.created,
    updated: schema.herdGrazing.updated,
  }
}

/**
 * Validates the grazed part of the field: either a zone or an area without a location, not both.
 * A zone needs a field, and an area must be positive.
 *
 * @throws {Error} If the combination is not allowed.
 */
function assertGrazingExtent(
  zone: GeoJSON.MultiPolygon | null | undefined,
  area: number | null | undefined,
  b_id: string | null | undefined,
): void {
  if (zone && area != null) {
    throw new Error("l_grazing_geometry_zone and l_grazing_area cannot both be set")
  }
  // Every grazing is on a field, also one of the whole field or of an area without a location
  if (!b_id) {
    throw new Error("A grazing needs a field")
  }
  if (area != null && !(area > 0)) {
    throw new Error("l_grazing_area must be greater than 0")
  }
}

/**
 * Records an outdoor pasture grazing action for a herd on a farm field parcel.
 * Logs the grazing start and end dates, daily grazing hours and the grazed part of the field.
 * Every grazing has an end date; a grazing that is still going on is recorded up to the day it
 * is planned to end.
 * The grazed part is the whole field by default; pass `l_grazing_geometry_zone` for a zone within
 * the field, or `l_grazing_area` when only its size is known. A zone is clipped to the field when
 * it is read. Total grazing days are derived from the start/end dates in the calculator layer
 * rather than stored here.
 * A herd can have several grazings on a day, also on the same field (two zones, or the same zone
 * twice), as long as their hours add up to at most 24 on every calendar day; a grazing without
 * hours counts as 0. Every grazing is on a field.
 *
 * @param fdm - The FDM instance providing connection to the database.
 * @param principal_id - Identifier of the principal recording the grazing action.
 * @param l_id_herd - Herd ID.
 * @param l_grazing_start - Start timestamp.
 * @param properties - The field ID and the end timestamp, and optionally the hours, and the
 *   grazed zone (WGS84) or area (ha).
 * @returns The ID of the new grazing.
 * @throws {Error} If the field or the end is missing, both a zone and an area are given, or the
 *   zone is invalid.
 */
export async function addGrazing(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  l_grazing_start: Date,
  properties: {
    b_id: string
    l_grazing_end: Date
    l_grazing_hours?: schema.herdGrazingTypeInsert["l_grazing_hours"]
    l_grazing_area?: schema.herdGrazingTypeInsert["l_grazing_area"]
    l_grazing_geometry_zone?: GrazingZoneInput
  },
): Promise<string> {
  try {
    return await fdm.transaction(async (tx) => {
      await checkPermission(tx, "herd", "write", l_id_herd, principal_id, "addGrazing")
      // Serialize with the other livestock changes of the farm, so the checks below hold
      await lockFarmOfHerd(tx, l_id_herd)
      const grazingEnd = assertGrazingEnd(properties?.l_grazing_end)
      assertIntervalEndNotBeforeStart(l_grazing_start, grazingEnd, "l_grazing")
      assertGrazingHours(properties?.l_grazing_hours)
      const zone = normalizeZone(properties?.l_grazing_geometry_zone, "l_grazing_geometry_zone")
      assertGrazingExtent(zone, properties?.l_grazing_area, properties?.b_id)

      const herd = await getHerdPeriod(tx, l_id_herd)
      assertGrazingWithinHerdPeriod(herd, l_grazing_start, grazingEnd)

      const b_id_farm = herd.b_id_farm

      if (properties?.b_id) {
        const fieldFarm = await tx
          .select({ b_id_farm: schema.fieldAcquiring.b_id_farm })
          .from(schema.fieldAcquiring)
          .where(eq(schema.fieldAcquiring.b_id, properties.b_id))
          .limit(1)

        if (fieldFarm.length === 0 || b_id_farm !== fieldFarm[0].b_id_farm) {
          throw new Error(`Field ${properties.b_id} does not belong to the herd's farm`)
        }
      }

      await assertGrazingFitsHerd(tx, l_id_herd, {
        b_id: properties?.b_id ?? null,
        l_grazing_start,
        l_grazing_end: grazingEnd,
        l_grazing_hours: properties?.l_grazing_hours ?? null,
      })

      await enableIntentionForFirstGrazing(
        tx,
        principal_id,
        b_id_farm,
        l_grazing_start.getUTCFullYear(),
      )

      const l_id_grazing = createId()
      await tx.insert(schema.herdGrazing).values({
        l_id_grazing,
        l_id_herd,
        l_grazing_start,
        b_id: properties?.b_id ?? null,
        l_grazing_end: grazingEnd,
        l_grazing_hours: properties?.l_grazing_hours ?? null,
        l_grazing_area: properties?.l_grazing_area ?? null,
        l_grazing_geometry_zone: zone ?? null,
      })
      return l_id_grazing
    })
  } catch (err) {
    throw handleError(err, "Exception for addGrazing", {
      l_id_herd,
      l_grazing_start,
      b_id: properties?.b_id,
      l_grazing_end: properties?.l_grazing_end,
      l_grazing_hours: properties?.l_grazing_hours,
      l_grazing_area: properties?.l_grazing_area,
      l_grazing_geometry_zone_type: properties?.l_grazing_geometry_zone?.type,
    })
  }
}

/**
 * Records multiple outdoor pasture grazing actions for herds on farm field parcels
 * in a single atomic transaction. Applies all permission, interval, farm-consistency,
 * overlap and hours-per-day validations across all rows (see {@link addGrazing}), counting the
 * rows of the batch together, as well as automatic first-of-year grazing intention side-effects.
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
    b_id: string
    l_grazing_end: Date
    l_grazing_hours?: schema.herdGrazingTypeInsert["l_grazing_hours"]
    l_grazing_area?: schema.herdGrazingTypeInsert["l_grazing_area"]
    l_grazing_geometry_zone?: GrazingZoneInput
  }[],
): Promise<void> {
  if (rows.length === 0) {
    return
  }

  try {
    const zones = rows.map((row) => {
      assertGrazingHours(row.l_grazing_hours)
      const zone = normalizeZone(row.l_grazing_geometry_zone, "l_grazing_geometry_zone")
      assertGrazingExtent(zone, row.l_grazing_area, row.b_id)
      return zone ?? null
    })

    return await fdm.transaction(async (tx) => {
      const distinctHerds = Array.from(new Set(rows.map((r) => r.l_id_herd)))
      for (const l_id_herd of distinctHerds) {
        await checkPermission(tx, "herd", "write", l_id_herd, principal_id, "addGrazings")
      }

      // Serialize with the other livestock changes of the farms, in a fixed order so two
      // batches never wait for each other. The farm of a herd never changes, so it can be read
      // before the lock.
      const herdFarms = await tx
        .select({ b_id_farm: schema.herdStarting.b_id_farm })
        .from(schema.herdStarting)
        .where(inArray(schema.herdStarting.l_id_herd, distinctHerds))
      for (const b_id_farm of [...new Set(herdFarms.map((h) => h.b_id_farm))].sort()) {
        await lockFarm(tx, b_id_farm)
      }

      const farmPerHerd = new Map<string, string>()
      const periodPerHerd = new Map<string, HerdPeriod>()
      for (const l_id_herd of distinctHerds) {
        const herd = await getHerdPeriod(tx, l_id_herd)
        farmPerHerd.set(l_id_herd, herd.b_id_farm)
        periodPerHerd.set(l_id_herd, herd)
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
        const grazingEnd = assertGrazingEnd(row.l_grazing_end)
        assertIntervalEndNotBeforeStart(row.l_grazing_start, grazingEnd, "l_grazing")
        assertGrazingWithinHerdPeriod(
          periodPerHerd.get(row.l_id_herd)!,
          row.l_grazing_start,
          grazingEnd,
        )

        const b_id_farm = farmPerHerd.get(row.l_id_herd)
        if (row.b_id) {
          const fieldFarm = farmPerField.get(row.b_id)
          if (!fieldFarm || fieldFarm !== b_id_farm) {
            throw new Error(`Field ${row.b_id} does not belong to the herd's farm`)
          }
        }

        await assertGrazingFitsHerd(
          tx,
          row.l_id_herd,
          row,
          undefined,
          rows.slice(0, i).filter((prev) => prev.l_id_herd === row.l_id_herd),
        )
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
          await enableIntentionForFirstGrazing(tx, principal_id, b_id_farm, year)
        }
      }

      await tx.insert(schema.herdGrazing).values(
        rows.map((r, i) => ({
          l_id_grazing: createId(),
          l_id_herd: r.l_id_herd,
          l_grazing_start: r.l_grazing_start,
          b_id: r.b_id ?? null,
          l_grazing_end: r.l_grazing_end,
          l_grazing_hours: r.l_grazing_hours ?? null,
          l_grazing_area: r.l_grazing_area ?? null,
          l_grazing_geometry_zone: zones[i],
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
 * @param timeframe - Optional timeframe filter; grazings that overlap it are returned, also
 *   grazings that started before it.
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

    let dateWhere: SQL | undefined = eq(schema.herdGrazing.l_id_herd, l_id_herd)
    dateWhere = withPeriodTimeframe(
      dateWhere,
      schema.herdGrazing.l_grazing_start,
      schema.herdGrazing.l_grazing_end,
      timeframe,
    )

    const rows = await fdm
      .select(grazingColumns())
      .from(schema.herdGrazing)
      .leftJoin(schema.fields, eq(schema.herdGrazing.b_id, schema.fields.b_id))
      .where(dateWhere)
      .orderBy(desc(schema.herdGrazing.l_grazing_start))

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
 * @param timeframe - Optional timeframe filter; grazings that overlap it are returned, also
 *   grazings that started before it.
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

    let dateWhere: SQL | undefined = inArray(schema.herdGrazing.l_id_herd, herdIds)
    dateWhere = withPeriodTimeframe(
      dateWhere,
      schema.herdGrazing.l_grazing_start,
      schema.herdGrazing.l_grazing_end,
      timeframe,
    )

    const rows = await fdm
      .select(grazingColumns())
      .from(schema.herdGrazing)
      .leftJoin(schema.fields, eq(schema.herdGrazing.b_id, schema.fields.b_id))
      .where(dateWhere)
      .orderBy(desc(schema.herdGrazing.l_grazing_start))

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
 * @param timeframe - Optional timeframe filter; grazings that overlap it are returned, also
 *   grazings that started before it.
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

    let dateWhere: SQL | undefined = inArray(schema.herdGrazing.l_id_herd, herdIds)
    dateWhere = withPeriodTimeframe(
      dateWhere,
      schema.herdGrazing.l_grazing_start,
      schema.herdGrazing.l_grazing_end,
      timeframe,
    )

    const rows = await fdm
      .select({
        ...grazingColumns(),
        l_herd_name: schema.herds.l_herd_name,
        l_id_category: schema.herds.l_id_category,
        l_category: schema.animalCategoriesCatalogue.l_category,
        l_lsu: schema.animalCategoriesCatalogue.l_lsu,
        b_name: schema.fields.b_name,
        b_area: sql<
          number | null
        >`ROUND((ST_Area(${schema.fields.b_geometry}::geography)/10000)::NUMERIC, 2)::FLOAT`,
      })
      .from(schema.herdGrazing)
      .innerJoin(schema.herds, eq(schema.herdGrazing.l_id_herd, schema.herds.l_id_herd))
      .leftJoin(
        schema.animalCategoriesCatalogue,
        eq(schema.herds.l_id_category, schema.animalCategoriesCatalogue.l_id_category),
      )
      .leftJoin(schema.fields, eq(schema.herdGrazing.b_id, schema.fields.b_id))
      .where(dateWhere)
      .orderBy(desc(schema.herdGrazing.l_grazing_start))

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
 * @param timeframe - Optional timeframe filter; grazings that overlap it are returned, also
 *   grazings that started before it.
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

    let dateWhere: SQL | undefined = eq(schema.herdGrazing.b_id, b_id)
    dateWhere = withPeriodTimeframe(
      dateWhere,
      schema.herdGrazing.l_grazing_start,
      schema.herdGrazing.l_grazing_end,
      timeframe,
    )

    const rows = await fdm
      .select(grazingColumns())
      .from(schema.herdGrazing)
      .leftJoin(schema.fields, eq(schema.herdGrazing.b_id, schema.fields.b_id))
      .where(dateWhere)
      .orderBy(desc(schema.herdGrazing.l_grazing_start))

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
  l_id_grazing: schema.herdGrazingTypeSelect["l_id_grazing"],
): Promise<Grazing> {
  try {
    const rows = await fdm
      .select(grazingColumns())
      .from(schema.herdGrazing)
      .leftJoin(schema.fields, eq(schema.herdGrazing.b_id, schema.fields.b_id))
      .where(eq(schema.herdGrazing.l_id_grazing, l_id_grazing))
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
 * The corrected grazing must still fit next to the other grazings of the herd: at most 24 hours per
 * calendar day in total, and no overlap with a herd-level grazing (see {@link addGrazing}).
 * To switch between a zone and an area, pass `null` for the one that no longer applies.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal correcting the grazing record.
 * @param l_id_grazing - Grazing record ID.
 * @param properties - Fields to correct. Omitted fields stay unchanged; `null` clears the hours,
 *   the area or the zone. The end cannot be cleared: every grazing has an end date.
 * @throws {Error} If the result would have both a zone and an area, or the zone is invalid.
 */
export async function updateGrazing(
  fdm: FdmType,
  principal_id: PrincipalId,
  l_id_grazing: schema.herdGrazingTypeSelect["l_id_grazing"],
  properties: {
    l_grazing_start?: schema.herdGrazingTypeInsert["l_grazing_start"]
    l_grazing_end?: Date
    l_grazing_hours?: schema.herdGrazingTypeInsert["l_grazing_hours"]
    l_grazing_area?: schema.herdGrazingTypeInsert["l_grazing_area"]
    l_grazing_geometry_zone?: GrazingZoneInput
  },
): Promise<void> {
  try {
    await fdm.transaction(async (tx) => {
      // The herd of a grazing never changes, so it can be read before the lock; the values the
      // correction is checked against are read after it
      const [record] = await tx
        .select({ l_id_herd: schema.herdGrazing.l_id_herd })
        .from(schema.herdGrazing)
        .where(eq(schema.herdGrazing.l_id_grazing, l_id_grazing))
        .limit(1)
      if (!record) {
        throw new Error("Grazing record not found")
      }
      await checkPermission(tx, "herd", "write", record.l_id_herd, principal_id, "updateGrazing")
      await lockFarmOfHerd(tx, record.l_id_herd)

      const existing = await tx
        .select({
          l_id_herd: schema.herdGrazing.l_id_herd,
          b_id: schema.herdGrazing.b_id,
          l_grazing_start: schema.herdGrazing.l_grazing_start,
          l_grazing_end: schema.herdGrazing.l_grazing_end,
          l_grazing_hours: schema.herdGrazing.l_grazing_hours,
          l_grazing_area: schema.herdGrazing.l_grazing_area,
          l_grazing_geometry_zone: schema.herdGrazing.l_grazing_geometry_zone,
        })
        .from(schema.herdGrazing)
        .where(eq(schema.herdGrazing.l_id_grazing, l_id_grazing))
        .limit(1)

      if (existing.length === 0) {
        throw new Error("Grazing record not found")
      }

      const nextStart = properties.l_grazing_start ?? existing[0].l_grazing_start
      const nextEnd = assertGrazingEnd(
        properties.l_grazing_end === undefined
          ? existing[0].l_grazing_end
          : properties.l_grazing_end,
      )
      assertIntervalEndNotBeforeStart(nextStart, nextEnd, "l_grazing")
      assertGrazingHours(properties.l_grazing_hours)
      const herd = await getHerdPeriod(tx, existing[0].l_id_herd)
      assertGrazingWithinHerdPeriod(herd, nextStart, nextEnd)

      const zone = normalizeZone(properties.l_grazing_geometry_zone, "l_grazing_geometry_zone")
      assertGrazingExtent(
        zone === undefined ? existing[0].l_grazing_geometry_zone : zone,
        properties.l_grazing_area === undefined
          ? existing[0].l_grazing_area
          : properties.l_grazing_area,
        existing[0].b_id,
      )

      await assertGrazingFitsHerd(
        tx,
        existing[0].l_id_herd,
        {
          b_id: existing[0].b_id,
          l_grazing_start: nextStart,
          l_grazing_end: nextEnd,
          l_grazing_hours:
            properties.l_grazing_hours === undefined
              ? existing[0].l_grazing_hours
              : properties.l_grazing_hours,
        },
        l_id_grazing,
      )

      // A correction that moves the grazing into another year can be the first grazing of that
      // year, just like a new record
      const nextYear = nextStart.getUTCFullYear()
      if (nextYear !== existing[0].l_grazing_start.getUTCFullYear()) {
        await enableIntentionForFirstGrazing(
          tx,
          principal_id,
          herd.b_id_farm,
          nextYear,
          l_id_grazing,
        )
      }

      // Only the documented columns: a key added at runtime (such as another herd or field) is
      // never written. An omitted value stays as it is; `null` clears it.
      const updatedRows = await tx
        .update(schema.herdGrazing)
        .set({
          l_grazing_start: properties.l_grazing_start,
          l_grazing_end: properties.l_grazing_end,
          l_grazing_hours: properties.l_grazing_hours,
          l_grazing_area: properties.l_grazing_area,
          ...(zone !== undefined ? { l_grazing_geometry_zone: zone } : {}),
          updated: new Date(),
        })
        .where(eq(schema.herdGrazing.l_id_grazing, l_id_grazing))
        .returning({ l_id_grazing: schema.herdGrazing.l_id_grazing })
      // Removed in the meantime: fail, so a changed grazing intention is rolled back as well
      if (updatedRows.length === 0) {
        throw new Error("Grazing record not found")
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for updateGrazing", {
      l_id_grazing,
      l_grazing_start: properties.l_grazing_start,
      l_grazing_end: properties.l_grazing_end,
      l_grazing_hours: properties.l_grazing_hours,
      l_grazing_area: properties.l_grazing_area,
      l_grazing_geometry_zone_type: properties.l_grazing_geometry_zone?.type,
    })
  }
}

/**
 * Turns on the grazing intention of a farm for a year when the farm has no grazing in that year
 * yet, so the first grazing recorded in a year, also by a correction, marks the year as grazed.
 * Later grazings leave the intention as the farmer set it.
 *
 * @param tx - The transaction.
 * @param principal_id - Principal recording the grazing.
 * @param b_id_farm - The farm.
 * @param year - The year of the grazing start (UTC).
 * @param exclude_l_id_grazing - A grazing that does not count, such as the one being corrected.
 */
async function enableIntentionForFirstGrazing(
  tx: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  year: number,
  exclude_l_id_grazing?: schema.herdGrazingTypeSelect["l_id_grazing"],
): Promise<void> {
  const grazingInYear = await tx
    .select({ l_id_grazing: schema.herdGrazing.l_id_grazing })
    .from(schema.herdGrazing)
    .innerJoin(schema.herdStarting, eq(schema.herdGrazing.l_id_herd, schema.herdStarting.l_id_herd))
    .where(
      and(
        eq(schema.herdStarting.b_id_farm, b_id_farm),
        gte(schema.herdGrazing.l_grazing_start, new Date(Date.UTC(year, 0, 1))),
        lt(schema.herdGrazing.l_grazing_start, new Date(Date.UTC(year + 1, 0, 1))),
        exclude_l_id_grazing
          ? ne(schema.herdGrazing.l_id_grazing, exclude_l_id_grazing)
          : undefined,
      ),
    )
    .limit(1)

  if (grazingInYear.length === 0) {
    await setGrazingIntention(tx, principal_id, b_id_farm, year, true)
  }
}

/** The farm of a herd and the period it runs, to check a grazing against. */
type HerdPeriod = {
  b_id_farm: schema.farmsTypeSelect["b_id_farm"]
  l_start: Date | null
  l_end: Date | null
}

/**
 * Reads the farm and the period of a herd.
 *
 * @param tx - The transaction.
 * @param l_id_herd - The herd.
 * @returns The farm, start and end of the herd.
 * @throws When the herd does not belong to a farm.
 */
async function getHerdPeriod(
  tx: FdmType,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
): Promise<HerdPeriod> {
  const [herd] = await tx
    .select({
      b_id_farm: schema.herdStarting.b_id_farm,
      l_start: schema.herdStarting.l_start,
      l_end: schema.herdEnding.l_end,
    })
    .from(schema.herdStarting)
    .leftJoin(schema.herdEnding, eq(schema.herdStarting.l_id_herd, schema.herdEnding.l_id_herd))
    .where(eq(schema.herdStarting.l_id_herd, l_id_herd))
    .limit(1)
  if (!herd) {
    throw new Error(`Herd ${l_id_herd} does not belong to a farm`)
  }
  return herd
}

/**
 * Checks that a grazing lies within the period of its herd: it does not start on a day before
 * the herd started, and when the herd has ended, the grazing has an end before the herd's end.
 *
 * @param herd - The period of the herd.
 * @param start - The start of the grazing.
 * @param end - The end of the grazing.
 * @throws When the grazing lies (partly) outside the period of the herd.
 */
function assertGrazingWithinHerdPeriod(herd: HerdPeriod, start: Date, end: Date): void {
  const startsTooEarly = herd.l_start && dayNumber(start) < dayNumber(herd.l_start)
  const endsTooLate = herd.l_end && end.getTime() >= herd.l_end.getTime()
  if (startsTooEarly || endsTooLate) {
    throw new Error("Grazing is outside the period of the herd")
  }
}

/**
 * Checks that a grazing has an end date: every grazing is recorded with a first and a last day.
 *
 * @param end - The end of the grazing.
 * @returns The end.
 * @throws When the end is missing or not a valid date.
 */
function assertGrazingEnd(end: Date | null | undefined): Date {
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
    throw new Error("A grazing needs an end date")
  }
  return end
}

/**
 * Checks the grazing hours per day.
 *
 * @param hours - The hours per day; not set is allowed.
 * @throws When the hours are not a number above 0 and at most 24.
 */
function assertGrazingHours(hours: number | null | undefined): void {
  if (hours === null || hours === undefined) return
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    throw new Error(`Invalid grazing hours: ${hours}`)
  }
}

/** The parts of a grazing that decide whether it fits next to the other grazings of its herd. */
type GrazingSlot = {
  b_id?: string | null
  l_grazing_start: Date
  l_grazing_end?: Date | null
  l_grazing_hours?: number | null
}

/** Most grazing hours a herd can have on one calendar day, summed over its grazings. */
const MAX_GRAZING_HOURS_PER_DAY = 24

/**
 * Loads the other grazings of a herd and checks that a new or corrected grazing fits next to them
 * (see {@link assertGrazingFits}).
 *
 * @param tx - The transaction.
 * @param l_id_herd - The herd.
 * @param grazing - The new or corrected grazing.
 * @param exclude_l_id_grazing - The grazing being corrected, which does not count.
 * @param batch - Grazings of the same herd added earlier in the same batch.
 */
async function assertGrazingFitsHerd(
  tx: FdmType,
  l_id_herd: schema.herdsTypeSelect["l_id_herd"],
  grazing: GrazingSlot,
  exclude_l_id_grazing?: schema.herdGrazingTypeSelect["l_id_grazing"],
  batch: GrazingSlot[] = [],
): Promise<void> {
  const grazingRows = await tx
    .select({
      b_id: schema.herdGrazing.b_id,
      l_grazing_start: schema.herdGrazing.l_grazing_start,
      l_grazing_end: schema.herdGrazing.l_grazing_end,
      l_grazing_hours: schema.herdGrazing.l_grazing_hours,
    })
    .from(schema.herdGrazing)
    .where(
      and(
        eq(schema.herdGrazing.l_id_herd, l_id_herd),
        exclude_l_id_grazing
          ? ne(schema.herdGrazing.l_id_grazing, exclude_l_id_grazing)
          : undefined,
      ),
    )

  assertGrazingFits(grazing, [...grazingRows, ...batch])
}

/**
 * Checks that a grazing fits next to the other grazings of the same herd. Grazings may share a
 * day, also on the same field: a herd can graze two zones of a field on one day, or the same zone
 * in the morning and the afternoon. Their hours per day are added up, and the sum may not exceed
 * 24 hours on any calendar day. A grazing without hours counts as 0 hours. Days are whole
 * calendar days, counting the first and the last day.
 *
 * @param grazing - The new or corrected grazing.
 * @param others - The other grazings of the herd.
 * @throws When the hours exceed 24 on a day.
 */
function assertGrazingFits(grazing: GrazingSlot, others: GrazingSlot[]): void {
  const sharingDay: GrazingSlot[] = []
  for (const other of others) {
    if (
      sharesCalendarDay(
        grazing.l_grazing_start,
        grazing.l_grazing_end,
        other.l_grazing_start,
        other.l_grazing_end,
      )
    ) {
      sharingDay.push(other)
    }
  }

  // The hours on a day only go up on the first day of a grazing, so the busiest day of the new
  // grazing is its own first day or the first day of one of the grazings it shares a day with
  const firstDay = dayNumber(grazing.l_grazing_start)
  const checkDays = new Set([
    firstDay,
    ...sharingDay.map((other) => Math.max(firstDay, dayNumber(other.l_grazing_start))),
  ])
  for (const day of checkDays) {
    let hours = grazing.l_grazing_hours ?? 0
    for (const other of sharingDay) {
      const otherEnd = other.l_grazing_end
        ? dayNumber(other.l_grazing_end)
        : Number.POSITIVE_INFINITY
      if (dayNumber(other.l_grazing_start) <= day && day <= otherEnd) {
        hours += other.l_grazing_hours ?? 0
      }
    }
    if (hours > MAX_GRAZING_HOURS_PER_DAY + 1e-9) {
      throw new Error("Grazing hours of this herd exceed 24 hours on a day")
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
  l_id_grazing: schema.herdGrazingTypeSelect["l_id_grazing"],
): Promise<void> {
  try {
    await fdm.transaction(async (tx) => {
      // The herd of a grazing never changes, so it can be read before the lock
      const existing = await tx
        .select({ l_id_herd: schema.herdGrazing.l_id_herd })
        .from(schema.herdGrazing)
        .where(eq(schema.herdGrazing.l_id_grazing, l_id_grazing))
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
        "removeGrazing",
      )
      // Serialize with the other livestock changes of the farm, such as a correction of this
      // grazing
      await lockFarmOfHerd(tx, existing[0].l_id_herd)

      await tx.delete(schema.herdGrazing).where(eq(schema.herdGrazing.l_id_grazing, l_id_grazing))
    })
  } catch (err) {
    throw handleError(err, "Exception for removeGrazing", { l_id_grazing })
  }
}

/**
 * Lists the zones used earlier for grazing on a field, so they can be reused. Identical zones are
 * listed once; the most recently used zone comes first.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the zones.
 * @param b_id - Field ID.
 * @param limit - Maximum number of zones to return. Defaults to 20.
 * @param options - Optional filters, applied to the grazing records before they are grouped:
 *   `from` and `to` keep only grazings that overlap that period (inclusive), also one that started
 *   earlier and runs into it, for example to find the zones in use around a date;
 *   `exclude_l_id_grazing` leaves out one record, such as the
 *   grazing being edited, while other uses of the same zone still count.
 * @returns The zones as recorded, with their area within the field (ha), last use and herds.
 */
export async function getGrazingZonesForField(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: schema.fieldsTypeSelect["b_id"],
  limit = 20,
  options?: {
    from?: Date
    to?: Date
    exclude_l_id_grazing?: schema.herdGrazingTypeSelect["l_id_grazing"]
  },
): Promise<GrazingZone[]> {
  try {
    await checkPermission(fdm, "field", "read", b_id, principal_id, "getGrazingZonesForField")

    const zone = schema.herdGrazing.l_grazing_geometry_zone
    const firstZone = sql`(ARRAY_AGG(${zone}))[1]`
    const lastUsed = max(schema.herdGrazing.l_grazing_start)

    const rows = await fdm
      .select({
        zone: sql<string>`ST_AsGeoJSON(${firstZone})`,
        area: sql<number>`${areaHa(clippedZone(firstZone, schema.fields.b_geometry))}::FLOAT`,
        last_used: lastUsed,
        usage_count: count(),
        herd_names: sql<(string | null)[]>`ARRAY_AGG(DISTINCT ${schema.herds.l_herd_name})`,
      })
      .from(schema.herdGrazing)
      .innerJoin(schema.fields, eq(schema.herdGrazing.b_id, schema.fields.b_id))
      .innerJoin(schema.herds, eq(schema.herdGrazing.l_id_herd, schema.herds.l_id_herd))
      .where(
        and(
          eq(schema.herdGrazing.b_id, b_id),
          isNotNull(zone),
          // A grazing counts in the period when it overlaps it, also one that started earlier
          // and runs into it
          withPeriodTimeframe(
            undefined,
            schema.herdGrazing.l_grazing_start,
            schema.herdGrazing.l_grazing_end,
            { start: options?.from, end: options?.to },
          ),
          options?.exclude_l_id_grazing
            ? ne(schema.herdGrazing.l_id_grazing, options.exclude_l_id_grazing)
            : undefined,
        ),
      )
      // Group by the exact geometry, so a reused zone is listed once
      .groupBy(sql`ST_AsBinary(${zone})`, schema.fields.b_id)
      .orderBy(desc(lastUsed))
      .limit(limit)

    return rows.map((row) => ({
      l_grazing_geometry_zone: JSON.parse(row.zone) as GeoJSON.MultiPolygon,
      l_grazing_area_grazed: row.area,
      // Each group has at least one record with a required start, so the latest start is set
      last_used: row.last_used as Date,
      usage_count: row.usage_count,
      l_herd_names: row.herd_names.filter((name): name is string => name !== null),
    }))
  } catch (err) {
    throw handleError(err, "Exception for getGrazingZonesForField", { b_id, ...options })
  }
}

/**
 * Retrieves per field the area grazed by the farm's herds in a period, for example to calculate
 * the stocking density on the grazing platform.
 *
 * A grazing without a zone and without an area covers the whole field. Otherwise the grazed area is
 * the union of all zones on the field (clipped to the field), so successive strips add up instead of
 * counting once. An area without a location counts as at least that area. The result never exceeds
 * the field area. Grazings without a field are ignored.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - Principal requesting the areas.
 * @param b_id_farm - Farm ID.
 * @param timeframe - Optional timeframe; grazings that overlap it count.
 * @returns One item per grazed field with its area and grazed area (ha).
 */
export async function getGrazedAreaForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: schema.farmsTypeSelect["b_id_farm"],
  timeframe?: Timeframe,
): Promise<GrazedFieldArea[]> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getGrazedAreaForFarm")

    const herdRows = await fdm
      .select({ l_id_herd: schema.herdStarting.l_id_herd })
      .from(schema.herdStarting)
      .where(eq(schema.herdStarting.b_id_farm, b_id_farm))
    const herdIds = herdRows.map((h) => h.l_id_herd)
    if (herdIds.length === 0) {
      return []
    }

    const zone = schema.herdGrazing.l_grazing_geometry_zone
    const area = schema.herdGrazing.l_grazing_area
    const where = withPeriodTimeframe(
      and(inArray(schema.herdGrazing.l_id_herd, herdIds), isNotNull(schema.herdGrazing.b_id)),
      schema.herdGrazing.l_grazing_start,
      schema.herdGrazing.l_grazing_end,
      timeframe,
    )

    const rows = await fdm
      .select({
        b_id: schema.fields.b_id,
        b_area: sql<number | null>`${areaHa(schema.fields.b_geometry)}::FLOAT`,
        has_whole_field: sql<boolean>`BOOL_OR(${zone} IS NULL AND ${area} IS NULL)`,
        zone_area: sql<
          number | null
        >`${areaHa(sql`ST_Union(${clippedZone(zone, schema.fields.b_geometry)})`)}::FLOAT`,
        max_area: sql<number | null>`MAX(${area})::FLOAT`,
      })
      .from(schema.herdGrazing)
      .innerJoin(schema.fields, eq(schema.herdGrazing.b_id, schema.fields.b_id))
      .where(where)
      .groupBy(schema.fields.b_id)

    return rows.map((row) => {
      const b_area = row.b_area ?? 0
      const b_area_grazed = row.has_whole_field
        ? b_area
        : Math.min(b_area, Math.max(row.zone_area ?? 0, row.max_area ?? 0))
      return { b_id: row.b_id, b_area, b_area_grazed }
    })
  } catch (err) {
    throw handleError(err, "Exception for getGrazedAreaForFarm", { b_id_farm, timeframe })
  }
}
