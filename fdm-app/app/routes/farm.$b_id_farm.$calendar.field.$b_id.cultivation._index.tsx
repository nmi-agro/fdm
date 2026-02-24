import { getCultivations } from "@nmi-agro/fdm-core"
import { data, type LoaderFunctionArgs, redirect } from "react-router"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the farm id
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        // Get the field id
        const b_id = params.b_id
        if (!b_id) {
            throw data("Field ID is required", {
                status: 400,
                statusText: "Field ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get timeframe from calendar store
        const timeframe = getTimeframe(params)

        // Get cultivations for the field
        const cultivations = await getCultivations(
            fdm,
            session.principal_id,
            b_id,
            timeframe,
        )

        // Redirect to overview page if we have cultivations
        if (cultivations.length > 0) {
            return redirect(`./${cultivations[0].b_lu}`)
        }

        return null
    } catch (error) {
        return handleLoaderError(error)
    }
}

export default function CultivationIndex() {
    return null
}
