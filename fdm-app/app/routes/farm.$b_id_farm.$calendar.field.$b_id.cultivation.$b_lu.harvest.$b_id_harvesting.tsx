import {
    checkPermission,
    getCultivation,
    getHarvest,
    getParametersForHarvestCat,
    removeHarvest,
    updateHarvest,
} from "@nmi-agro/fdm-core"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { dataWithWarning, redirectWithSuccess } from "remix-toast"
import { HarvestFormDialog } from "~/components/blocks/harvest/form"
import { FormSchema } from "~/components/blocks/harvest/schema"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { getHarvestParameterLabel } from "../components/blocks/harvest/parameters"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Oogst - Gewas - Perceel | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk en bewerk de oogst van je gewas.",
        },
    ]
}

/**
 * Retrieves cultivation and harvest data based on provided URL parameters.
 *
 * This function extracts the farm, field, cultivation, and harvest identifiers from the URL parameters,
 * validates their presence, obtains the user session, and then fetches the corresponding cultivation details
 * and associated harvest data. The returned object is used to render the harvest overview.
 *
 * @returns An object containing the cultivation details, the associated harvest data, and the farm ID.
 *
 * @throws {Response} If any required URL parameter is missing or if the specified cultivation is not found.
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

        // Get cultivation id
        const b_lu = params.b_lu
        if (!b_lu) {
            throw data("Cultivation ID is required", {
                status: 400,
                statusText: "Cultivation ID is required",
            })
        }

        // Get the harvest id
        const b_id_harvesting = params.b_id_harvesting
        if (!b_id_harvesting) {
            throw data("Harvest ID is required", {
                status: 400,
                statusText: "Harvest ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)
        const calendar = getCalendar(params)

        const harvestingWritePermission = checkPermission(
            fdm,
            "harvesting",
            "write",
            b_id_harvesting,
            session.principal_id,
            new URL(request.url).pathname,
            false,
        )

        // Get details of cultivation
        const cultivation = await getCultivation(
            fdm,
            session.principal_id,
            b_lu,
        )
        if (!cultivation) {
            throw data("Cultivation is not found", {
                status: 404,
                statusText: "Cultivation is not found",
            })
        }

        // Get selected harvest
        const harvest = await getHarvest(
            fdm,
            session.principal_id,
            b_id_harvesting,
        )
        const harvestableAnalysis = harvest.harvestable.harvestable_analyses[0]

        const harvestParameters = getParametersForHarvestCat(
            cultivation.b_lu_harvestcat,
        )

        // Return user information from loader
        return {
            cultivation: cultivation,
            harvest: harvest,
            harvestableAnalysis: harvestableAnalysis,
            b_id_farm: b_id_farm,
            calendar: calendar,
            harvestParameters: harvestParameters,
            harvestingWritePermission: await harvestingWritePermission,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders a block displaying cultivation details and a harvest input form.
 *
 * This component uses data loaded by the router to show the name of the cultivation and an instruction
 * for entering harvest information. It also provides a navigation link back to the cultivation details page
 * and renders a HarvestForm component prefilled with available harvest analytics data when present.
 *
 * @returns The JSX element representing the harvest overview block.
 */
export default function FarmFieldsOverviewBlock() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <HarvestFormDialog
            harvestParameters={loaderData.harvestParameters}
            b_lu_harvest_date={loaderData.harvest.b_lu_harvest_date}
            b_lu_yield={loaderData.harvestableAnalysis.b_lu_yield}
            b_lu_yield_fresh={loaderData.harvestableAnalysis.b_lu_yield_fresh}
            b_lu_yield_bruto={loaderData.harvestableAnalysis.b_lu_yield_bruto}
            b_lu_tarra={loaderData.harvestableAnalysis.b_lu_tarra}
            b_lu_uww={loaderData.harvestableAnalysis.b_lu_uww}
            b_lu_moist={loaderData.harvestableAnalysis.b_lu_moist}
            b_lu_dm={loaderData.harvestableAnalysis.b_lu_dm}
            b_lu_cp={loaderData.harvestableAnalysis.b_lu_cp}
            b_lu_n_harvestable={
                loaderData.harvestableAnalysis.b_lu_n_harvestable
            }
            b_lu_harvestable={loaderData.cultivation.b_lu_harvestable}
            b_lu_start={loaderData.cultivation.b_lu_start}
            b_lu_end={loaderData.cultivation.b_lu_end}
            editable={loaderData.harvestingWritePermission}
        />
    )
}

