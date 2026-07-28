import { getCultivationsForFarm, getFields } from "@nmi-agro/fdm-core"
import { data, type LoaderFunctionArgs } from "react-router"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { buildFieldOptions } from "~/lib/hoofdteelt.server"

/**
 * Resource route that returns a minimal list of fields for a farm.
 *
 * Used by the sidebar's field picker dialog to let a user choose a field for a farm that
 * isn't the currently selected one, without loading the full fields overview page.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("missing: b_id_farm", { status: 400, statusText: "missing: b_id_farm" })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)
    const fields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)
    const cultivationsByField = await getCultivationsForFarm(
      fdm,
      session.principal_id,
      b_id_farm,
      timeframe,
    )

    const fieldOptions = buildFieldOptions(
      fields,
      cultivationsByField,
      params.calendar,
      timeframe.start?.getFullYear(),
    )

    return { fields: fieldOptions }
  } catch (error) {
    throw handleLoaderError(error)
  }
}
