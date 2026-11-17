import {
  CultivationCatalogue,
  getCultivationsFromCatalogue,
  getDefaultsForHarvestParameters,
  getParametersForHarvestCat,
  HarvestParameters,
  HarvestParametersDefault,
} from "@nmi-agro/fdm-core"
import { data } from "react-router"
import { getSession } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"
import { Route } from "./+types/farm.$b_id_farm.$calendar.timeline.harvestable_analysis.$b_lu_catalogue"

/**
 * Gets the harvest parameters and the default harvest date for the given b_lu_catalogue.
 *
 * It is this way becault getDefaultsForHarvestParameters has to do some calculations unlike
 * cultivation options or fertilizer options, so we don't preload all default harvest
 * parameters.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)

    const catalogue = await getCultivationsFromCatalogue(
      fdm,
      session.principal_id,
      params.b_id_farm,
    )

    const cultivation = catalogue.find((c) => c.b_lu_catalogue === params.b_lu_catalogue)

    return {
      b_lu_catalogue: params.b_lu_catalogue,
      b_date_harvest_default: cultivation?.b_date_harvest_default,
      harvestParameters: cultivation ? getParametersForHarvestCat(cultivation.b_lu_harvestcat) : [],
      harvestParameterDefaults: getDefaultsForHarvestParameters(params.b_lu_catalogue, catalogue),
    } as TimelineHarvestParametersResult
  } catch (err) {
    return data(err instanceof Error ? err.message : "Er is iets fout gegaan.", 500)
  }
}

export type TimelineHarvestParametersResult = {
  b_lu_catalogue: string
  b_date_harvest_default: CultivationCatalogue["b_date_harvest_default"]
  harvestParameters: HarvestParameters
  harvestParameterDefaults: HarvestParametersDefault
}
