import type {
  FieldInput,
  GrazingMetricsInput,
  GrazingMetricsResult,
  HerdInput,
  MonthlyDistributionEntry,
  RestPeriodDetail,
} from "./types"
import {
  STOCKING_DENSITY_BENCHMARKS,
  WEIDEMELK_CATEGORY_CODE,
  WEIDEMELK_MIN_HOURS_PER_DAY,
  WEIDEMELK_TARGET_DAYS,
} from "./constants"
import { calculateRestBeforeUses, type FieldUse } from "./rest-periods"

function toDateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Most grazing hours a herd can have on one day, also when its grazings add up to more. */
const MAX_HOURS_PER_DAY = 24

/** Midnight (UTC) at the start of the calendar day of a date. */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function getDaysBetween(start: Date, end: Date): string[] {
  const days: string[] = []
  const current = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  )
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))

  while (current <= last) {
    days.push(toDateKey(current))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return days
}

/**
 * Calculates comprehensive pasture grazing metrics, Weidemelk compliance, livestock stocking densities,
 * and parcel rest intervals for a farm in a specified calendar year.
 *
 * Agronomic references:
 * - *Handboek Melkveehouderij* (Wageningen Livestock Research), Chapter 3:
 *   - §3.9.2 Groei overige sneden (growth days counted from the day after the cows leave a field).
 *   - §3.10 Graslandgebruik (grazing systems: omweiden moves to a new field every four days).
 * - Stichting Weidegang & ZuivelNL Weidemelk criteria (minimum 120 days x 6 hours for category RVO 100).
 * - Statutory GVE conversion factors (Tabel 4 & Tabel 6).
 *
 * Core computation rules:
 * 1. **Weidedagen (Distinct Days)**:
 *    Calculates distinct calendar days covered by grazing intervals. Concurrent grazing by the same herd
 *    across multiple parcels on the same calendar day counts as exactly one weidedag (double-count protection).
 * 2. **Weide-uren (per herd per day)**:
 *    The hours of all grazings of a herd on one day are added up (8 hours on one field or zone and
 *    7 hours on another make 15), up to 24 hours. The farm's hours of a day are those of the herd
 *    that grazed longest; the farm average divides them by the days with recorded hours.
 *    Grazings without recorded hours add nothing and are flagged as incomplete.
 * 3. **Weidemelk 120 x 6 Norm**:
 *    Pools all herds assigned to category `rvo_100` (Melk- en kalfkoeien) across the farm into a unified
 *    calendar day set. Only days on which one such herd grazed at least 6 hours qualify.
 * 4. **Realised vs Planned Separation**:
 *    Periods starting on or before `today` are computed as realised metrics. Future-dated periods are tracked
 *    separately as planned values and are never added to realised totals.
 * 5. **Beweidingsplatform & Veebezetting**:
 *    Computes unique grassland area with started grazing (the grazed area per field, with grazing zones
 *    combined when `fields[].b_area_grazed` is given) and derives
 *    stocking density in GVE/ha with qualitative classification (extensief, gemiddeld, intensief).
 * 6. **Rustperiodes**:
 *    Calculates the rest before each use (grazing and mowing/harvests) of a parcel, counted from the
 *    most recent earlier use of the same part of the parcel (see {@link calculateRestBeforeUses}), so
 *    successive grazing strips each get their own rest. The rest is in growth days, from the day
 *    after the earlier use up to the day before the next (end 4 May, start 26 May: 21 days).
 *    Grazing a part on successive days forms one period without a rest in between.
 *    The rest is reported as information, not judged: whether enough
 *    grass has grown depends on growth and grazing that are not modelled here.
 *
 * @param input - The {@link GrazingMetricsInput} payload containing the calendar year, optional status date, herds, grazing records, field parcels, and harvest records.
 * @returns A {@link GrazingMetricsResult} object with computed weidedagen, hours, Weidemelk progress, platform metrics, stocking densities and rest periods.
 *
 * @example
 * ```typescript
 * import { calculateGrazingMetrics } from "@nmi-agro/fdm-calculator"
 *
 * const result = calculateGrazingMetrics({
 *   year: 2026,
 *   today: new Date("2026-08-01"),
 *   herds: [
 *     { l_id_herd: "h1", l_herd_name: "Melkkoeien", l_id_category: "rvo_100", l_lsu: 1.0, count: 96 }
 *   ],
 *   fields: [
 *     { b_id: "f1", b_name: "De Hoek", b_area: 4.2, isGrassland: true }
 *   ],
 *   grazings: [
 *     {
 *       l_id_grazing: "g1",
 *       l_id_herd: "h1",
 *       b_id: "f1",
 *       l_grazing_start: new Date("2026-05-01"),
 *       l_grazing_end: new Date("2026-05-04"),
 *       l_grazing_hours: 8
 *     }
 *   ]
 * })
 *
 * console.log(result.weidedagen.total) // 4
 * console.log(result.weidemelk.qualifyingDays) // 4
 * console.log(result.beweidingsplatform.areaHa) // 4.2
 * ```
 */
