import type { ApplicationMethods } from "@nmi-agro/fdm-data"
import type { HarvestParametersDefault, Timeframe } from "@nmi-agro/fdm-core"
import {
  getCultivationsForFarm,
  getCultivationsFromCatalogue,
  getDefaultsForHarvestParameters,
  getFertilizerApplicationsForFarm,
  getFertilizerParametersDescription,
  getFertilizers,
  getFields,
  getHarvestsForFarm,
  getParametersForHarvestCat,
  getSoilAnalysesForFarm,
} from "@nmi-agro/fdm-core"
import type { TimelineField } from "~/components/blocks/timeline/gantt-view"
import type { FertilizerOption } from "~/components/blocks/fertilizer-applications/types.d"
import { getHarvestParameterLabel } from "~/components/blocks/harvest/parameters"
import { getSoilParametersForSoilAnalysisType } from "~/components/blocks/soil/parameters.server"
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
  ] = await Promise.all([
    getFields(fdm, principal_id, b_id_farm, timeframe),
    getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getSoilAnalysesForFarm(fdm, principal_id, b_id_farm, timeframe),
  ])

  return fields
    .map((field) => {
      if (!field?.b_id || !field?.b_name) {
        throw new Error("Invalid field data structure")
      }

      const cultivations = cultivationsByField.get(field.b_id) ?? []
      const harvests = cultivations.flatMap((cultivation) =>
        (harvestsByCultivation.get(cultivation.b_lu) ?? []).map((harvest) => {
          const analysis = harvest.harvestable.harvestable_analyses[0]
          // Only include parameters that are actually fillable for this crop's harvest
          // category, computed here (server-side) so the client component doesn't need to
          // import fdm-core at all — importing it client-side would pull server-only code
          // (e.g. authentication using node:crypto) into the browser bundle.
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

      return {
        b_id: field.b_id,
        b_name: field.b_name,
        b_area: field.b_area != null ? Math.round(field.b_area * 10) / 10 : 0,
        b_bufferstrip: field.b_bufferstrip ?? false,
        cultivations: cultivations.map((cultivation) => ({
          b_lu: cultivation.b_lu,
          b_lu_catalogue: cultivation.b_lu_catalogue,
          b_lu_name: cultivation.b_lu_name,
          b_lu_croprotation: cultivation.b_lu_croprotation,
          b_lu_start: cultivation.b_lu_start,
          b_lu_end: cultivation.b_lu_end,
          b_lu_harvestable: cultivation.b_lu_harvestable,
          b_lu_harvestcat: cultivation.b_lu_harvestcat,
        })),
        fertilizerApplications: fertilizerApplicationsByField.get(field.b_id) ?? [],
        harvests,
        soilAnalyses: soilAnalysesByField.get(field.b_id) ?? [],
      }
    })
    .sort((a, b) => a.b_name.localeCompare(b.b_name, "nl"))
}

export type TimelineHarvestCatalogueDefaults = {
  b_lu_harvestcat: string | null
  b_date_harvest_default: string | null
  defaultHarvestParameters: HarvestParametersDefault
}

const SOIL_ANALYSIS_TYPES = ["standard", "all", "nmin", "derogation"] as const

/**
 * Farm-level option/default data needed to render the quick-add Sheet forms (fertilizer, harvest,
 * cultivation, soil) directly from the timeline, without a per-open round trip. Unlike
 * `fetchTimelineFields` this data isn't field- or cultivation-specific (fertilizers and the
 * cultivation catalogue are shared across the whole farm), so it's cheap to compute once and pass
 * down alongside the timeline's fields.
 */
export async function fetchTimelineEventFormData(principal_id: string, b_id_farm: string) {
  const [fertilizers, cultivationsCatalogue] = await Promise.all([
    getFertilizers(fdm, principal_id, b_id_farm),
    getCultivationsFromCatalogue(fdm, principal_id, b_id_farm),
  ])

  const fertilizerParameterDescription = getFertilizerParametersDescription()
  const applicationMethods = fertilizerParameterDescription.find(
    (x: { parameter: string }) => x.parameter === "p_app_method_options",
  )
  const applicationMethodOptions = (applicationMethods?.options ?? [])
    .filter(
      (option): option is { value: ApplicationMethods; label: string } => option.value !== null,
    )
    .map((option) => ({ value: option.value, label: option.label }))

  const fertilizerOptions: FertilizerOption[] = fertilizers.map((fertilizer) => ({
    value: fertilizer.p_id,
    label: fertilizer.p_name_nl ?? "",
    applicationMethodOptions: (fertilizer.p_app_method_options ?? [])
      .map((opt) => applicationMethodOptions.find((x) => x.value === opt))
      .filter((option): option is { value: ApplicationMethods; label: string } => !!option),
    p_app_amount_unit: fertilizer.p_app_amount_unit,
  }))

  const cultivationCatalogueOptions = cultivationsCatalogue
    .map((item) => ({ value: item.b_lu_catalogue, label: item.b_lu_name ?? item.b_lu_catalogue }))
    .sort((a, b) => a.label.localeCompare(b.label, "nl"))

  const harvestDefaultsByCatalogue: Record<string, TimelineHarvestCatalogueDefaults> = {}
  for (const item of cultivationsCatalogue) {
    try {
      harvestDefaultsByCatalogue[item.b_lu_catalogue] = {
        b_lu_harvestcat: item.b_lu_harvestcat,
        b_date_harvest_default: item.b_date_harvest_default,
        defaultHarvestParameters: getDefaultsForHarvestParameters(
          item.b_lu_catalogue,
          cultivationsCatalogue,
        ),
      }
    } catch {
      // Skip catalogue items missing the data getDefaultsForHarvestParameters needs — the Sheet
      // simply falls back to empty defaults for that crop.
    }
  }

  // Parameter *keys* only (not labels) — `getHarvestParameterLabel` is a pure function already
  // safe to call client-side (see gantt-view.tsx), so the client derives labels itself.
  const harvestParametersByCat: Record<string, string[]> = {}
  for (const item of cultivationsCatalogue) {
    const cat = item.b_lu_harvestcat ?? ""
    if (harvestParametersByCat[cat]) continue
    harvestParametersByCat[cat] = getParametersForHarvestCat(item.b_lu_harvestcat)
  }

  const soilParameterDescriptionsByType = Object.fromEntries(
    SOIL_ANALYSIS_TYPES.map((type) => [type, getSoilParametersForSoilAnalysisType(type)]),
  )

  return {
    fertilizerOptions,
    applicationMethodOptions,
    cultivationCatalogueOptions,
    harvestDefaultsByCatalogue,
    harvestParametersByCat,
    soilParameterDescriptionsByType,
  }
}

/** Return shape of `fetchTimelineEventFormData`, re-exported for the client-side Sheet component
 *  that renders using this preloaded data (`~/components/blocks/timeline/add-event-sheet.tsx`). */
export type TimelineEventFormData = Awaited<ReturnType<typeof fetchTimelineEventFormData>>
