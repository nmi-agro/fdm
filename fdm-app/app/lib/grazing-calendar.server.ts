import type { Timeframe } from "@nmi-agro/fdm-core"
import type { MultiPolygon } from "geojson"
import { calculateGrazingMetrics } from "@nmi-agro/fdm-calculator"
import {
  getCensusForFarm,
  getCultivationsForFarm,
  getFertilizerApplicationsForFarm,
  getFertilizers,
  getFields,
  getGrazedAreaForFarm,
  getGrazingCalendarForFarm,
  getHarvestsForFarm,
  getHerdsForFarm,
} from "@nmi-agro/fdm-core"
import {
  type FertilizerKind,
  getFertilizerCategoryFromRvoCode,
} from "~/components/blocks/fertilizer/utils"
import { fdm } from "~/lib/fdm.server"
import { censusDateForYear, farmToday } from "~/lib/grazing-dates"
import {
  GRAZING_SEASON_FIRST_MONTH,
  GRAZING_SEASON_LAST_MONTH,
  type RestAlert,
} from "~/lib/grazing-status"

/**
 * Grazed area per field (ha) of the grazings that started in the calendar year up to today, with
 * all zones on a field combined. This is the `b_area_grazed` input of `calculateGrazingMetrics`,
 * which only counts started grazings for the grazing platform.
 */
export async function getGrazedAreaByField(
  principal_id: string,
  b_id_farm: string,
  calendarYear: number,
  today: Date,
): Promise<Map<string, number>> {
  const yearStart = new Date(`${calendarYear}-01-01T00:00:00.000Z`)
  const yearEnd = new Date(`${calendarYear}-12-31T23:59:59.999Z`)
  const end = today < yearEnd ? today : yearEnd
  if (end < yearStart) return new Map()
  const areas = await getGrazedAreaForFarm(fdm, principal_id, b_id_farm, { start: yearStart, end })
  return new Map(areas.map((a) => [a.b_id, a.b_area_grazed]))
}

export interface GrazingCalendarCell {
  key: string // e.g. "w-18" or "d-2026-05-12"
  label: string
  dateStart: string
  dateEnd: string
  type: "empty" | "weiden" | "maaien" | "mixed"
  isPlanned?: boolean
  grazingEntries?: Array<{
    l_id_grazing: string
    l_id_herd: string
    l_herd_name: string
    /** Start of the grazing (YYYY-MM-DD), which may lie before the week. */
    l_grazing_start: string
    /** End of the grazing (YYYY-MM-DD), which may lie after the week; `null` while it runs. */
    l_grazing_end: string | null
    l_grazing_hours?: number | null
    /** Grazed part of the field without a known location (ha). */
    l_grazing_area?: number | null
    /** Grazed zone within the field; `null` for the whole field or an area without location. */
    l_grazing_geometry_zone?: MultiPolygon | null
    /** Grazed area (ha): the zone within the field, the recorded area, or the whole field. */
    l_grazing_area_grazed?: number | null
    isPlanned?: boolean
    colorIndex: number
  }>
  harvestEntries?: Array<{
    b_id_harvesting: string
    b_lu: string
    b_lu_name: string
    harvestDate: string
  }>
  /** Fertilizer applications in the week. They do not count as use for the rest of a field. */
  fertilizerEntries?: Array<{
    p_app_id: string
    p_name_nl: string | null
    p_app_amount_display: number | null
    p_app_amount_unit: string
    /** Kind of fertilizer, for the colour of its marker (as on the fertilizer badge). */
    p_type: FertilizerKind
    p_app_date: string
  }>
}

export interface GrazingCalendarFieldRow {
  b_id: string
  b_name: string
  b_area: number
  totalGrazingDays: number
  /** One cell per day of the grazing season. */
  cells: GrazingCalendarCell[]
  recentRestDays: number | null
}

const MONTH_NAMES = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
] as const

/** A column of the calendar. */
export interface GrazingCalendarColumn {
  key: string
  /** Header text: the month name on the first day of a month, otherwise empty. */
  label: string
  dateStart: string
  dateEnd: string
  /** The first day of a month, drawn with a stronger line. */
  groupStart: boolean
}

