import {
    addHarvest,
    type Cultivation,
    getCultivation,
    getCultivationsFromCatalogue,
    getDefaultsForHarvestParameters,
    getParametersForHarvestCat,
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
import { getEffectiveHarvestable, getHarvestCapitalizedTerm } from "~/components/blocks/harvest/utils"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"

// Meta
export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
    const term = getHarvestCapitalizedTerm(loaderData?.cultivation?.b_lu_croprotation)
    return [
        { title: `${term} toevoegen - Gewas | ${clientConfig.name}` },
        {
            name: "description",
            content: `Voeg een ${term.toLowerCase()} toe aan dit gewas.`,
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

        const effectiveHarvestable = getEffectiveHarvestable(
            cultivation.b_lu_harvestable,
            cultivation.b_lu_croprotation,
        )

        return {
            calendar,
            b_id_farm,
            b_lu,
            cultivation,
            harvestParameters,
            defaultHarvestParameters,
            b_date_harvest_default,
            effectiveHarvestable,
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
            allowBatch={loaderData.effectiveHarvestable === "multiple"}
            harvestParameters={loaderData.harvestParameters}
            b_lu_croprotation={
                loaderData.cultivation.b_lu_croprotation ?? undefined
            }
            b_lu_harvest_date={undefined}
            b_date_harvest_default={loaderData.b_date_harvest_default}
            b_lu_yield={
                loaderData.defaultHarvestParameters.b_lu_yield ?? undefined
            }
            b_lu_yield_fresh={
                loaderData.defaultHarvestParameters.b_lu_yield_fresh ??
                undefined
            }
            b_lu_yield_bruto={
                loaderData.defaultHarvestParameters.b_lu_yield_bruto ??
                undefined
            }
            b_lu_tarra={
                loaderData.defaultHarvestParameters.b_lu_tarra ?? undefined
            }
            b_lu_uww={loaderData.defaultHarvestParameters.b_lu_uww ?? undefined}
            b_lu_moist={
                loaderData.defaultHarvestParameters.b_lu_moist ?? undefined
            }
            b_lu_dm={loaderData.defaultHarvestParameters.b_lu_dm ?? undefined}
            b_lu_cp={loaderData.defaultHarvestParameters.b_lu_cp ?? undefined}
            b_lu_n_harvestable={
                loaderData.defaultHarvestParameters.b_lu_n_harvestable ??
                undefined
            }
            b_lu_harvestable={loaderData.effectiveHarvestable}
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

        // First, validate against the full FormSchema
        const formValues = await extractFormValuesFromRequest(
            request,
            ActionSchema,
        )

        // Batch harvest only works when the effective harvestable type allows it
        const effectiveHarvestable = getEffectiveHarvestable(
            cultivation.b_lu_harvestable,
            cultivation.b_lu_croprotation,
        )

        // Batch harvest only works for grass
        if (
            formValues.intent === "batch_harvest" &&
            effectiveHarvestable !== "multiple"
        ) {
            return dataWithWarning(
                {
                    warning: `Je kunt bij ${cultivation.b_lu_catalogue} geen sneden in batches toevoegen. Alleen gras is toegestaan.`,
                },
                `Je kunt bij ${cultivation.b_lu_name} geen sneden in batches toevoegen. Alleen gras is toegestaan.`,
            )
        }

        // Batch harvest must not add multiple harvests to a cultivation that can only be harvested once
        if (
            formValues.intent === "batch_harvest" &&
            formValues.harvests.length > 1 &&
            effectiveHarvestable !== "multiple"
        ) {
            return dataWithWarning(
                null,
                "Dit gewas kan niet meer dan één keer geoogst worden.",
            )
        }

        if (formValues.intent === "batch_harvest") {
            const errors = formValues.harvests.map((row) =>
                validateRow(cultivation, row),
            )

            if (errors.some((item) => Object.keys(item).length > 0)) {
                return dataWithWarning(
                    { errors: { harvests: errors } },
                    "Invoer is ongeldig. Controleer het formulier.",
                )
            }

            await fdm.transaction((tx) =>
                Promise.all(
                    formValues.harvests.map((row) =>
                        addHarvestFromRow(
                            tx,
                            session.principal_id,
                            cultivation,
                            row,
                        ),
                    ),
                ),
            )

            const term = formValues.harvests.length === 1 
                ? getHarvestCapitalizedTerm(cultivation.b_lu_croprotation)
                : getHarvestCapitalizedTerm(cultivation.b_lu_croprotation, true)
            const verb = formValues.harvests.length === 1 ? "is" : "zijn"
            return redirectWithSuccess("..", {
                message: `${term} ${verb} succesvol toegevoegd! 🎉`,
            })
        }

        const errors = validateRow(cultivation, formValues)

        if (Object.keys(errors).length > 0) {
            return dataWithWarning(
                { errors },
                "Invoer is ongeldig. Controleer het formulier.",
            )
        }

        await fdm.transaction((tx) =>
            addHarvestFromRow(
                tx,
                session.principal_id,
                cultivation,
                formValues,
            ),
        )

        const term = getHarvestCapitalizedTerm(cultivation.b_lu_croprotation)
        return redirectWithSuccess("..", {
            message: `${term} succesvol toegevoegd! 🎉`,
        })
    } catch (error) {
        throw handleActionError(error)
    }
}

function validateRow(
    targetCultivationInstance: Cultivation,
    row: z.infer<typeof FormSchema>,
) {
    const errors: Partial<
        Record<keyof z.infer<typeof FormSchema>, { message: string }>
    > = {}

    if (!row.b_lu_harvest_date) {
        errors.b_lu_harvest_date = { message: "Selecteer een oogstdatum" }
    }

    // Get required harvest parameters for the cultivation's harvest category
    const requiredHarvestParameters = getParametersForHarvestCat(
        targetCultivationInstance.b_lu_harvestcat,
    )

    // Check if all required parameters are present
    for (const param of requiredHarvestParameters) {
        if (row[param] === undefined || row[param] === null) {
            errors[param] = {
                message: `${getHarvestParameterLabel(param)} is nodig voor dit gewas.`,
            }
        }
    }

    return errors
}

async function addHarvestFromRow(
    tx: Omit<typeof fdm, "$client">,
    principal_id: string,
    targetCultivationInstance: Cultivation,
    formValues: z.infer<typeof FormSchema>,
) {
    // Get required harvest parameters for the cultivation's harvest category
    const requiredHarvestParameters = getParametersForHarvestCat(
        targetCultivationInstance.b_lu_harvestcat,
    )

    // Filter form values to include only required parameters for updateHarvest
    const harvestProperties: Record<string, number> = {}
    for (const param of requiredHarvestParameters) {
        if (formValues[param] !== undefined) {
            harvestProperties[param] = formValues[param]
        }
    }

    await addHarvest(
        tx,
        principal_id,
        targetCultivationInstance.b_lu,
        formValues.b_lu_harvest_date,
        harvestProperties,
    )
}
