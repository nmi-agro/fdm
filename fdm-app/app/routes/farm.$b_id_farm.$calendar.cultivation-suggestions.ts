import { getCultivationsForFarm, getFields } from "@nmi-agro/fdm-core"
import { data, type LoaderFunctionArgs } from "react-router"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import {
  type CultivationSuggestion,
  getCultivationSuggestionResultsForFarm,
} from "~/lib/cultivation-suggestion.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"

// Cap on simultaneous cultivation-suggestion lookups per farm, so farms with many fields
// missing a main cultivation don't overload the external NMI API with unbounded parallel
// requests (same limit as the farm dashboard).
const CULTIVATION_SUGGESTION_CONCURRENCY = 4

/**
 * Resource route that returns a suggested main cultivation for each field of a farm that has no
 * main cultivation in the calendar year, from the NMI estimates service.
 *
 * The fields table loads it with a fetcher after it renders, so the table's own loader only
 * reads the database and its link can be prefetched without starting requests to the NMI API.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("missing: b_id_farm", { status: 400, statusText: "missing: b_id_farm" })
    }

    const session = await getSession(request)
    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)
    const nmiApiKey = getNmiApiKey()

    const suggestions: Record<string, CultivationSuggestion> = {}
    if (!nmiApiKey) return { suggestions }

    const [fields, cultivationsForFarm] = await Promise.all([
      getFields(fdm, session.principal_id, b_id_farm, timeframe),
      getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
    ])
    const fieldsMissingCultivation = fields.filter(
      (field) => !getMainCultivation(cultivationsForFarm.get(field.b_id) ?? [], calendar),
    )
    if (fieldsMissingCultivation.length === 0) return { suggestions }

    // The database is read once for the farm; the NMI API gets a limited number of requests
    const results = await getCultivationSuggestionResultsForFarm(
      fdm,
      session.principal_id,
      b_id_farm,
      fieldsMissingCultivation.map((field) => field.b_id),
      calendar,
      nmiApiKey,
      { concurrency: CULTIVATION_SUGGESTION_CONCURRENCY },
    )
    for (const [b_id, result] of results) {
      if (result.status === "suggested") suggestions[b_id] = result.suggestion
    }

    return { suggestions }
  } catch (error) {
    throw handleLoaderError(error)
  }
}