export interface GrazingCalendarMatrix {
  year: number
  todayKey: string
  columns: GrazingCalendarColumn[]
  fields: GrazingCalendarFieldRow[]
  herds: Array<{
    l_id_herd: string
    l_herd_name: string
    l_id_category: string
    l_lsu: number
    /** Current number of animals in the herd. */
    count: number
    colorIndex: number
  }>
  summary: {
    weidedagen: number
    averageHours: number
    weidemelkDays: number
    platformArea: number
    platformGvePerHa: number | null
    overgrazingAlertsCount: number
    /** Fields used again before the rest guideline; see `formatRestAlert`. */
    alerts: RestAlert[]
  }
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * The last day a grazing covers in the calendar: its end date, or today for a grazing that still
 * runs (cows out without an end date). A running grazing that starts in the future covers its
 * start day only.
 */
function grazingEnd(start: Date, end: Date | string | null | undefined, today: Date): Date {
  if (end) return new Date(end)
  return today > start ? today : start
}

/**
 * The columns of the calendar: every day of the grazing season, 1 March up to and including 31
 * October, as in the grassland calendars of Nieuw Nederlands Weiden.
 */
function getCalendarColumns(
  calendarYear: number,
): Array<GrazingCalendarColumn & { start: Date; end: Date }> {
  const columns: Array<GrazingCalendarColumn & { start: Date; end: Date }> = []
  const last = new Date(Date.UTC(calendarYear, GRAZING_SEASON_LAST_MONTH, 0))
  for (
    let start = new Date(Date.UTC(calendarYear, GRAZING_SEASON_FIRST_MONTH - 1, 1));
    start <= last;
    start = new Date(start.getTime() + 86_400_000)
  ) {
    const end = new Date(start)
    end.setUTCHours(23, 59, 59, 999)
    const isMonthStart = start.getUTCDate() === 1
    columns.push({
      key: `d-${toIsoDate(start)}`,
      label: isMonthStart ? MONTH_NAMES[start.getUTCMonth()] : "",
      dateStart: toIsoDate(start),
      dateEnd: toIsoDate(start),
      groupStart: isMonthStart,
      start,
      end,
    })
  }
  return columns
}

export async function fetchGrazingCalendarMatrix(
  principal_id: string,
  b_id_farm: string,
  calendarYear: number,
): Promise<GrazingCalendarMatrix> {
  const yearStart = new Date(`${calendarYear}-01-01T00:00:00.000Z`)
  const yearEnd = new Date(`${calendarYear}-12-31T23:59:59.999Z`)
  const timeframe: Timeframe = { start: yearStart, end: yearEnd }

  // Today's calendar day in the Netherlands, as a date-only value like the grazing dates
  const today = farmToday()
  const todayKey = toIsoDate(today)
  // The day up to which rest is counted: today, or the last day of a past year
  const restReference = today < yearEnd ? today : yearEnd

  const [
    allFields,
    cultivationsByField,
    harvestsByCultivation,
    grazings,
    herds,
    grazedArea,
    census,
    fertilizerApplicationsByField,
    fertilizers,
  ] = await Promise.all([
    getFields(fdm, principal_id, b_id_farm, timeframe),
    getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getGrazingCalendarForFarm(fdm, principal_id, b_id_farm, timeframe),
    getHerdsForFarm(fdm, principal_id, b_id_farm),
    getGrazedAreaByField(principal_id, b_id_farm, calendarYear, today),
    // The herds of the selected year, also for a past year
    getCensusForFarm(fdm, principal_id, b_id_farm, censusDateForYear(calendarYear)),
    getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getFertilizers(fdm, principal_id, b_id_farm),
  ])
  // Kind of each fertilizer of the farm, derived from its RVO code as on the fertilizer badge
  const fertilizerKinds = new Map(
    fertilizers.map((f) => [f.p_id, getFertilizerCategoryFromRvoCode(f.p_type_rvo)]),
  )
  const censusMap = new Map(census.map((c) => [c.l_id_herd, c.count]))

  // Filter grassland fields (crop rotation === "grass" and not a buffer strip)
  const grasslandFields = allFields.filter((field) => {
    if (field.b_bufferstrip) return false
    const cults = cultivationsByField.get(field.b_id) ?? []
    return cults.some((c) => c.b_lu_croprotation === "grass")
  })

  // Map herds to colors
  const herdColorMap = new Map<string, number>()
  const herdList = herds.map((h, idx) => {
    herdColorMap.set(h.l_id_herd, idx % 6)
    return {
      l_id_herd: h.l_id_herd,
      l_herd_name: h.l_herd_name ?? "Koppel",
      l_id_category: h.l_id_category,
      l_lsu: h.l_lsu ?? 1.0,
      count: censusMap.get(h.l_id_herd) ?? 0,
      colorIndex: idx % 6,
    }
  })

  // Map harvests per field
  const harvestsByField = new Map<
    string,
    Array<{ b_id_harvesting: string; b_lu: string; b_lu_name: string; harvestDate: Date }>
  >()

  for (const field of grasslandFields) {
    // Only a grass harvest is a mowing; a harvest of another crop on the field is not a use of
    // the grassland
    const cults = (cultivationsByField.get(field.b_id) ?? []).filter(
      (c) => c.b_lu_croprotation === "grass",
    )
    const fieldHarvests = cults.flatMap((c) =>
      (harvestsByCultivation.get(c.b_lu) ?? []).flatMap((h) => {
        if (!h.b_lu_harvest_date) return []
        return [
          {
            b_id_harvesting: h.b_id_harvesting,
            b_lu: h.b_lu,
            b_lu_name: c.b_lu_name,
            harvestDate: new Date(h.b_lu_harvest_date),
          },
        ]
      }),
    )
    harvestsByField.set(field.b_id, fieldHarvests)
  }

  const columns = getCalendarColumns(calendarYear)

  // Group grazings by field
  const grazingsByField = new Map<string, typeof grazings>()
  for (const g of grazings) {
    if (g.b_id) {
      if (!grazingsByField.has(g.b_id)) {
        grazingsByField.set(g.b_id, [])
      }
      grazingsByField.get(g.b_id)!.push(g)
    }
  }

  // Calculate field rows
  const fieldRows: GrazingCalendarFieldRow[] = grasslandFields.map((field) => {
    const fieldGrazings = grazingsByField.get(field.b_id) ?? []
    const fieldHarvests = harvestsByField.get(field.b_id) ?? []

    // Calculate total distinct grazing days for sorting
    const grazingDaysSet = new Set<string>()
    for (const g of fieldGrazings) {
      const gStart = new Date(g.l_grazing_start)
      const gEnd = grazingEnd(gStart, g.l_grazing_end, today)
      const cur = new Date(
        Date.UTC(gStart.getUTCFullYear(), gStart.getUTCMonth(), gStart.getUTCDate()),
      )
      const last = new Date(Date.UTC(gEnd.getUTCFullYear(), gEnd.getUTCMonth(), gEnd.getUTCDate()))
      while (cur <= last) {
        if (cur.getUTCFullYear() === calendarYear) {
          grazingDaysSet.add(toIsoDate(cur))
        }
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
    }
    const totalGrazingDays = grazingDaysSet.size

    // One cell per column: a week, or a day of the shown month
    const cells: GrazingCalendarCell[] = columns.map((column) => {
      const cellGrazings = fieldGrazings.filter((g) => {
        const gStart = new Date(g.l_grazing_start)
        const gEnd = grazingEnd(gStart, g.l_grazing_end, today)
        return gStart <= column.end && gEnd >= column.start
      })

      const cellHarvests = fieldHarvests.filter(
        (h) => h.harvestDate <= column.end && h.harvestDate >= column.start,
      )

      let type: GrazingCalendarCell["type"] = "empty"
      let isPlanned = false

      if (cellGrazings.length > 0 && cellHarvests.length > 0) {
        type = "mixed"
      } else if (cellGrazings.length > 0) {
        type = "weiden"
      } else if (cellHarvests.length > 0) {
        type = "maaien"
      }

      const grazingEntries = cellGrazings.map((g) => {
        const gStart = new Date(g.l_grazing_start)
        const isFuture = toIsoDate(gStart) > todayKey
        if (isFuture) {
          isPlanned = true
        }
        return {
          l_id_grazing: g.l_id_grazing,
          l_id_herd: g.l_id_herd,
          l_herd_name: g.l_herd_name ?? "Koppel",
          l_grazing_start: toIsoDate(gStart),
          l_grazing_end: g.l_grazing_end ? toIsoDate(new Date(g.l_grazing_end)) : null,
          l_grazing_hours: g.l_grazing_hours,
          l_grazing_area: g.l_grazing_area,
          l_grazing_geometry_zone: g.l_grazing_geometry_zone ?? null,
          l_grazing_area_grazed: g.l_grazing_area_grazed,
          isPlanned: isFuture,
          colorIndex: herdColorMap.get(g.l_id_herd) ?? 0,
        }
      })

      const harvestEntries = cellHarvests.map((h) => ({
        b_id_harvesting: h.b_id_harvesting,
        b_lu: h.b_lu,
        b_lu_name: h.b_lu_name,
        harvestDate: toIsoDate(h.harvestDate),
      }))

      const fertilizerEntries = (fertilizerApplicationsByField.get(field.b_id) ?? [])
        .filter((a) => {
          const date = new Date(a.p_app_date)
          return date >= column.start && date <= column.end
        })
        .map((a) => ({
          p_app_id: a.p_app_id,
          p_name_nl: a.p_name_nl,
          p_type: fertilizerKinds.get(a.p_id) ?? ("other" as const),
          p_app_amount_display: a.p_app_amount_display,
          p_app_amount_unit: a.p_app_amount_unit,
          p_app_date: toIsoDate(new Date(a.p_app_date)),
        }))

      return {
        key: column.key,
        label: column.label,
        dateStart: column.dateStart,
        dateEnd: column.dateEnd,
        type,
        isPlanned,
        grazingEntries: grazingEntries.length > 0 ? grazingEntries : undefined,
        harvestEntries: harvestEntries.length > 0 ? harvestEntries : undefined,
        fertilizerEntries: fertilizerEntries.length > 0 ? fertilizerEntries : undefined,
      }
    })

    // Rest days: from the last use in the selected year up to today, or up to the end of a past
    // year. Uses in other years and planned uses after that day do not count.
    let recentRestDays: number | null = null
    if (restReference >= yearStart) {
      const lastUse = [
        ...fieldGrazings
          .filter((g) => new Date(g.l_grazing_start) <= restReference)
          .map((g) => {
            const end = grazingEnd(new Date(g.l_grazing_start), g.l_grazing_end, today)
            return end < restReference ? end : restReference
          }),
        ...fieldHarvests.map((h) => h.harvestDate).filter((date) => date <= restReference),
      ].reduce<Date | null>((latest, date) => (!latest || date > latest ? date : latest), null)
      if (lastUse && lastUse >= yearStart) {
        recentRestDays = Math.max(
          0,
          Math.floor((restReference.getTime() - lastUse.getTime()) / 86400000),
        )
      }
    }

    return {
      b_id: field.b_id,
      b_name: field.b_name,
      // Unrounded: the grazing dialog computes the area it saves from it; the display rounds
      b_area: field.b_area ?? 0,
      totalGrazingDays,
      cells,
      recentRestDays,
    }
  })

  // Fields grazed in the selected year first, then the largest fields first, then by name
  fieldRows.sort((a, b) => {
    const aGrazed = a.totalGrazingDays > 0
    const bGrazed = b.totalGrazingDays > 0
    if (aGrazed !== bGrazed) return aGrazed ? -1 : 1
    if (b.b_area !== a.b_area) return b.b_area - a.b_area
    return a.b_name.localeCompare(b.b_name, "nl")
  })

  // Calculate metrics summary using fdm-calculator
  const metrics = calculateGrazingMetrics({
    year: calendarYear,
    today,
    herds: herdList,
    fields: grasslandFields.map((f) => ({
      b_id: f.b_id,
      b_name: f.b_name,
      b_area: f.b_area ?? 0,
      b_area_grazed: grazedArea.get(f.b_id) ?? null,
      isGrassland: true,
    })),
    grazings: grazings.map((g) => ({
      l_id_grazing: g.l_id_grazing,
      l_id_herd: g.l_id_herd,
      b_id: g.b_id,
      l_grazing_start: new Date(g.l_grazing_start),
      l_grazing_end: g.l_grazing_end ? new Date(g.l_grazing_end) : null,
      l_grazing_hours: g.l_grazing_hours,
      l_grazing_area_grazed: g.l_grazing_area_grazed,
      l_grazing_geometry_zone: g.l_grazing_geometry_zone ?? null,
    })),
    harvests: grasslandFields.flatMap((f) =>
      (harvestsByField.get(f.b_id) ?? []).map((h) => ({
        b_id: f.b_id,
        b_harvest_date: h.harvestDate,
      })),
    ),
  })

  return {
    year: calendarYear,
    todayKey,
    columns: columns.map(({ start: _start, end: _end, ...column }) => column),
    fields: fieldRows,
    herds: herdList,
    summary: {
      weidedagen: metrics.weidedagen.total,
      averageHours: metrics.weideUren.averageHoursPerDay,
      weidemelkDays: metrics.weidemelk.qualifyingDays,
      platformArea: metrics.beweidingsplatform.areaHa,
      platformGvePerHa: metrics.veebezetting.platformGvePerHa,
      overgrazingAlertsCount: metrics.overbeweidingAlerts.length,
      alerts: metrics.overbeweidingAlerts.map((a) => ({
        b_id: a.b_id,
        b_name: a.b_name ?? null,
        restDays: a.restDays,
        thresholdDays: a.thresholdDays,
      })),
    },
  }
}
