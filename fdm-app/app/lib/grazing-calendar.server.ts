import type { Timeframe } from "@nmi-agro/fdm-core"
import {
  getCultivationsForFarm,
  getFields,
  getGrazingCalendarForFarm,
  getHarvestsForFarm,
  getHerdsForFarm,
} from "@nmi-agro/fdm-core"
import { calculateGrazingMetrics } from "@nmi-agro/fdm-calculator"
import { fdm } from "~/lib/fdm.server"

export interface GrazingCalendarCell {
  key: string // e.g. "w-18" or "d-2026-05-12"
  label: string
  dateStart: string
  dateEnd: string
  type: "empty" | "weiden" | "maaien" | "rust" | "mixed"
  isPlanned?: boolean
  grazingEntries?: Array<{
    l_id_grazing: string
    l_id_herd: string
    l_herd_name: string
    l_grazing_hours?: number | null
    l_grazing_area?: number | null
    l_grazing_type?: "full" | "partial" | null
    isPlanned?: boolean
    colorIndex: number
  }>
  harvestEntries?: Array<{
    b_id_harvesting: string
    b_lu: string
    b_lu_name: string
    harvestDate: string
  }>
  restDays?: number
}

export interface GrazingCalendarFieldRow {
  b_id: string
  b_name: string
  b_area: number
  isHuiskavel: boolean
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

export async function fetchGrazingCalendarMatrix(
  principal_id: string,
  b_id_farm: string,
  calendarYear: number,
  huiskavelFieldIds: string[] = [],
): Promise<GrazingCalendarMatrix> {
  const timeframe: Timeframe = {
    start: new Date(`${calendarYear}-01-01T00:00:00.000Z`),
    end: new Date(`${calendarYear}-12-31T23:59:59.999Z`),
  }

  const today = new Date()
  const todayKey = toIsoDate(today)

  const [allFields, cultivationsByField, harvestsByCultivation, grazings, herds] =
    await Promise.all([
      getFields(fdm, principal_id, b_id_farm, timeframe),
      getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
      getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe),
      getGrazingCalendarForFarm(fdm, principal_id, b_id_farm, timeframe),
      getHerdsForFarm(fdm, principal_id, b_id_farm),
    ])

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
      const gEnd = g.l_grazing_end ? new Date(g.l_grazing_end) : gStart
      const cur = new Date(Date.UTC(gStart.getUTCFullYear(), gStart.getUTCMonth(), gStart.getUTCDate()))
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
        const gEnd = g.l_grazing_end ? new Date(g.l_grazing_end) : gStart
        return gStart <= wInfo.end && gEnd >= wInfo.start
      })

      const cellHarvests = fieldHarvests.filter((h) => h.harvestDate <= wInfo.end && h.harvestDate >= wInfo.start)

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
          l_grazing_hours: g.l_grazing_hours,
          l_grazing_area: g.l_grazing_area,
          l_grazing_type: (g.l_grazing_type === "partial" ? "partial" : "full") as "full" | "partial",
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

      return {
        key: `w-${wInfo.weekNum}`,
        label: wInfo.label,
        dateStart: toIsoDate(wInfo.start),
        dateEnd: toIsoDate(wInfo.end),
        type,
        isPlanned,
        grazingEntries: grazingEntries.length > 0 ? grazingEntries : undefined,
        harvestEntries: harvestEntries.length > 0 ? harvestEntries : undefined,
      }
    })

    // Compute recent rest days (days since last use up to today or between uses)
    const allEvents = [
      ...fieldGrazings.map((g) => ({ date: new Date(g.l_grazing_end ?? g.l_grazing_start) })),
      ...fieldHarvests.map((h) => ({ date: h.harvestDate })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime())

    let recentRestDays: number | null = null
    if (allEvents.length > 0) {
      const lastEventDate = allEvents[0].date
      const diffMs = today.getTime() - lastEventDate.getTime()
      recentRestDays = Math.max(0, Math.floor(diffMs / 86400000))
    }

    return {
      b_id: field.b_id,
      b_name: field.b_name,
      b_area: field.b_area != null ? Math.round(field.b_area * 10) / 10 : 0,
      isHuiskavel: huiskavelFieldIds.includes(field.b_id),
      totalGrazingDays,
      weeks,
      recentRestDays,
    }
  })

  // Sort: Huiskavel fields first (if any specified), then by totalGrazingDays descending, then name
  fieldRows.sort((a, b) => {
    if (huiskavelFieldIds.length > 0) {
      if (a.isHuiskavel && !b.isHuiskavel) return -1
      if (!a.isHuiskavel && b.isHuiskavel) return 1
    }
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
      isGrassland: true,
    })),
    grazings: grazings.map((g) => ({
      l_id_grazing: g.l_id_grazing,
      l_id_herd: g.l_id_herd,
      b_id: g.b_id,
      l_grazing_start: new Date(g.l_grazing_start),
      l_grazing_end: g.l_grazing_end ? new Date(g.l_grazing_end) : null,
      l_grazing_hours: g.l_grazing_hours,
      l_grazing_area: g.l_grazing_area,
      l_grazing_type: (g.l_grazing_type === "partial" ? "partial" : "full") as "full" | "partial",
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
