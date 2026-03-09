import {
    addHarvest,
    getCultivation,
    getCultivationsFromCatalogue,
    getDefaultsForHarvestParameters,
    getParametersForHarvestCat,
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
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { getHarvestParameterLabel } from "../components/blocks/harvest/parameters"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Oogst toevoegen - Gewas | ${clientConfig.name}` },
        {
            name: "description",
            content: "Voeg een oogst toe aan dit gewas.",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", { status: 400 })
        }

        const b_lu = params.b_lu
        if (!b_lu) {
            throw data("Cultivation ID is required", { status: 400 })
        }

        const session = await getSession(request)
        const cultivation = await getCultivation(
            fdm,
            session.principal_id,
            b_lu,
        )
        if (!cultivation) {
            throw data("Cultivation not found", { status: 404 })
        }

        const harvestParameters = getParametersForHarvestCat(
            cultivation.b_lu_harvestcat,
        )

        // Default harvest parameters
        const cultivationsCatalogue = await getCultivationsFromCatalogue(
            fdm,
            session.principal_id,
            b_id_farm,
        )
        const defaultHarvestParameters = getDefaultsForHarvestParameters(
            cultivation.b_lu_catalogue,
            cultivationsCatalogue,
        )
        const b_date_harvest_default =
            cultivationsCatalogue.find(
                (item) => item.b_lu_catalogue === cultivation.b_lu_catalogue,
            )?.b_date_harvest_default ?? null

        return {
            b_id_farm,
            b_lu,
            cultivation,
            harvestParameters,
            defaultHarvestParameters,
            b_date_harvest_default,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function HarvestNewBlock() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <HarvestFormDialog
            harvestParameters={loaderData.harvestParameters}
            b_lu_harvest_date={undefined}
            b_date_harvest_default={loaderData.b_date_harvest_default}
            b_lu_yield={loaderData.defaultHarvestParameters.b_lu_yield}
            b_lu_yield_fresh={
                loaderData.defaultHarvestParameters.b_lu_yield_fresh
            }
            b_lu_yield_bruto={
                loaderData.defaultHarvestParameters.b_lu_yield_bruto
            }
            b_lu_tarra={loaderData.defaultHarvestParameters.b_lu_tarra}
            b_lu_uww={loaderData.defaultHarvestParameters.b_lu_uww}
            b_lu_moist={loaderData.defaultHarvestParameters.b_lu_moist}
            b_lu_dm={loaderData.defaultHarvestParameters.b_lu_dm}
            b_lu_cp={loaderData.defaultHarvestParameters.b_lu_cp}
            b_lu_n_harvestable={
                loaderData.defaultHarvestParameters.b_lu_n_harvestable
            }
            b_lu_harvestable={loaderData.cultivation.b_lu_harvestable}
            b_lu_start={loaderData.cultivation.b_lu_start}
            b_lu_end={loaderData.cultivation.b_lu_end}
        />
    )
}

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_lu = params.b_lu
        if (!b_lu) {
            throw data("Cultivation ID is required", { status: 400 })
        }

        const session = await getSession(request)

        // Fetch cultivation details to get b_lu_harvestcat
        const cultivation = await getCultivation(
            fdm,
            session.principal_id,
            b_lu,
        )

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

        // Filter form values to include only required parameters for addHarvest
        const harvestProperties: Record<string, any> = {}
        for (const param of requiredHarvestParameters) {
            if ((formValues as Record<string, any>)[param] !== undefined) {
                harvestProperties[param] = (formValues as Record<string, any>)[
                    param
                ]
            }
        }

        await addHarvest(
            fdm,
            session.principal_id,
            b_lu,
            formValues.b_lu_harvest_date,
            harvestProperties,
        )

        return redirectWithSuccess("..", {
            message: "Oogst succesvol toegevoegd! 🎉",
        })
    } catch (error) {
        throw handleActionError(error)
    }
}
