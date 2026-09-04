import type { Timeframe } from "@nmi-agro/fdm-core"
import {
  getCultivationsForFarm,
  getFertilizerApplicationsForFarm,
  getFields,
  getGrazingCalendarForFarm,
  getHarvestsForFarm,
  getParametersForHarvestCat,
  getSoilAnalysesForFarm,
} from "@nmi-agro/fdm-core"
import type { TimelineField, TimelineGrazing } from "~/components/blocks/timeline/gantt-view"
import { getHarvestParameterLabel } from "~/components/blocks/harvest/parameters"
import { fdm } from "~/lib/fdm.server"

/**
 * Fetches and shapes one timeframe's worth of timeline data for a farm. Shared by the timeline
 * page's full load (an initial multi-year window) and the on-demand single-year resource route
 * (`farm.$b_id_farm.$calendar.timeline.year.ts`, triggered as the user scrolls near the edge of
 * what's already loaded, or jumps to a year via the sidebar) — both need identical shaping so the
 * client can merge results from either path without special-casing.
 */
export async function fetchTimelineFields(
  principal_id: string,
  b_id_farm: string,
  timeframe: Timeframe,
): Promise<TimelineField[]> {
  const [
    fields,
    cultivationsByField,
    fertilizerApplicationsByField,
    harvestsByCultivation,
    soilAnalysesByField,
    grazings,
  ] = await Promise.all([
    getFields(fdm, principal_id, b_id_farm, timeframe),
    getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getSoilAnalysesForFarm(fdm, principal_id, b_id_farm, timeframe),
    getGrazingCalendarForFarm(fdm, principal_id, b_id_farm, timeframe),
  ])

  const grazingsByField = new Map<string, TimelineGrazing[]>()
  const unassignedGrazings: TimelineGrazing[] = []

  for (const g of grazings) {
    const entry: TimelineGrazing = {
      l_id_grazing: g.l_id_grazing,
      l_id_herd: g.l_id_herd,
      l_herd_name: g.l_herd_name ?? "Koppel",
      l_grazing_start: new Date(g.l_grazing_start),
      l_grazing_end: g.l_grazing_end ? new Date(g.l_grazing_end) : null,
      l_grazing_hours: g.l_grazing_hours ?? null,
      l_grazing_area: g.l_grazing_area ?? null,
      l_grazing_type: (g.l_grazing_type === "partial" ? "partial" : "full") as "full" | "partial" | null,
    }

    if (g.b_id) {
      if (!grazingsByField.has(g.b_id)) {
        grazingsByField.set(g.b_id, [])
      }
      grazingsByField.get(g.b_id)!.push(entry)
    } else {
      unassignedGrazings.push(entry)
    }
  }

  const hasAnyGrazing = grazings.length > 0

  const fieldList: TimelineField[] = fields.map((field) => {
    if (!field?.b_id || !field?.b_name) {
      throw new Error("Invalid field data structure")
    }

    const cultivations = cultivationsByField.get(field.b_id) ?? []
    const harvests = cultivations.flatMap((cultivation) =>
      (harvestsByCultivation.get(cultivation.b_lu) ?? []).map((harvest) => {
        const analysis = harvest.harvestable.harvestable_analyses[0]
        const fillableParameters = getParametersForHarvestCat(cultivation.b_lu_harvestcat)
        const parameters = fillableParameters
          .filter((param) => analysis?.[param] != null)
          .map((param) => ({
            label: getHarvestParameterLabel(param),
            value: analysis?.[param] as number,
          }))
        return {
          b_id_harvesting: harvest.b_id_harvesting,
          b_lu: harvest.b_lu,
          b_lu_name: cultivation.b_lu_name,
          b_lu_harvest_date: harvest.b_lu_harvest_date,
          parameters,
        }
      }),
    )

    const fieldGrazings = grazingsByField.get(field.b_id) ?? []

    return {
      b_id: field.b_id,
      b_name: field.b_name,
      b_area: field.b_area != null ? Math.round(field.b_area * 10) / 10 : 0,
      b_bufferstrip: field.b_bufferstrip ?? false,
      cultivations: cultivations.map((cultivation) => ({
        b_lu: cultivation.b_lu,
        b_lu_name: cultivation.b_lu_name,
        b_lu_croprotation: cultivation.b_lu_croprotation,
        b_lu_start: cultivation.b_lu_start,
        b_lu_end: cultivation.b_lu_end,
        b_lu_harvestable: cultivation.b_lu_harvestable,
      })),
      fertilizerApplications: fertilizerApplicationsByField.get(field.b_id) ?? [],
      harvests,
      soilAnalyses: soilAnalysesByField.get(field.b_id) ?? [],
      grazings: fieldGrazings,
    }
  })

  if (unassignedGrazings.length > 0) {
    fieldList.push({
      b_id: "unassigned-grazing",
      b_name: "Zonder perceel",
      b_area: 0,
      b_bufferstrip: false,
      cultivations: [],
      fertilizerApplications: [],
      harvests: [],
      soilAnalyses: [],
      grazings: unassignedGrazings,
    })
  }

  return fieldList.sort((a, b) => {
    if (hasAnyGrazing) {
      const aGrazingDays = (a.grazings ?? []).length
      const bGrazingDays = (b.grazings ?? []).length
      if (bGrazingDays !== aGrazingDays) {
        return bGrazingDays - aGrazingDays
      }
    }
    return a.b_name.localeCompare(b.b_name, "nl")
  })
}
