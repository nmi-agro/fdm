import type { Timeframe } from "@nmi-agro/fdm-core"
import type { MultiPolygon } from "geojson"
import { calculateGrazingMetrics } from "@nmi-agro/fdm-calculator"
import {
  getCensusForFarm,
  getCultivationsForFarm,
  getFertilizerApplicationsForFarm,
  getFields,
  getGrazedAreaForFarm,
  getGrazingCalendarForFarm,
  getHarvestsForFarm,
  getHerdsForFarm,
} from "@nmi-agro/fdm-core"
import { fdm } from "~/lib/fdm.server"

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
    p_app_date: string
  }>
}

export interface GrazingCalendarFieldRow {
  b_id: string
  b_name: string
  b_area: number
  totalGrazingDays: number
  weeks: GrazingCalendarCell[]
  recentRestDays: number | null
}

export interface GrazingCalendarMatrix {
  year: number
  todayKey: string
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
  openGrazings: Array<{
    l_id_grazing: string
    l_id_herd: string
    b_id?: string | null
    b_name?: string | null
    l_grazing_start: string
    l_grazing_hours?: number | null
  }>
  summary: {
    weidedagen: number
    averageHours: number
    weidemelkDays: number
    platformArea: number
    platformGvePerHa: number | null
    overgrazingAlertsCount: number
    alerts: Array<{ b_id: string; message: string }>
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

export async function fetchGrazingCalendarMatrix(
  principal_id: string,
  b_id_farm: string,
  calendarYear: number,
): Promise<GrazingCalendarMatrix> {
  const yearStart = new Date(`${calendarYear}-01-01T00:00:00.000Z`)
  const yearEnd = new Date(`${calendarYear}-12-31T23:59:59.999Z`)
  const timeframe: Timeframe = { start: yearStart, end: yearEnd }

  const today = new Date()
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
  ] = await Promise.all([
    getFields(fdm, principal_id, b_id_farm, timeframe),
    getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getGrazingCalendarForFarm(fdm, principal_id, b_id_farm, timeframe),
    getHerdsForFarm(fdm, principal_id, b_id_farm),
    getGrazedAreaByField(principal_id, b_id_farm, calendarYear, today),
    getCensusForFarm(fdm, principal_id, b_id_farm),
    getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe),
  ])
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
      l_id_category: h.l_id_category ?? "rvo_100",
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
    const cults = cultivationsByField.get(field.b_id) ?? []
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

  // Pre-calculate 52 weeks intervals for the calendar year
  // Weeks from week 14 (approx early April) to week 44 (late October) or full 52 weeks
  const weeksInfo: Array<{ weekNum: number; start: Date; end: Date; label: string }> = []
  // Standard 52 weeks
  const jan4 = new Date(Date.UTC(calendarYear, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const firstMonday = new Date(jan4)
  firstMonday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1))

  for (let w = 1; w <= 52; w++) {
    const wStart = new Date(firstMonday)
    wStart.setUTCDate(firstMonday.getUTCDate() + (w - 1) * 7)
    const wEnd = new Date(wStart)
    wEnd.setUTCDate(wStart.getUTCDate() + 6)
    wEnd.setUTCHours(23, 59, 59, 999)

    weeksInfo.push({
      weekNum: w,
      start: wStart,
      end: wEnd,
      label: `Wk ${w}`,
    })
  }

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

    // Build week cells
    const weeks: GrazingCalendarCell[] = weeksInfo.map((wInfo) => {
      const cellGrazings = fieldGrazings.filter((g) => {
        const gStart = new Date(g.l_grazing_start)
        const gEnd = grazingEnd(gStart, g.l_grazing_end, today)
        return gStart <= wInfo.end && gEnd >= wInfo.start
      })

      const cellHarvests = fieldHarvests.filter(
        (h) => h.harvestDate <= wInfo.end && h.harvestDate >= wInfo.start,
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
          return date >= wInfo.start && date <= wInfo.end
        })
        .map((a) => ({
          p_app_id: a.p_app_id,
          p_name_nl: a.p_name_nl,
          p_app_amount_display: a.p_app_amount_display,
          p_app_amount_unit: a.p_app_amount_unit,
          p_app_date: toIsoDate(new Date(a.p_app_date)),
        }))

      return {
        key: `w-${wInfo.weekNum}`,
        label: wInfo.label,
        dateStart: toIsoDate(wInfo.start),
        dateEnd: toIsoDate(wInfo.end),
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
      b_area: field.b_area != null ? Math.round(field.b_area * 10) / 10 : 0,
      totalGrazingDays,
      weeks,
      recentRestDays,
    }
  })

  // Sort by totalGrazingDays descending, then name
  fieldRows.sort((a, b) => {
    if (b.totalGrazingDays !== a.totalGrazingDays) {
      return b.totalGrazingDays - a.totalGrazingDays
    }
    return a.b_name.localeCompare(b.b_name, "nl")
  })

  // Calculate metrics summary using fdm-calculator
  const metrics = calculateGrazingMetrics({
    year: calendarYear,
    today,
    herds: herds.map((h) => ({
      l_id_herd: h.l_id_herd,
      l_herd_name: h.l_herd_name,
      l_id_category: h.l_id_category,
      l_lsu: h.l_lsu,
      count: 0, // Counts will be populated from census in insights
    })),
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

  const openGrazings = grazings
    .filter((g) => g.l_grazing_end === null || g.l_grazing_end === undefined)
    .map((g) => ({
      l_id_grazing: g.l_id_grazing,
      l_id_herd: g.l_id_herd,
      b_id: g.b_id,
      b_name: g.b_name,
      l_grazing_start: toIsoDate(new Date(g.l_grazing_start)),
      l_grazing_hours: g.l_grazing_hours,
    }))

  return {
    year: calendarYear,
    todayKey,
    fields: fieldRows,
    herds: herdList,
    openGrazings,
    summary: {
      weidedagen: metrics.weidedagen.total,
      averageHours: metrics.weideUren.averageHoursPerDay,
      weidemelkDays: metrics.weidemelk.qualifyingDays,
      platformArea: metrics.beweidingsplatform.areaHa,
      platformGvePerHa: metrics.veebezetting.platformGvePerHa,
      overgrazingAlertsCount: metrics.overbeweidingAlerts.length,
      alerts: metrics.overbeweidingAlerts.map((a) => ({ b_id: a.b_id, message: a.message })),
    },
  }
}
