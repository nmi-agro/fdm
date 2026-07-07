import { getFields } from "@nmi-agro/fdm-core"
import { data, type LoaderFunctionArgs } from "react-router"
import { getTimeframe } from "~/lib/calendar"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getSession } from "~/lib/auth.server"

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

    const fieldOptions = fields
      .map((field) => {
        if (!field?.b_id || !field?.b_name) {
          throw new Error("Invalid field data structure")
        }
        return {
          b_id: field.b_id,
          b_name: field.b_name,
          b_area: Math.round((field.b_area ?? 0) * 10) / 10,
        }
      })
      .sort((a, b) => a.b_name.localeCompare(b.b_name))

    return { fields: fieldOptions }
  } catch (error) {
    throw handleLoaderError(error)
  }
}
