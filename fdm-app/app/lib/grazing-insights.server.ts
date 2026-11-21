import type { GrazingMetricsResult } from "@nmi-agro/fdm-calculator"
import type { Timeframe } from "@nmi-agro/fdm-core"
import { calculateGrazingMetrics } from "@nmi-agro/fdm-calculator"
import {
  getCensusForFarm,
  getCultivationsForFarm,
  getFields,
  getGrazingCalendarForFarm,
  getHarvestsForFarm,
} from "@nmi-agro/fdm-core"
import { fdm } from "~/lib/fdm.server"
import { getGrazedAreaByField } from "~/lib/grazing-calendar.server"
import { censusDateForYear, farmToday } from "~/lib/grazing-dates"
import { herdsOfYear, type YearHerd, zoneWithinField } from "~/lib/grazing-herds"
import { serverNow } from "~/lib/server-now.server"

export interface GrazingInsightsData {
  year: number
  metrics: GrazingMetricsResult
  herds: YearHerd[]

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

  // Today's calendar day in the Netherlands, as a date-only value like the grazing dates
  const now = serverNow()
  const today = farmToday(now)
  const [allFields, cultivationsByField, harvestsByCultivation, grazings, census, grazedArea] =
    await Promise.all([
      getFields(fdm, principal_id, b_id_farm, timeframe),
      getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
      getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe),
      getGrazingCalendarForFarm(fdm, principal_id, b_id_farm, timeframe),
      // The herds of the selected year, so the density of a past year uses that year's animals
      getCensusForFarm(fdm, principal_id, b_id_farm, censusDateForYear(calendarYear, now)),
      getGrazedAreaByField(principal_id, b_id_farm, calendarYear, today),
    ])

  // The herds of the selected year, also those that have ended since
  const herdList = herdsOfYear(census, grazings)
  const fieldGeometries = new Map(allFields.map((f) => [f.b_id, f.b_geometry]))

  const grasslandFields = allFields
    .filter((field) => {
      if (field.b_bufferstrip) return false
      const cults = cultivationsByField.get(field.b_id) ?? []
      return cults.some((c) => c.b_lu_croprotation === "grass")
    })
    .map((field) => ({
      b_id: field.b_id,
      b_name: field.b_name,
      // Unrounded, as in the grazing calendar, so both pages show the same platform area
      b_area: field.b_area ?? 0,
    }))

  const harvests: Array<{ b_id: string; b_harvest_date: Date }> = []
  for (const field of grasslandFields) {
    // Only a grass harvest is a mowing of the grassland
    const cults = (cultivationsByField.get(field.b_id) ?? []).filter(
      (c) => c.b_lu_croprotation === "grass",
    )
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
    today,
    herds: herdList,
    fields: grasslandFields.map((f) => ({
      b_id: f.b_id,
      b_name: f.b_name,
      b_area: f.b_area,
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
      l_grazing_geometry_zone: zoneWithinField(
        g.l_grazing_geometry_zone,
        g.b_id ? fieldGeometries.get(g.b_id) : null,
      ),
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
