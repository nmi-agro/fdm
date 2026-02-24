import {
    checkPermission,
    getCultivation,
    getCultivationsFromCatalogue,
    getDefaultsForHarvestParameters,
    getHarvest,
    getParametersForHarvestCat,
    type HarvestableAnalysis,
    removeHarvest,
    updateHarvest,
} from "@nmi-agro/fdm-core"
import { data, useLoaderData } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { HarvestFormDialog } from "~/components/blocks/harvest/form"
import { getHarvestParameterLabel } from "~/components/blocks/harvest/parameters"
import { FormSchema } from "~/components/blocks/harvest/schema"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.rotation.modify_harvest"
// Meta
export const meta: Route.MetaFunction = () => {
    return [
        { title: `Oogst - Gewas - Perceel | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk en bewerk de oogst van je gewas.",
        },
    ]
}

async function getModifiableHarvestingIds(
    url: URL,
    principal_id: string,
    allHarvestingIds: string[],
) {
    const harvestingWritePermissions = await Promise.all(
        allHarvestingIds.map((id) =>
            checkPermission(
                fdm,
                "harvesting",
                "write",
                id,
                principal_id,
                url.pathname,
                false,
            ),
        ),
    )
    return allHarvestingIds.filter((_, i) => harvestingWritePermissions[i])
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
export async function loader({ request, params }: Route.LoaderArgs) {
    try {
        const url = new URL(request.url)
        // Get the farm id
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        const b_id_harvesting = url.searchParams.get("harvestingIds")
        const allHarvestingIds = b_id_harvesting
            ?.split(",")
            .filter((id) => id.length)
        if (!allHarvestingIds || allHarvestingIds.length === 0) {
            throw data("Harvesting IDs are required", {
                status: 400,
                statusText: "Harvesting IDs are required",
            })
        }

        // Get the session
        const session = await getSession(request)

        const modifiableHarvestingIds = await getModifiableHarvestingIds(
            url,
            session.principal_id,
            allHarvestingIds,
        )
        const harvestingIds = modifiableHarvestingIds.length
            ? modifiableHarvestingIds
            : allHarvestingIds
        // Get selected harvest
        const harvests = await Promise.all(
            harvestingIds.map((b_id_harvesting) =>
                getHarvest(fdm, session.principal_id, b_id_harvesting),
            ),
        )

        // Get details of cultivation
        // TODO: harvests for different catalogue cultivations might be passed
        const cultivation = await getCultivation(
            fdm,
            session.principal_id,
            harvests[0].b_lu,
        )
        if (!cultivation) {
            throw data("Cultivation is not found", {
                status: 404,
                statusText: "Cultivation is not found",
            })
        }

        let exampleHarvestableAnalysis:
            | Partial<HarvestableAnalysis>
            | undefined = harvests.find(
            (harvest) => harvest.harvestable.harvestable_analyses.length,
        )?.harvestable.harvestable_analyses[0]

        if (!exampleHarvestableAnalysis) {
            exampleHarvestableAnalysis = getDefaultsForHarvestParameters(
                cultivation.b_lu_catalogue,
                await getCultivationsFromCatalogue(
                    fdm,
                    session.principal_id,
                    b_id_farm,
                ),
            )
        }

        const harvestParameters = getParametersForHarvestCat(
            cultivation.b_lu_harvestcat,
        )

        // Figure out the harvest date that is the same between all harvests
        let b_lu_harvest_date = harvests[0].b_lu_harvest_date
        if (
            harvests.find(
                (harvest) =>
                    harvest?.b_lu_harvest_date?.getTime() !==
                    b_lu_harvest_date?.getTime(),
            )
        ) {
            b_lu_harvest_date = null
        }

        // Figure out harvest parameters that are the same between all these harvestings
        let initialHarvestableAnalysis: Partial<HarvestableAnalysis> = {}

        if (
            !harvests.find(
                (harvest) =>
                    harvest.harvestable.harvestable_analyses.length === 0,
            ) &&
            Object.keys(exampleHarvestableAnalysis).length > 0
        ) {
            initialHarvestableAnalysis = {
                ...exampleHarvestableAnalysis,
            }

            for (const harvesting of harvests) {
                const analysis = harvesting.harvestable.harvestable_analyses[0]
                for (const key of Object.keys(
                    initialHarvestableAnalysis,
                ) as (keyof HarvestableAnalysis)[]) {
                    if (analysis[key] !== initialHarvestableAnalysis[key]) {
                        delete initialHarvestableAnalysis[key]
                    }
                }
            }
        }

        // Return user information from loader
        return {
            cultivation: cultivation,
            b_lu_harvest_date: b_lu_harvest_date,
            example_b_lu_harvest_date: harvests[0].b_lu_harvest_date,
            exampleHarvestableAnalysis: exampleHarvestableAnalysis,
            initialHarvestableAnalysis: initialHarvestableAnalysis,
            harvestParameters: harvestParameters,
            harvestingWritePermission: modifiableHarvestingIds.length > 0,
            partial: modifiableHarvestingIds.length > 1,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders a dialog that lets the user edit one or multiple harvestings.
 *
 * This component uses data from the loader to pre-fill the form with the existing harvest information
 * and a harvestable analysis, the latter being either one that already exists or just the defaults for
 * the cultivation catalogue type. If the user can edit one of the harvestings whose ID is provided,
 * the user can submit the form to modify all of the harvestings whose ID is provided, at the same time.
 *
 * @returns The JSX element representing the harvesting editing dialog.
 */
export default function ModifyHarvestingDialog() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <HarvestFormDialog
            harvestParameters={loaderData.harvestParameters}
            exampleHarvestableAnalysis={loaderData.exampleHarvestableAnalysis}
            example_b_lu_harvest_date={loaderData.example_b_lu_harvest_date}
            b_lu_harvest_date={loaderData.b_lu_harvest_date}
            b_lu_yield={loaderData.initialHarvestableAnalysis.b_lu_yield}
            b_lu_yield_fresh={
                loaderData.initialHarvestableAnalysis.b_lu_yield_fresh
            }
            b_lu_yield_bruto={
                loaderData.initialHarvestableAnalysis.b_lu_yield_bruto
            }
            b_lu_tarra={loaderData.initialHarvestableAnalysis.b_lu_tarra}
            b_lu_uww={loaderData.initialHarvestableAnalysis.b_lu_uww}
            b_lu_moist={loaderData.initialHarvestableAnalysis.b_lu_moist}
            b_lu_dm={loaderData.initialHarvestableAnalysis.b_lu_dm}
            b_lu_cp={loaderData.initialHarvestableAnalysis.b_lu_cp}
            b_lu_n_harvestable={
                loaderData.initialHarvestableAnalysis.b_lu_n_harvestable
            }
            b_lu_harvestable={loaderData.cultivation.b_lu_harvestable}
            b_lu_start={loaderData.cultivation.b_lu_start}
            b_lu_end={loaderData.cultivation.b_lu_end}
            editable={loaderData.harvestingWritePermission}
        />
    )
}

/**
 * Handles form submissions to modify multiple specified harvest entries.
 *
 * This function validates the presence of required route parameters (farm ID, field ID, and cultivation ID), retrieves the user session, and extracts harvest details from the submitted form based on a predefined schema. If all validations pass, it modifies the harvests whose ids are passed in the harvestIds search parameter, and redirects to the cultivation overview with a success message.
 *
 * @throws {Error} When any required parameter is missing or if an error occurs during form processing.
 */
export async function action({ request, params }: Route.ActionArgs) {
    try {
        const url = new URL(request.url)
        // Get the farm ID
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw new Error("missing: b_id_farm")
        }

        // Get the session
        const session = await getSession(request)

        const b_id_harvesting = url.searchParams.get("harvestingIds")
        const allHarvestingIds = b_id_harvesting
            ?.split(",")
            .filter((id) => id.length)
        if (!allHarvestingIds || allHarvestingIds.length === 0) {
            throw data("Harvesting IDs are required", {
                status: 400,
                statusText: "Harvesting IDs are required",
            })
        }

        const harvestingIds = await getModifiableHarvestingIds(
            url,
            session.principal_id,
            allHarvestingIds,
        )
        if (harvestingIds.length === 0) {
            throw data("Het is u niet toegestaan de oogsten te beheren.", {
                status: 403,
                statusText: "Het is u niet toegestaan de oogsten te beheren.",
            })
        }
        // Get the action from the form
        if (request.method === "POST") {
            const firstHarvest = await getHarvest(
                fdm,
                session.principal_id,
                harvestingIds[0],
            )
            // Fetch cultivation details to get b_lu_harvestcat
            const cultivation = await getCultivation(
                fdm,
                session.principal_id,
                firstHarvest.b_lu,
            )
            if (!cultivation) {
                throw data("Cultivation not found", { status: 404 })
            }

            // First, validate against the full FormSchema
            const partialFormValues = await extractFormValuesFromRequest(
                request,
                FormSchema,
            )

            // Get required harvest parameters for the cultivation's harvest category
            const requiredHarvestParameters = getParametersForHarvestCat(
                cultivation.b_lu_harvestcat,
            )

            // Filter form values to include only required parameters for updateHarvest
            const updatedHarvestProperties: Record<string, any> = {}
            for (const param of requiredHarvestParameters) {
                if (partialFormValues[param] !== undefined) {
                    updatedHarvestProperties[param] = partialFormValues[param]
                }
            }

            await fdm.transaction((tx) =>
                Promise.all(
                    harvestingIds.map(async (b_id_harvesting) => {
                        const harvest = await getHarvest(
                            tx,
                            session.principal_id,
                            b_id_harvesting,
                        )
                        const b_lu_harvest_date =
                            partialFormValues.b_lu_harvest_date ??
                            harvest.b_lu_harvest_date
                        const currentHarvestProperties: Partial<HarvestableAnalysis> =
                            harvest.harvestable.harvestable_analyses.length
                                ? harvest.harvestable.harvestable_analyses[0]
                                : {}
                        const finalHarvestProperties = {
                            ...currentHarvestProperties,
                            ...updatedHarvestProperties,
                        }

                        // Check if all required parameters are present
                        const missingParameters: string[] = []
                        for (const param of requiredHarvestParameters) {
                            if (
                                finalHarvestProperties[param] === undefined ||
                                finalHarvestProperties[param] === null
                            ) {
                                missingParameters.push(param)
                            }
                        }

                        if (missingParameters.length > 0) {
                            const missingParameterLabels =
                                missingParameters.map((param) => {
                                    return getHarvestParameterLabel(param)
                                })
                            const statusText = `Voor de volgende parameters ontbreekt een waarde: ${missingParameterLabels.join(
                                ", ",
                            )}`
                            throw data(statusText, {
                                status: 400,
                                statusText: statusText,
                            })
                        }

                        return updateHarvest(
                            tx,
                            session.principal_id,
                            b_id_harvesting,
                            b_lu_harvest_date,
                            finalHarvestProperties,
                        )
                    }),
                ),
            )

            return redirectWithSuccess("..", {
                message:
                    harvestingIds.length > 1
                        ? "Oogsten zijn gewijzigd! 🎉"
                        : "Oogst is gewijzigd! 🎉",
            })
        }
        if (request.method === "DELETE") {
            await fdm.transaction((tx) =>
                Promise.all(
                    harvestingIds.map((b_id_harvesting) =>
                        removeHarvest(
                            tx,
                            session.principal_id,
                            b_id_harvesting,
                        ),
                    ),
                ),
            )
            return redirectWithSuccess("..", {
                message:
                    harvestingIds.length > 1
                        ? "Oogsten zijn verwijderd! 🎉"
                        : "Oogst is verwijderd! 🎉",
            })
        }
        throw data("Method not allowed", {
            status: 405,
            statusText: "Method Not Allowed",
        })
    } catch (error) {
        throw handleActionError(error)
    }
}