export function calculateGrazingMetrics(input: GrazingMetricsInput): GrazingMetricsResult {
  const year = input.year
  const today = input.today ?? new Date()
  const todayKey = toDateKey(today)
  const todayTime = new Date(todayKey + "T23:59:59.999Z").getTime()

  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

  const herdMap = new Map<string, HerdInput>()
  for (const herd of input.herds) {
    herdMap.set(herd.l_id_herd, herd)
  }

  const fieldMap = new Map<string, FieldInput>()
  for (const field of input.fields) {
    fieldMap.set(field.b_id, field)
  }

  // Filter grazings relevant to this calendar year
  const yearGrazings = input.grazings.filter((g) => {
    const start = new Date(g.l_grazing_start)
    const end = new Date(g.l_grazing_end)
    return start <= yearEnd && end >= yearStart
  })

  // 1. Day & hour mappings
  const herdRealisedDays = new Map<string, Set<string>>()
  const herdPlannedDays = new Map<string, Set<string>>()
  const herdDailyHours = new Map<string, Map<string, number>>() // herdId -> (dayKey -> hours)
  const allRealisedDays = new Set<string>()
  const allPlannedDays = new Set<string>()
  const incompleteRecordIds = new Set<string>()

  // Weidemelk: per day the hours of the dairy herd (category rvo_100) that grazed longest
  const weidemelkDailyHours = new Map<string, number>()

  for (const herd of input.herds) {
    herdRealisedDays.set(herd.l_id_herd, new Set())
    herdPlannedDays.set(herd.l_id_herd, new Set())
    herdDailyHours.set(herd.l_id_herd, new Map())
  }

  for (const g of yearGrazings) {
    const gStart = new Date(g.l_grazing_start)
    const gEnd = new Date(g.l_grazing_end)

    // Clip to year
    const clippedStart = gStart < yearStart ? yearStart : gStart
    const clippedEnd = gEnd > yearEnd ? yearEnd : gEnd

    const days = getDaysBetween(clippedStart, clippedEnd)
    const isStarted = gStart.getTime() <= todayTime
    const hours = g.l_grazing_hours ?? null

    if (isStarted && hours === null) {
      incompleteRecordIds.add(g.l_id_grazing)
    }

    const herdRealised = herdRealisedDays.get(g.l_id_herd) ?? new Set()
    const herdPlanned = herdPlannedDays.get(g.l_id_herd) ?? new Set()
    const herdHoursMap = herdDailyHours.get(g.l_id_herd) ?? new Map<string, number>()

    for (const dayKey of days) {
      const isPastOrToday = dayKey <= todayKey && isStarted
      if (isPastOrToday) {
        herdRealised.add(dayKey)
        allRealisedDays.add(dayKey)
      } else {
        herdPlanned.add(dayKey)
        allPlannedDays.add(dayKey)
      }
      if (hours !== null) {
        const current = herdHoursMap.get(dayKey) ?? 0
        herdHoursMap.set(dayKey, Math.min(MAX_HOURS_PER_DAY, current + hours))
      }
    }

    herdRealisedDays.set(g.l_id_herd, herdRealised)
    herdPlannedDays.set(g.l_id_herd, herdPlanned)
    herdDailyHours.set(g.l_id_herd, herdHoursMap)
  }

  // Weidemelk counts a day when one dairy herd grazed at least 6 hours on it (its hours on all
  // fields added up). The farm's weide-uren of a day are those of the herd that grazed longest.
  const farmDailyHours = new Map<string, number>()
  for (const [l_id_herd, hoursMap] of herdDailyHours.entries()) {
    const isWeidemelkCategory = herdMap.get(l_id_herd)?.l_id_category === WEIDEMELK_CATEGORY_CODE
    for (const [dayKey, hours] of hoursMap.entries()) {
      if (isWeidemelkCategory) {
        weidemelkDailyHours.set(dayKey, Math.max(weidemelkDailyHours.get(dayKey) ?? 0, hours))
      }
      if (dayKey <= todayKey) {
        farmDailyHours.set(dayKey, Math.max(farmDailyHours.get(dayKey) ?? 0, hours))
      }
    }
  }

  // 2. Weidedagen summary
  const perHerdWeidedagen: Record<string, { total: number; planned: number }> = {}
  const perHerdWeideUren: Record<string, { totalHours: number; averageHoursPerDay: number }> = {}

  for (const herd of input.herds) {
    const realisedCount = herdRealisedDays.get(herd.l_id_herd)?.size ?? 0
    const plannedCount = herdPlannedDays.get(herd.l_id_herd)?.size ?? 0
    perHerdWeidedagen[herd.l_id_herd] = {
      total: realisedCount,
      planned: plannedCount,
    }

    const hoursMap = herdDailyHours.get(herd.l_id_herd) ?? new Map<string, number>()
    let herdTotalHours = 0
    let daysWithHours = 0
    for (const [dayKey, h] of hoursMap.entries()) {
      if (dayKey > todayKey) continue
      herdTotalHours += h
      daysWithHours += 1
    }

    const avg = daysWithHours > 0 ? Number((herdTotalHours / daysWithHours).toFixed(1)) : 0
    perHerdWeideUren[herd.l_id_herd] = {
      totalHours: Number(herdTotalHours.toFixed(1)),
      averageHoursPerDay: avg,
    }
  }

  let totalFarmHours = 0
  for (const hours of farmDailyHours.values()) {
    totalFarmHours += hours
  }
  const farmAverageHours =
    farmDailyHours.size > 0 ? Number((totalFarmHours / farmDailyHours.size).toFixed(1)) : 0

  // 3. Weidemelk
  let weidemelkQualifyingDays = 0
  let weidemelkPlannedQualifyingDays = 0

  for (const [dayKey, maxH] of weidemelkDailyHours.entries()) {
    if (maxH >= WEIDEMELK_MIN_HOURS_PER_DAY) {
      if (dayKey <= todayKey) {
        weidemelkQualifyingDays += 1
      } else {
        weidemelkPlannedQualifyingDays += 1
      }
    }
  }

  const weidemelkIsMet = weidemelkQualifyingDays >= WEIDEMELK_TARGET_DAYS
  const weidemelkMargin = weidemelkQualifyingDays - WEIDEMELK_TARGET_DAYS

  // 4. Monthly Distribution
  const monthlyMap = new Map<
    number,
    { realised: Set<string>; planned: Set<string>; herdDays: Record<string, Set<string>> }
  >()
  for (let m = 1; m <= 12; m++) {
    monthlyMap.set(m, {
      realised: new Set(),
      planned: new Set(),
      herdDays: {},
    })
  }

  for (const herd of input.herds) {
    const realisedSet = herdRealisedDays.get(herd.l_id_herd) ?? new Set()
    const plannedSet = herdPlannedDays.get(herd.l_id_herd) ?? new Set()

    for (const day of realisedSet) {
      const m = parseInt(day.slice(5, 7), 10)
      const entry = monthlyMap.get(m)!
      entry.realised.add(day)
      if (!entry.herdDays[herd.l_id_herd]) {
        entry.herdDays[herd.l_id_herd] = new Set()
      }
      entry.herdDays[herd.l_id_herd].add(day)
    }

    for (const day of plannedSet) {
      const m = parseInt(day.slice(5, 7), 10)
      const entry = monthlyMap.get(m)!
      entry.planned.add(day)
      if (!entry.herdDays[herd.l_id_herd]) {
        entry.herdDays[herd.l_id_herd] = new Set()
      }
      entry.herdDays[herd.l_id_herd].add(day)
    }
  }

  const monthlyDistribution: MonthlyDistributionEntry[] = []
  for (let m = 1; m <= 12; m++) {
    const entry = monthlyMap.get(m)!
    const herdCounts: Record<string, number> = {}
    for (const [hId, daySet] of Object.entries(entry.herdDays)) {
      herdCounts[hId] = daySet.size
    }
    monthlyDistribution.push({
      month: m,
      realisedDays: entry.realised.size,
      plannedDays: entry.planned.size,
      herdDays: herdCounts,
    })
  }

  // 5. Beweidingsplatform & Veebezetting
  const platformFieldsMap = new Map<string, number>() // b_id -> max grazed area (ha)
  const platformHerds = new Set<string>()

  for (const g of yearGrazings) {
    const gStart = new Date(g.l_grazing_start)
    if (gStart.getTime() > todayTime) {
      continue // Only started records count toward realised platform
    }
    if (!g.b_id) {
      continue
    }

    const field = fieldMap.get(g.b_id)
    if (!field || !field.isGrassland) {
      continue
    }

    platformHerds.add(g.l_id_herd)
    // Prefer the grazed area with all zones combined; otherwise the largest grazed area of a
    // single grazing, capped at the field area
    const effectiveArea =
      field.b_area_grazed != null
        ? Math.min(field.b_area_grazed, field.b_area)
        : Math.min(g.l_grazing_area_grazed ?? field.b_area, field.b_area)

    const currentMax = platformFieldsMap.get(g.b_id) ?? 0
    platformFieldsMap.set(g.b_id, Math.max(currentMax, effectiveArea))
  }

  let platformArea = 0
  const platformFieldIds: string[] = []
  for (const [b_id, area] of platformFieldsMap.entries()) {
    platformArea += area
    platformFieldIds.push(b_id)
  }
  platformArea = Number(platformArea.toFixed(2))

  let totalGrasslandArea = 0
  for (const field of input.fields) {
    if (field.isGrassland) {
      totalGrasslandArea += field.b_area
    }
  }
  totalGrasslandArea = Number(totalGrasslandArea.toFixed(2))

  let totalGve = 0
  let platformGve = 0

  for (const herd of input.herds) {
    const factor = herd.l_lsu ?? 1.0
    const herdGve = herd.count * factor
    totalGve += herdGve

    if (platformHerds.has(herd.l_id_herd)) {
      platformGve += herdGve
    }
  }
  totalGve = Number(totalGve.toFixed(1))
  platformGve = Number(platformGve.toFixed(1))

  const platformGvePerHa = platformArea > 0 ? Number((platformGve / platformArea).toFixed(1)) : null
  const totalGrasslandGvePerHa =
    totalGrasslandArea > 0 ? Number((totalGve / totalGrasslandArea).toFixed(1)) : null

  let platformStockingCategory: "extensief" | "gemiddeld" | "intensief" | null = null
  if (platformGvePerHa !== null) {
    if (platformGvePerHa < STOCKING_DENSITY_BENCHMARKS.extensiveMax) {
      platformStockingCategory = "extensief"
    } else if (platformGvePerHa <= STOCKING_DENSITY_BENCHMARKS.averageMax) {
      platformStockingCategory = "gemiddeld"
    } else {
      platformStockingCategory = "intensief"
    }
  }

  // 6. Rustperiodes & Overbeweiding
  // Collect all uses per field: grazings (with their zone) and harvests (whole field)
  const fieldEventsMap = new Map<string, FieldUse[]>()

  for (const field of input.fields) {
    fieldEventsMap.set(field.b_id, [])
  }

  for (const g of yearGrazings) {
    if (!g.b_id || !fieldEventsMap.has(g.b_id)) {
      continue
    }
    const start = new Date(g.l_grazing_start)
    // The rest is the difference between the dates: the end day counts as used, whatever time
    // of day the end was stored with
    const end = startOfUtcDay(new Date(g.l_grazing_end))
    fieldEventsMap
      .get(g.b_id)!
      .push({ type: "weiden", start, end, zone: g.l_grazing_geometry_zone ?? null })
  }

  if (input.harvests) {
    for (const h of input.harvests) {
      if (!fieldEventsMap.has(h.b_id)) {
        continue
      }
      const hDate = new Date(h.b_harvest_date)
      if (hDate >= yearStart && hDate <= yearEnd) {
        fieldEventsMap
          .get(h.b_id)!
          .push({ type: "maaien", start: hDate, end: startOfUtcDay(hDate) })
      }
    }
  }

  const rustperiodes: RestPeriodDetail[] = []

  for (const [b_id, events] of fieldEventsMap.entries()) {
    if (events.length < 2) {
      continue
    }

    const field = fieldMap.get(b_id)

    // Rest is counted per part of the field, so successive strips are not a re-use
    for (const { use: next, previous: prev, restDays } of calculateRestBeforeUses(events)) {
      if (!prev || restDays === null) {
        continue
      }

      rustperiodes.push({
        b_id,
        b_name: field?.b_name ?? null,
        lastUseType: prev.type,
        lastUseDate: prev.end,
        nextUseType: next.type,
        nextUseDate: next.start,
        restDays,
      })
    }
  }

  return {
    weidedagen: {
      total: allRealisedDays.size,
      planned: allPlannedDays.size,
      perHerd: perHerdWeidedagen,
    },
    weideUren: {
      totalHours: Number(totalFarmHours.toFixed(1)),
      averageHoursPerDay: farmAverageHours,
      perHerd: perHerdWeideUren,
    },
    weidemelk: {
      targetDays: WEIDEMELK_TARGET_DAYS,
      minHours: WEIDEMELK_MIN_HOURS_PER_DAY,
      qualifyingDays: weidemelkQualifyingDays,
      plannedQualifyingDays: weidemelkPlannedQualifyingDays,
      isMet: weidemelkIsMet,
      marginDays: weidemelkMargin,
      ruleDescription: "120 dagen x 6 uur (categorie 100 Melk- en kalfkoeien)",
    },
    beweidingsplatform: {
      areaHa: platformArea,
      fieldCount: platformFieldIds.length,
      fieldIds: platformFieldIds,
    },
    veebezetting: {
      platformGvePerHa,
      totalGrasslandGvePerHa,
      totalGve,
      totalGrasslandArea,
      platformStockingCategory,
    },
    rustperiodes,
    incompleteRecords: {
      count: incompleteRecordIds.size,
      grazingIds: Array.from(incompleteRecordIds),
    },
    monthlyDistribution,
  }
}
