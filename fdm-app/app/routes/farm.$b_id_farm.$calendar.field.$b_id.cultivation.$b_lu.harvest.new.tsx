import {
    addHarvest,
    getCultivation,
    getCultivationsFromCatalogue,
    getDefaultsForHarvestParameters,
    getParametersForHarvestCat,
    type HarvestParameters,
} from "@nmi-agro/fdm-core"
import { useState } from "react"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { dataWithWarning, redirectWithSuccess } from "remix-toast"
import z from "zod"
import { BatchHarvestFormDialog } from "~/components/blocks/harvest/batch-form"
import { HarvestFormDialog } from "~/components/blocks/harvest/form"
import { getHarvestParameterLabel } from "~/components/blocks/harvest/parameters"
import { BatchFormSchema, FormSchema } from "~/components/blocks/harvest/schema"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"

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
        const calendar = getCalendar(params)

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
            calendar,
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
    const [isBatch, setIsBatch] = useState(false)

    if (isBatch) {
        return (
            <BatchHarvestFormDialog
                calendar={loaderData.calendar}
                b_lu_croprotation={loaderData.cultivation.b_lu_croprotation}
                b_lu_start={loaderData.cultivation.b_lu_start}
                b_lu_end={loaderData.cultivation.b_lu_end}
                harvestParameters={loaderData.harvestParameters}
                b_date_harvest_default={loaderData.b_date_harvest_default}
                defaultHarvest={{
                    ...loaderData.defaultHarvestParameters,
                }}
                onBack={() => setIsBatch(false)}
            />
        )
    }

    return (
        <HarvestFormDialog
            allowBatch={loaderData.cultivation.b_lu_croprotation === "grass"}
            harvestParameters={loaderData.harvestParameters}
            b_lu_croprotation={loaderData.cultivation.b_lu_croprotation}
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
            onBatchClick={() => setIsBatch(true)}
        />
    )
}

const ActionSchema = z.discriminatedUnion("intent", [
    FormSchema.extend({ intent: z.literal("single_harvest") }),
    BatchFormSchema.extend({ intent: z.literal("batch_harvest") }),
])
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

        // Get required harvest parameters for the cultivation's harvest category
        const requiredHarvestParameters = getParametersForHarvestCat(
            cultivation.b_lu_harvestcat,
        )

        // First, validate against the full FormSchema
        const formValues = await extractFormValuesFromRequest(
            request,
            ActionSchema,
        )

        if (formValues.intent === "batch_harvest") {
            if (cultivation.b_lu_croprotation !== "grass") {
                return dataWithWarning(
                    {
                        warning: `You cannot add harvests to ${cultivation.b_lu_catalogue} in batches.`,
                    },
                    `You cannot add harvests to ${cultivation.b_lu_name} in batches. Only grass is allowed.`,
                )
            }
            const dataWarnings: string[] = []
            const bodyWarnings: string[] = []

            for (const harvest of formValues.harvests) {
                const warning = validateSingleHarvest(
                    requiredHarvestParameters,
                    harvest,
                )
                const dataWarning = warning.dataWarning ?? warning.bodyWarning
                const bodyWarning = warning.bodyWarning ?? warning.dataWarning

                if (
                    typeof dataWarning === "string" &&
                    typeof bodyWarning === "string"
                ) {
                    dataWarnings.push(dataWarning)
                    bodyWarnings.push(bodyWarning)
                }
            }
            if (dataWarnings.length > 0 || bodyWarnings.length > 0) {
                return dataWithWarning(
                    {
                        warning: dataWarnings.join("; "),
                    },
                    bodyWarnings.join("; "),
                )
            }

            await fdm.transaction((tx) =>
                Promise.all(
                    formValues.harvests.map((harvest) =>
                        addSingleHarvest(
                            tx,
                            session.principal_id,
                            b_lu,
                            requiredHarvestParameters,
                            harvest,
                        ),
                    ),
                ),
            )

            return redirectWithSuccess("..", {
                message: "Oogsten zijn succesvol toegevoegd! 🎉",
            })
        }

        const warning = validateSingleHarvest(
            requiredHarvestParameters,
            formValues,
        )
        const dataWarning = warning.dataWarning ?? warning.bodyWarning
        const bodyWarning = warning.bodyWarning ?? warning.dataWarning

        if (
            typeof dataWarning === "string" &&
            typeof bodyWarning === "string"
        ) {
            return dataWithWarning(
                {
                    warning: dataWarning,
                },
                bodyWarning,
            )
        }

        await addSingleHarvest(
            fdm,
            session.principal_id,
            b_lu,
            requiredHarvestParameters,
            formValues,
        )

        return redirectWithSuccess("..", {
            message: "Oogst succesvol toegevoegd! 🎉",
        })
    } catch (error) {
        throw handleActionError(error)
    }
}

function validateSingleHarvest(
    requiredHarvestParameters: HarvestParameters,
    formValues: z.infer<typeof FormSchema>,
) {
    if (!formValues.b_lu_harvest_date) {
        const errors = [
            {
                path: "b_lu_harvest_date",
                message: "Selecteer een oogstdatum",
            },
        ]

        throw new Error(JSON.stringify(errors))
    }

    // Check if all required parameters are present
    const missingParameters: HarvestParameters = []
    for (const param of requiredHarvestParameters) {
        if (
            (formValues as Record<string, unknown>)[param] === undefined ||
            (formValues as Record<string, unknown>)[param] === null
        ) {
            missingParameters.push(param)
        }
    }
    const missingParameterLabels = missingParameters.map((param) => {
        return getHarvestParameterLabel(param)
    })

    if (missingParameters.length > 0) {
        return {
            dataWarning: `Missing required harvest parameters: ${missingParameters.join(
                ", ",
            )}`,
            bodyWarning: `Missing required harvest parameters: ${missingParameterLabels.join(
                ", ",
            )}`,
        }
    }

    return {}
}

async function addSingleHarvest(
    tx: Omit<typeof fdm, "$client">,
    principal_id: string,
    b_lu: string,
    requiredHarvestParameters: HarvestParameters,
    formValues: z.infer<typeof FormSchema>,
) {
    // Filter form values to include only required parameters for addHarvest
    const harvestProperties: Record<string, unknown> = {}
    for (const param of requiredHarvestParameters) {
        if (formValues[param] !== undefined) {
            harvestProperties[param] = formValues[param]
        }
    }

    await addHarvest(
        tx,
        principal_id,
        b_lu,
        formValues.b_lu_harvest_date,
        harvestProperties,
    )
}
