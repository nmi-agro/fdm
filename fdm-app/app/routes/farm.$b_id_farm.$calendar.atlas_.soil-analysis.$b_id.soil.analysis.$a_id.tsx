import {
    getField,
    getSoilAnalysis,
    getSoilParametersDescription,
} from "@nmi-agro/fdm-core"
import { ArrowLeft } from "lucide-react"
import {
    data,
    type LoaderFunctionArgs,
    NavLink,
    useLoaderData,
} from "react-router"
import { SoilAnalysisForm } from "~/components/blocks/soil/form"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

/**
 * Loader function for the soil data page of a specific farm field.
 *
 * This function fetches the necessary data for rendering the soil data page, including
 * field details, soil analyses, current soil data, and soil parameter descriptions.
 * It validates the presence of the farm ID (`b_id_farm`) and field ID (`b_id`) in the
 * route parameters and retrieves the user session.
 *
 * @param request - The HTTP request object.
 * @param params - The route parameters, including `b_id_farm` and `b_id`.
 * @returns An object containing the calendar, field details, soil parameter descriptions, and soil analyses.
 *
 * @throws {Response} If the farm ID is missing (HTTP 400).
 * @throws {Error} If the field ID is missing (HTTP 400).
 * @throws {Error} If the field is not found (HTTP 404).
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the calendar
        const calendar = getCalendar(params)

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

        // Get the analysis id
        const a_id = params.a_id
        if (!a_id) {
            throw data("Analysis ID is required", {
                status: 400,
                statusText: "Analysis ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get details of field
        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) {
            throw data("Field is not found", {
                status: 404,
                statusText: "Field is not found",
            })
        }

        // Get the soil analyses
        const soilAnalysis = await getSoilAnalysis(
            fdm,
            session.principal_id,
            a_id,
        )

        if (!soilAnalysis) {
            throw data("Soil analysis not found", {
                status: 404,
                statusText: "Soil analysis not found",
            })
        }

        // Get soil parameter descriptions and filter on the available soil parameters
        const soilParameterDescription = getSoilParametersDescription().filter(
            (item) =>
                typeof soilAnalysis[item.parameter] !== "undefined" &&
                soilAnalysis[item.parameter] !== null,
        )

        // Return user information from loader
        return {
            calendar: calendar,
            field: field,
            soilParameterDescription: soilParameterDescription,
            soilAnalysis: soilAnalysis,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Component that renders the soil analysis form.
 *
 * This component displays the soil analysis form
 *
 */
export default function FarmFieldSoilOverviewBlock() {
    const loaderData = useLoaderData<typeof loader>()
    const field = loaderData.field

    return (
        <div className="p-6 space-y-6">
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-medium">Bodem</h3>
                    <p className="text-sm text-muted-foreground">
                        Bekijk de gegevens van deze bodemanalyse
                    </p>
                </div>
                <Button asChild>
                    <NavLink
                        to={`/farm/${field.b_id_farm}/${loaderData.calendar}/atlas/soil-analysis/${field.b_id}/soil`}
                    >
                        <ArrowLeft />
                        Terug
                    </NavLink>
                </Button>
            </div>
            <Separator />
            <SoilAnalysisForm
                soilAnalysis={loaderData.soilAnalysis}
                soilParameterDescription={loaderData.soilParameterDescription}
                action="."
                editable={false}
            />
        </div>
    )
}
