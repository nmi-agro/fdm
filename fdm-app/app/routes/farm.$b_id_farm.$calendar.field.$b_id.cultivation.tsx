import {
    addCultivation,
    checkPermission,
    getCultivations,
    getCultivationsFromCatalogue,
    getField,
    getHarvests,
    removeCultivation,
} from "@nmi-agro/fdm-core"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    Outlet,
    useLoaderData,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import { CultivationListCard } from "~/components/blocks/cultivation/card-list"
import { CultivationAddFormSchema } from "~/components/blocks/cultivation/schema"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Gewas - Perceel | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk en bewerk de gewassen van je perceel.",
        },
    ]
}

/**
 * Loads data required for rendering the overview of a specific farm field.
 *
 * This function extracts the farm and field identifiers from the URL parameters and validates their presence.
 * It retrieves the user session to authorize data access, then fetches the field details, a catalogue of available
 * cultivations (formatted as combobox options), the list of cultivations for the field, and the corresponding harvests.
 *
 * @param args - An object containing the HTTP request and URL parameters. The route parameters must include "b_id_farm" (farm identifier) and "b_id" (field identifier).
 * @returns An object containing:
 *   - field: The details of the specified field.
 *   - cultivationsCatalogueOptions: A list of catalogue options for cultivations, formatted for use in a combobox.
 *   - cultivations: The list of cultivations associated with the field.
 *   - harvests: The harvest data for the first collection of cultivation harvests, or an empty array if none are available.
 *   - fieldWritePermissions: A Boolean indicating if the user is able to add cultivations to the field. Set to true if the information could not be obtained.
 *
 * @throws {Response} When the "b_id_farm" or "b_id" parameters are missing or if the field is not found.
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

        // Get timeframe from calendar store
        const timeframe = getTimeframe(params)

        const fieldWritePermission = await checkPermission(
            fdm,
            "field",
            "write",
            b_id,
            session.principal_id,
            new URL(request.url).pathname,
            false,
        )

        // Get details of field
        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) {
            throw data("Field is not found", {
                status: 404,
                statusText: "Field is not found",
            })
        }

        // Get available cultivations for the farm
        const cultivationsCatalogue = await getCultivationsFromCatalogue(
            fdm,
            session.principal_id,
            b_id_farm,
        )
        // Map cultivations to options for the combobox
        const cultivationsCatalogueOptions = cultivationsCatalogue.map(
            (cultivation) => {
                return {
                    value: cultivation.b_lu_catalogue,
                    label: cultivation.b_lu_name,
                }
            },
        )

        // Get cultivations for the field
        const cultivations = await getCultivations(
            fdm,
            session.principal_id,
            b_id,
            timeframe,
        )

        // Get the harvests of the cultivations
        const harvests = (
            await Promise.all(
                cultivations.map(async (cultivation) => {
                    return await getHarvests(
                        fdm,
                        session.principal_id,
                        cultivation.b_lu,
                        timeframe,
                    )
                }),
            )
        ).flat()

        // Return user information from loader
        return {
            field: field,
            cultivationsCatalogueOptions: cultivationsCatalogueOptions,
            cultivations: cultivations,
            harvests: harvests,
            fieldWritePermission: fieldWritePermission,
        }
    } catch (error) {
        return handleLoaderError(error)
    }
}

/**
 * Renders the overview block for farm fields.
 *
 * This component displays a UI section for managing cultivations in a farm field. It renders a header with a description,
 * a form for adding new cultivations (populated with catalogue options from loader data), and a list of existing cultivations
 * along with their associated harvests. The form's action is determined by the current URL.
 */
export default function FarmFieldsOverviewBlock() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <div className="space-y-6">
            <div className="grid 2xl:grid-cols-2 gap-4">
                <CultivationListCard
                    cultivationsCatalogueOptions={
                        loaderData.cultivationsCatalogueOptions
                    }
                    cultivations={loaderData.cultivations}
                    harvests={loaderData.harvests}
                    editable={loaderData.fieldWritePermission}
                />
                <Outlet />
            </div>
        </div>
    )
}

/**
 * Handles form submissions to add or remove a cultivation.
 *
 * For POST requests, the function extracts cultivation data from the request,
 * and adds a new cultivation to the specified field using the current user session.
 * For DELETE requests, it removes an existing cultivation based on the cultivation ID
 * provided in the form data.
 *
 * Throws an error if the field identifier (b_id) is missing from the URL parameters,
 * or if, in a DELETE request, the cultivation identifier (b_lu) is missing or invalid.
 *
 * @returns A response object containing a success message.
 *
 * @throws {Error} When the field identifier is absent, or when the cultivation identifier is missing or invalid.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    try {
        // Get the field ID
        const b_id = params.b_id
        if (!b_id) {
            throw new Error("missing: b_id")
        }

        // Get the session
        const session = await getSession(request)

        if (request.method === "POST") {
            // Collect form entry
            const formValues = await extractFormValuesFromRequest(
                request,
                CultivationAddFormSchema,
            )
            const { b_lu_catalogue, b_lu_start, b_lu_end } = formValues

            await addCultivation(
                fdm,
                session.principal_id,
                b_lu_catalogue,
                b_id,
                b_lu_start,
                b_lu_end,
            )

            return dataWithSuccess(
                { result: "Data saved successfully" },
                { message: "Gewas is toegevoegd! 🎉" },
            )
        }
        if (request.method === "DELETE") {
            const formData = await request.formData()
            const b_lu = formData.get("b_lu")

            if (!b_lu) {
                throw new Error("missing: b_lu")
            }
            if (typeof b_lu !== "string") {
                throw new Error("invalid: b_lu")
            }

            await removeCultivation(fdm, session.principal_id, b_lu)

            return dataWithSuccess("Date deleted successfully", {
                message: "Gewas is verwijderd",
            })
        }
    } catch (error) {
        throw handleActionError(error)
    }
}
