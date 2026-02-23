import {
    type CultivationCatalogue,
    checkPermission,
    getCultivation,
    getCultivationsFromCatalogue,
    getField,
    getHarvests,
    getParametersForHarvestCat,
    removeCultivation,
    updateCultivation,
} from "@nmi-agro/fdm-core"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    Outlet,
    useLoaderData,
} from "react-router"
import {
    dataWithError,
    dataWithSuccess,
    redirectWithSuccess,
} from "remix-toast"
import { CultivationDetailsCard } from "~/components/blocks/cultivation/card-details"
import { CultivationHarvestsCard } from "~/components/blocks/cultivation/card-harvests"
import { CultivationDetailsFormSchema } from "~/components/blocks/cultivation/schema"
import type { HarvestableType } from "~/components/blocks/harvest/types"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
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
            content: "Bekijk en bewerk de gegevens van je gewas.",
        },
    ]
}

/**
 * Loads and prepares data for the farm fields overview page.
 *
 * This loader function validates the presence of required farm, field, and cultivation IDs from the request parameters.
 * It retrieves the user session and fetches details of the specified field and cultivation, along with available
 * cultivation options and associated harvest records. It also determines the harvestable type based on the cultivation
 * catalogue.
 *
 * @returns An object containing:
 *   - field: The details of the specified field.
 *   - cultivationsCatalogueOptions: Mapped options for cultivation selection.
 *   - cultivation: The data of the specified cultivation.
 *   - harvests: The list of harvests related to the cultivation.
 *   - b_lu_harvestable: The harvestable type from the catalogue, or "none" if not applicable.
 *   - b_id_farm: The farm ID.
 *   - cultivationWritePermission: A Boolean indicating if the user is able to edit or delete the cultivation or add harvests to it. Set to true if the information could not be obtained.
 *
 * @throws {Response} If the farm, field, or cultivation ID is missing (status 400) or if the field or cultivation cannot be found (status 404).
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

        // Get the cultivation id
        const b_lu = params.b_lu
        if (!b_lu) {
            throw data("Cultivation ID is required", {
                status: 400,
                statusText: "Cultivation ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get timeframe from calendar store
        const timeframe = getTimeframe(params)
        const calendar = getCalendar(params)

        const cultivationWritePermission = checkPermission(
            fdm,
            "cultivation",
            "write",
            b_lu,
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
        let b_lu_variety_options: { value: string; label: string }[] = []
        let b_lu_harvestable: HarvestableType = "none"

        const cultivationsCatalogue: CultivationCatalogue[] =
            await getCultivationsFromCatalogue(
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

        // Get cultivation
        const cultivation = await getCultivation(
            fdm,
            session.principal_id,
            b_lu,
        )
        if (!cultivation) {
            throw data("Cultivation is not found", { status: 404 })
        }

        // Get harvests
        const harvests = await getHarvests(
            fdm,
            session.principal_id,
            b_lu,
            timeframe,
        )

        const cultivationCatalogueItem: CultivationCatalogue | undefined =
            cultivationsCatalogue.find((item) => {
                return item.b_lu_catalogue === cultivation.b_lu_catalogue
            })
        if (cultivationCatalogueItem) {
            b_lu_harvestable = cultivationCatalogueItem.b_lu_harvestable
            if (cultivationCatalogueItem.b_lu_variety_options) {
                b_lu_variety_options =
                    cultivationCatalogueItem.b_lu_variety_options.map(
                        (option: string) => ({
                            value: option,
                            label: option,
                        }),
                    )
            }
        }

        const harvestParameters = getParametersForHarvestCat(
            cultivation.b_lu_harvestcat,
        )

        // Return user information from loader
        return {
            field: field,
            cultivationsCatalogueOptions: cultivationsCatalogueOptions,
            cultivation: cultivation,
            harvests: harvests,
            b_lu_harvestable: b_lu_harvestable,
            harvestParameters: harvestParameters,
            b_lu_variety_options: b_lu_variety_options,
            b_id_farm: b_id_farm,
            calendar: calendar,
            cultivationWritePermission: await cultivationWritePermission,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the overview block for a farm field cultivation.
 *
 * This component displays the cultivation's name along with a prompt to enter harvest data, provides a navigation button to return to the cultivation list, and incorporates a form for updating cultivation details. It also shows a list of harvest entries along with their current status, sourcing its data from the loader via React Router hooks.
 */
export default function FarmFieldsOverviewBlock() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <div className="space-y-6">
            <CultivationDetailsCard
                cultivation={loaderData.cultivation}
                harvests={loaderData.harvests}
                b_lu_harvestable={loaderData.b_lu_harvestable}
                b_lu_variety_options={loaderData.b_lu_variety_options}
                editable={loaderData.cultivationWritePermission}
            />
            <CultivationHarvestsCard
                harvests={loaderData.harvests}
                b_lu_harvestable={loaderData.b_lu_harvestable}
                harvestParameters={loaderData.harvestParameters}
                editable={loaderData.cultivationWritePermission}
            />
            <Outlet />
        </div>
    )
}

/**
 * Processes form submissions to update cultivation data or delete a harvest.
 *
 * For POST requests, it extracts cultivation details from the submitted form and updates the corresponding record.
 * For DELETE requests, it removes a harvest identified by a provided ID.
 * The function validates the presence of required URL parameters and uses the authenticated user's session
 * to ensure authorized operations. It returns a response object indicating the outcome of the action.
 *
 * @returns A response object with either success data and a message or an error message if validations fail.
 * @throws {Error} When an unexpected error occurs during processing, after being handled by {@link handleActionError}.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    try {
        // Get the field ID
        const b_id = params.b_id
        if (!b_id) {
            return dataWithError(null, "Missing field ID.")
        }

        // Get the cultivation ID
        const b_lu = params.b_lu
        if (!b_lu) {
            return dataWithError(null, "Missing b_lu value.")
        }

        // Get the session
        const session = await getSession(request)

        if (request.method === "POST") {
            // Collect form entry
            const formValues = await extractFormValuesFromRequest(
                request,
                CultivationDetailsFormSchema,
            )
            const { b_lu_start, b_lu_end, m_cropresidue, b_lu_variety } =
                formValues

            await updateCultivation(
                fdm,
                session.principal_id,
                b_lu,
                undefined,
                b_lu_start,
                b_lu_end,
                m_cropresidue,
                b_lu_variety,
            )

            return dataWithSuccess(
                { result: "Cultivation updated successfully" },
                { message: "Gewas is bijgewerkt! 🎉" },
            )
        }

        if (request.method === "DELETE") {
            await removeCultivation(fdm, session.principal_id, b_lu)
            return redirectWithSuccess(
                `/farm/${params.b_id_farm}/${params.calendar}/field/${b_id}/cultivation`,
                { message: "Gewas is verwijderd" },
            )
        }
    } catch (error) {
        throw handleActionError(error)
    }
}