/**
 * Handles form submissions to add a new harvest entry.
 *
 * This function validates the presence of required route parameters (farm ID, field ID, and cultivation ID), retrieves the user session, and extracts harvest details from the submitted form based on a predefined schema. If all validations pass, it adds the new harvest and redirects to the cultivation overview with a success message.
 *
 * @throws {Error} When any required parameter is missing or if an error occurs during form processing.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    try {
        // Get the farm ID
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw new Error("missing: b_id_farm")
        }

        // Get the field ID
        const b_id = params.b_id
        if (!b_id) {
            throw new Error("missing: b_id")
        }

        // Get cultivation id
        const b_lu = params.b_lu
        if (!b_lu) {
            throw new Error("missing: b_lu")
        }

        // Get the session
        const session = await getSession(request)
        const calendar = await getCalendar(params)

        // Get the action from the form
        if (request.method === "POST") {
            const b_id_harvesting = params.b_id_harvesting
            if (!b_id_harvesting) {
                throw new Error("missing: b_id_harvesting")
            }

            // Fetch cultivation details to get b_lu_harvestcat
            const cultivation = await getCultivation(
                fdm,
                session.principal_id,
                b_lu,
            )
            if (!cultivation) {
                throw data("Cultivation not found", { status: 404 })
            }

            // First, validate against the full FormSchema
            const formValues = await extractFormValuesFromRequest(
                request,
                FormSchema,
            )
            if (!formValues.b_lu_harvest_date) {
                const errors = [
                    {
                        path: "b_lu_harvest_date",
                        message: "Selecteer een oogstdatum",
                    },
                ]

                throw new Error(JSON.stringify(errors))
            }

            // Get required harvest parameters for the cultivation's harvest category
            const requiredHarvestParameters = getParametersForHarvestCat(
                cultivation.b_lu_harvestcat,
            )

            // Check if all required parameters are present
            const missingParameters: string[] = []
            for (const param of requiredHarvestParameters) {
                if (
                    (formValues as Record<string, any>)[param] === undefined ||
                    (formValues as Record<string, any>)[param] === null
                ) {
                    missingParameters.push(param)
                }
            }
            const missingParameterLabels = missingParameters.map((param) => {
                return getHarvestParameterLabel(param)
            })

            if (missingParameters.length > 0) {
                return dataWithWarning(
                    {
                        warning: `Missing required harvest parameters: ${missingParameters.join(
                            ", ",
                        )}`,
                    },
                    `Voor de volgende parameters ontbreekt een waarde: ${missingParameterLabels.join(
                        ", ",
                    )}`,
                )
            }

            // Filter form values to include only required parameters for updateHarvest
            const harvestProperties: Record<string, any> = {}
            for (const param of requiredHarvestParameters) {
                if ((formValues as Record<string, any>)[param] !== undefined) {
                    harvestProperties[param] = (
                        formValues as Record<string, any>
                    )[param]
                }
            }

            await updateHarvest(
                fdm,
                session.principal_id,
                b_id_harvesting,
                formValues.b_lu_harvest_date,
                harvestProperties,
            )

            return redirectWithSuccess(
                `/farm/${b_id_farm}/${calendar}/field/${b_id}/cultivation/${b_lu}`,
                {
                    message: "Oogst is gewijzigd! 🎉",
                },
            )
        }
        if (request.method === "DELETE") {
            const b_id_harvesting = params.b_id_harvesting
            if (!b_id_harvesting) {
                throw new Error("missing: b_id_harvesting")
            }
            await removeHarvest(fdm, session.principal_id, b_id_harvesting)
            return redirectWithSuccess(
                `/farm/${b_id_farm}/${calendar}/field/${b_id}/cultivation/${b_lu}`,
                {
                    message: "Oogst is verwijderd! 🎉",
                },
            )
        }
    } catch (error) {
        throw handleActionError(error)
    }
}
