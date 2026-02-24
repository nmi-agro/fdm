import { getFarm, isAllowedToDeleteFarm, removeFarm } from "@nmi-agro/fdm-core"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
    useNavigation,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { FarmDeleteDialog } from "~/components/blocks/farm/delete"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Verwijderen - Instellingen - Bedrijf | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Verwijder de gegevens van je bedrijf.",
        },
    ]
}

/**
 * Loads farm details using the farm ID from route parameters.
 *
 * This function validates that the farm ID is provided. It then retrieves the current session to obtain the
 * user's principal ID and uses this information to fetch the corresponding farm details. If the farm ID is missing or if the
 * farm is not found, it throws an error with the appropriate HTTP status code. Errors encountered during processing are handled
 * by a centralized error handler.
 *
 * @throws {Response} When the farm ID is missing, or if the farm is not found.
 *
 * @returns An object containing the farm details.
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

        // Get the session
        const session = await getSession(request)

        // Get details of farm
        const farm = await getFarm(fdm, session.principal_id, b_id_farm)
        if (!farm) {
            throw data("Farm is not found", {
                status: 404,
                statusText: "Farm is not found",
            })
        }

        // Check if user is allowed to delete farm
        let canDeleteFarm = await isAllowedToDeleteFarm(
            fdm,
            session.principal_id,
            b_id_farm,
        )
        // Add temporary workaround (until implemented in fdm-core) so that advisors are not able to delete a farm
        if (
            canDeleteFarm &&
            farm.roles.find((role) => role.role === "advisor")
        ) {
            canDeleteFarm = false
        }

        // Return farm information from loader
        return {
            farm: farm,
            canDeleteFarm: canDeleteFarm,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FarmSettingsDeleteBlock() {
    const { farm, canDeleteFarm } = useLoaderData<typeof loader>()

    const navigation = useNavigation()
    const isSubmitting =
        navigation.state === "submitting" &&
        navigation.formMethod?.toLowerCase() === "delete"
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Verwijderen</h3>
                <p className="text-sm text-muted-foreground">
                    {canDeleteFarm
                        ? "Verwijder de gegevens van je bedrijf."
                        : "Helaas, je hebt geen rechten om dit bedrijf te kunnen verwijderen."}
                </p>
            </div>
            <Separator />
            {canDeleteFarm ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Permanent verwijderen</CardTitle>
                        <CardDescription>
                            Deze actie kan niet ongedaan worden gemaakt. Dit
                            verwijdert het bedrijf "{farm.b_name_farm}" en alle
                            bijbehorende gegevens, inclusief percelen, gewassen,
                            bemestingen, bodemanalyses en oogsten.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FarmDeleteDialog
                            farmName={farm.b_name_farm || ""}
                            isSubmitting={isSubmitting}
                        />
                    </CardContent>
                </Card>
            ) : null}
        </div>
    )
}

/**
 * Handles the deletion of a farm.
 *
 * This action function retrieves the farm ID from the request parameters,
 * validates its presence, and then calls the `removeFarm` function from `@nmi-agro/fdm-core`
 * to delete the specified farm and all its associated data.
 *
 * Upon successful deletion, the user is redirected to the farm overview page.
 * Errors during the process are caught and handled by `handleLoaderError`.
 *
 * @param {ActionFunctionArgs} { request, params } - The Remix action function arguments.
 * @returns {Promise<Response>} A promise that resolves to a redirect response or throws an error.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    try {
        // Get the farm id
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Server-side permission check (mirror loader logic)
        const farm = await getFarm(fdm, session.principal_id, b_id_farm)
        let canDeleteFarm = await isAllowedToDeleteFarm(
            fdm,
            session.principal_id,
            b_id_farm,
        )
        // Temporary workaround: advisors may not delete farms
        if (
            canDeleteFarm &&
            farm.roles.find((role) => role.role === "advisor")
        ) {
            canDeleteFarm = false
        }
        if (!canDeleteFarm) {
            throw data("Forbidden", { status: 403, statusText: "Forbidden" })
        }

        // Remove the farm
        await removeFarm(fdm, session.principal_id, b_id_farm)

        // Redirect to the farm overview page after successful deletion
        return redirectWithSuccess("/farm", "Bedrijf is verwijderd")
    } catch (error) {
        throw handleLoaderError(error)
    }
}
