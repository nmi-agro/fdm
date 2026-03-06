import { data, type LoaderFunctionArgs, redirect } from "react-router-dom"
import { getCalendar } from "~/lib/calendar"
import { handleLoaderError } from "~/lib/error"

export function loader({ params, request }: LoaderFunctionArgs) {
    try {
        // Get the Id of the farm
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        const calendar = getCalendar(params)
        const url = new URL(request.url)

        // Obtain the fieldIds
        // Redirect to one of them if not viewing a field currently.
        const b_id = params.b_id
        let fieldIds: string[] = b_id ? [b_id] : []
        const fieldIdsParam = url.searchParams.get("fieldIds")
        if (fieldIdsParam && fieldIdsParam.length > 0)
            fieldIds = fieldIdsParam
                .split(",")
                .filter((fieldId) => fieldId.length)
        if (!b_id) {
            if (fieldIds.length === 0) {
                // Redirect to the fields table if no field can be shown at all.
                return redirect(`/farm/${b_id_farm}/${calendar}/field`)
            }
        }
        return redirect(
            `/farm/${b_id_farm}/${calendar}/field/new/fields/${fieldIds[0]}${url.search}`,
        )
    } catch (e) {
        throw handleLoaderError(e)
    }
}
