import { getField } from "@nmi-agro/fdm-core"
import { ArrowLeft } from "lucide-react"
import { data, type LoaderFunctionArgs, NavLink } from "react-router"
import { SoilAnalysisFormSelection } from "~/components/blocks/soil/form-selection"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

/**
 * Loader function for the soil analysis selection page.
 *
 * Fetches the field details to ensure the field exists and is accessible.
 *
 * @param request - The HTTP request object.
 * @param params - The route parameters containing `b_id_farm` and `b_id`.
 * @returns An object containing the field details.
 * @throws {Response} If the farm ID or field ID is missing, or if the field is not found.
 */
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

        // Get details of field
        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) {
            throw data("Field is not found", {
                status: 404,
                statusText: "Field is not found",
            })
        }

        // Return user information from loader
        return {
            field: field,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the soil analysis form selection component.
 *
 * This component allows the user to choose the type of soil analysis form to fill.
 */
export default function FarmFieldSoilOverviewBlock() {
    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-medium">Bodem</h3>
                    <p className="text-sm text-muted-foreground">
                        Kies het type bodemanalyse voor uw formulier
                    </p>
                </div>
                <Button asChild>
                    <NavLink to="../soil">
                        <ArrowLeft />
                        Terug
                    </NavLink>
                </Button>
            </div>
            <Separator />
            <SoilAnalysisFormSelection />
        </div>
    )
}
