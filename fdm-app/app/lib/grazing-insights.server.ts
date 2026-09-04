import type { Timeframe } from "@nmi-agro/fdm-core"
import {
  getCensusForFarm,
  getCultivationsForFarm,
  getFields,
  getGrazingCalendarForFarm,
  getHarvestsForFarm,
  getHerdsForFarm,
} from "@nmi-agro/fdm-core"
import type { GrazingMetricsResult } from "@nmi-agro/fdm-calculator"
import { calculateGrazingMetrics } from "@nmi-agro/fdm-calculator"
import { fdm } from "~/lib/fdm.server"

export interface GrazingInsightsData {
  year: number
  metrics: GrazingMetricsResult
  herds: Array<{
    l_id_herd: string
    l_herd_name: string
    l_id_category: string
    l_lsu: number
    count: number
    colorIndex: number
  }>
  grasslandFields: Array<{
    b_id: string
    b_name: string
    b_area: number
  }>
}

export async function fetchGrazingInsightsData(
  principal_id: string,
  b_id_farm: string,
  calendarYear: number,
): Promise<GrazingInsightsData> {
  const timeframe: Timeframe = {
    start: new Date(`${calendarYear}-01-01T00:00:00.000Z`),
    end: new Date(`${calendarYear}-12-31T23:59:59.999Z`),
  }

  const [allFields, cultivationsByField, harvestsByCultivation, grazings, herds, census] =
    await Promise.all([
      getFields(fdm, principal_id, b_id_farm, timeframe),
      getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
      getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe),
      getGrazingCalendarForFarm(fdm, principal_id, b_id_farm, timeframe),
      getHerdsForFarm(fdm, principal_id, b_id_farm),
      getCensusForFarm(fdm, principal_id, b_id_farm),
    ])

  const censusMap = new Map<string, number>()
  for (const c of census) {
    censusMap.set(c.l_id_herd, c.count)
  }

  const herdList = herds.map((h, idx) => ({
    l_id_herd: h.l_id_herd,
    l_herd_name: h.l_herd_name ?? "Koppel",
    l_id_category: h.l_id_category ?? "rvo_100",
    l_lsu: h.l_lsu ?? 1.0,
    count: censusMap.get(h.l_id_herd) ?? 0,
    colorIndex: idx % 6,
  }))

  const grasslandFields = allFields
    .filter((field) => {
      if (field.b_bufferstrip) return false
      const cults = cultivationsByField.get(field.b_id) ?? []
      return cults.some((c) => c.b_lu_croprotation === "grass")
    })
    .map((field) => ({
      b_id: field.b_id,
      b_name: field.b_name,
      b_area: field.b_area != null ? Math.round(field.b_area * 10) / 10 : 0,
    }))

  const harvests: Array<{ b_id: string; b_harvest_date: Date }> = []
  for (const field of grasslandFields) {
    const cults = cultivationsByField.get(field.b_id) ?? []
    for (const c of cults) {
      const fieldHarvests = harvestsByCultivation.get(c.b_lu) ?? []
      for (const h of fieldHarvests) {
        if (h.b_lu_harvest_date) {
          harvests.push({
            b_id: field.b_id,
            b_harvest_date: new Date(h.b_lu_harvest_date),
          })
        }
      }
    }
  }

  const metrics = calculateGrazingMetrics({
    year: calendarYear,
    today: new Date(),
    herds: herdList,
    fields: grasslandFields.map((f) => ({
      b_id: f.b_id,
      b_name: f.b_name,
      b_area: f.b_area,
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
    harvests,
  })

  return {
    year: calendarYear,
    metrics,
    herds: herdList,
    grasslandFields,
  }
}
