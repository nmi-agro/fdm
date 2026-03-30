import { zodResolver } from "@hookform/resolvers/zod"
import {
    buildFertilizerPlanPrompt,
    createFertilizerPlannerAgent,
    type FarmFieldSummary,
    type OneShotAgentResult,
    runOneShotAgent,
} from "@nmi-agro/fdm-agents"
import {
    aggregateNormFillingsToFarmLevel,
    aggregateNormsToFarmLevel,
    calculateDose,
    createFunctionsForFertilizerApplicationFilling,
    createFunctionsForNorms,
    getNutrientAdvice,
    calculateNitrogenBalanceField,
    collectInputForNitrogenBalance,
    calculateNitrogenBalancesFieldToFarm,
    calculateOrganicMatterBalanceField,
    collectInputForOrganicMatterBalance,
    type NormFilling,
    type NutrientAdvice,
} from "@nmi-agro/fdm-calculator"
import {
    addFertilizerApplication,
    type Fertilizer,
    type FertilizerApplication,
    getCultivations,
    getCurrentSoilData,
    getFarms,
    getFertilizerApplications,
    getFertilizerParametersDescription,
    getFertilizers,
    getField,
    getFields,
    isDerogationGrantedForYear,
    isOrganicCertificationValid,
    type PrincipalId,
    removeFertilizerApplication,
} from "@nmi-agro/fdm-core"
import { Bot } from "lucide-react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useEffect, useState } from "react"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    redirect,
    useActionData,
    useBeforeUnload,
    useBlocker,
    useLoaderData,
    useNavigation,
} from "react-router"
import { getValidatedFormData, useRemixForm } from "remix-hook-form"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import type { z } from "zod"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { GerritLoading } from "~/components/blocks/gerrit/loading"
import { GerritOnboarding } from "~/components/blocks/gerrit/onboarding"
import { PlanTable } from "~/components/blocks/gerrit/plan-table"
import {
    GEMINI_MODELS,
    GerritFormSchema,
    STRATEGY_LABELS,
} from "~/components/blocks/gerrit/schema"
import { StrategyForm } from "~/components/blocks/gerrit/strategy-form"
import { SummaryCards } from "~/components/blocks/gerrit/summary-cards"
import type { FieldMetrics, ParsedPlan } from "~/components/blocks/gerrit/types"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { handleActionError } from "~/lib/error"
import { clientConfig } from "~/lib/config"
import { serverConfig } from "~/lib/config.server"
import { fdm } from "~/lib/fdm.server"
import PostHogClient from "~/posthog.server"
import { getDefaultCultivation } from "../lib/cultivation-helpers"

export const handle = { hideNavigationProgress: true }

export const meta: MetaFunction = () => {
    return [
        { title: `Gerrit's Bemestingsplan | ${clientConfig.name}` },
        {
            name: "description",
            content: "AI-gedreven bemestingsplan genereren",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
        throw data("missing: b_id_farm", { status: 400 })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)
    const calendar = getCalendar(params)

    const farms = await getFarms(fdm, session.principal_id)
    const farm = farms.find((f) => f.b_id_farm === b_id_farm)

    if (!farm) {
        return redirect("./farm")
    }

    const farmOptions = farms.map((f) => ({
        b_id_farm: f.b_id_farm,
        b_name_farm: f.b_name_farm ?? "",
    }))

    const isOrganicFarm = await isOrganicCertificationValid(
        fdm,
        session.principal_id,
        b_id_farm,
        timeframe.start ?? new Date(),
    )

    const isDerogationFarm = await isDerogationGrantedForYear(
        fdm,
        session.principal_id,
        b_id_farm,
        Number.parseInt(calendar),
    )

    return {
        farm: {
            b_id_farm: farm.b_id_farm,
            b_name_farm: farm.b_name_farm,
        },
        farmOptions,
        calendar,
        defaultStrategies: {
            isOrganic: isOrganicFarm,
            fillManureSpace: !isOrganicFarm,
            isDerogation: isDerogationFarm,
        },
    }
}

async function computePlanMetrics(
    principalId: PrincipalId,
    b_id_farm: string,
    calendar: string,
    enrichedPlan: Array<{
        b_id: string
        b_lu_catalogue?: string
        b_area: number | null
        b_bufferstrip: boolean
        applications: Array<{
            p_id_catalogue: string
            p_app_amount: number
            p_app_date: string
            p_app_method?: string | null
        }>
        fieldMetrics: FieldMetrics | null
    }>,
    fertilizers: Awaited<ReturnType<typeof getFertilizers>>,
    nmiApiKey?: string,
) {
    const year = (["2025", "2026"].includes(calendar) ? calendar : "2025") as
        | "2025"
        | "2026"
    const normFuncs = createFunctionsForNorms("NL", year)
    const fillingFuncs = createFunctionsForFertilizerApplicationFilling(
        "NL",
        year,
    )
    const fieldMetricsMap: Record<string, FieldMetrics> = {}

    const timeframe = {
        start: new Date(`${calendar}-01-01`),
        end: new Date(`${calendar}-12-31`),
    }

    const [omInput, nInput] = await Promise.all([
        collectInputForOrganicMatterBalance(
            fdm,
            principalId,
            b_id_farm,
            timeframe,
        ).catch(() => null),
        collectInputForNitrogenBalance(
            fdm,
            principalId,
            b_id_farm,
            timeframe,
        ).catch(() => null),
    ])

    const fieldResults = await Promise.allSettled(
        enrichedPlan
            .filter((f) => f.b_area)
            .map(async (field) => {
                let manure = { normValue: 170, normSource: "default" }
                let nitrogen = { normValue: 0, normSource: "default" }
                let phosphate = { normValue: 0, normSource: "default" }
                try {
                    const normsInput = await normFuncs.collectInputForNorms(
                        fdm,
                        principalId,
                        field.b_id,
                    )
                    const [manureResult, phosphateResult, nitrogenResult] =
                        await Promise.all([
                            normFuncs.calculateNormForManure(
                                fdm,
                                normsInput as any,
                            ),
                            normFuncs.calculateNormForPhosphate(
                                fdm,
                                normsInput as any,
                            ),
                            normFuncs.calculateNormForNitrogen(
                                fdm,
                                normsInput as any,
                            ),
                        ])
                    manure = {
                        normValue: manureResult.normValue,
                        normSource: manureResult.normSource,
                    }
                    phosphate = {
                        normValue: phosphateResult.normValue,
                        normSource: phosphateResult.normSource,
                    }
                    nitrogen = {
                        normValue: nitrogenResult.normValue,
                        normSource: nitrogenResult.normSource,
                    }
                } catch (err) {
                    console.warn(
                        `[computePlanMetrics] Norm calc failed for ${field.b_id}:`,
                        err,
                    )
                }

                const syntheticApps: FertilizerApplication[] =
                    field.applications.map((app, i) => {
                        const fert = fertilizers.find(
                            (f) => f.p_id_catalogue === app.p_id_catalogue,
                        )
                        return {
                            p_id: fert?.p_id ?? app.p_id_catalogue,
                            p_id_catalogue: app.p_id_catalogue,
                            p_name_nl: fert?.p_name_nl ?? null,
                            p_app_amount: app.p_app_amount,
                            p_app_date: new Date(app.p_app_date),
                            p_app_id: `plan-${field.b_id}-${i}`,
                            p_app_method: app.p_app_method ?? null,
                        } as unknown as FertilizerApplication
                    })

                let manureFilling: NormFilling
                let nitrogenFilling: NormFilling
                let phosphateFilling: NormFilling

                try {
                    const baseInput =
                        await fillingFuncs.collectInputForFertilizerApplicationFilling(
                            fdm,
                            principalId,
                            field.b_id,
                            phosphate.normValue,
                        )
                    const fillingInput = {
                        ...baseInput,
                        applications: syntheticApps,
                        fertilizers,
                    } as Awaited<
                        ReturnType<
                            typeof fillingFuncs.collectInputForFertilizerApplicationFilling
                        >
                    >
                    const [manureResult, nitrogenResult, phosphateResult] =
                        await Promise.all([
                            Promise.resolve(
                                fillingFuncs.calculateFertilizerApplicationFillingForManure(
                                    fdm,
                                    fillingInput,
                                ),
                            ),
                            fillingFuncs.calculateFertilizerApplicationFillingForNitrogen(
                                fdm,
                                fillingInput,
                            ),
                            Promise.resolve(
                                fillingFuncs.calculateFertilizerApplicationFillingForPhosphate(
                                    fdm,
                                    fillingInput,
                                ),
                            ),
                        ])
                    manureFilling = manureResult
                    nitrogenFilling = nitrogenResult
                    phosphateFilling = phosphateResult
                } catch (err) {
                    console.warn(
                        `[computePlanMetrics] Filling calc failed for ${field.b_id}, fallback:`,
                        err,
                    )
                    let mFill = 0
                    let nFill = 0
                    let pFill = 0
                    for (const app of field.applications) {
                        const fert = fertilizers.find(
                            (f: Fertilizer) =>
                                f.p_id_catalogue === app.p_id_catalogue,
                        )
                        if (!fert) continue
                        const amount = app.p_app_amount ?? 0
                        if (fert.p_type === "manure")
                            mFill += (amount * (fert.p_n_rt ?? 0)) / 1000
                        nFill +=
                            (amount * (fert.p_n_rt ?? 0) * (fert.p_n_wc ?? 0)) /
                            1000
                        pFill += (amount * (fert.p_p_rt ?? 0)) / 1000
                    }
                    manureFilling = {
                        normFilling: mFill,
                        applicationFilling: [],
                    }
                    nitrogenFilling = {
                        normFilling: nFill,
                        applicationFilling: [],
                    }
                    phosphateFilling = {
                        normFilling: pFill,
                        applicationFilling: [],
                    }
                }

                // Fetch NMI nutrient advice per field
                let advice: NutrientAdvice | null = null
                if (nmiApiKey && field.b_lu_catalogue) {
                    try {
                        const [fieldData, currentSoilData] = await Promise.all([
                            getField(fdm, principalId, field.b_id),
                            getCurrentSoilData(fdm, principalId, field.b_id),
                        ])
                        advice = await getNutrientAdvice(fdm, {
                            b_lu_catalogue: field.b_lu_catalogue,
                            b_centroid: fieldData.b_centroid ?? [0, 0],
                            currentSoilData,
                            nmiApiKey,
                            b_bufferstrip: fieldData.b_bufferstrip,
                        })
                    } catch (err) {
                        console.warn(
                            `[computePlanMetrics] NMI advice failed for ${field.b_id}:`,
                            err,
                        )
                    }
                }

                const proposedDose = calculateDose({
                    applications: syntheticApps,
                    fertilizers,
                })

                let omBalance = field.fieldMetrics?.omBalance ?? null
                if (omInput) {
                    const fieldOmInput = omInput.fields.find(
                        (f: any) => f.field.b_id === field.b_id,
                    )
                    if (fieldOmInput) {
                        try {
                            const omResult = calculateOrganicMatterBalanceField(
                                {
                                    fieldInput: {
                                        ...fieldOmInput,
                                        fertilizerApplications: syntheticApps,
                                    },
                                    fertilizerDetails:
                                        omInput.fertilizerDetails,
                                    cultivationDetails:
                                        omInput.cultivationDetails,
                                    timeFrame: timeframe,
                                },
                            )
                            omBalance = omResult.balance
                        } catch (e) {
                            console.warn(
                                `[computePlanMetrics] OM calc failed for ${field.b_id}:`,
                                e,
                            )
                        }
                    }
                }

                let nBalance = field.fieldMetrics?.nBalance ?? {
                    balance: 0,
                    target: 0,
                    emission: { ammonia: { total: 0 }, nitrate: { total: 0 } },
                }
                if (nInput) {
                    const fieldNInput = nInput.fields.find(
                        (f: any) => f.field.b_id === field.b_id,
                    )
                    if (fieldNInput) {
                        try {
                            nBalance = calculateNitrogenBalanceField({
                                fieldInput: {
                                    ...fieldNInput,
                                    fertilizerApplications: syntheticApps,
                                },
                                fertilizerDetails: nInput.fertilizerDetails,
                                cultivationDetails: nInput.cultivationDetails,
                                timeFrame: timeframe,
                            })
                        } catch (e) {
                            console.warn(
                                `[computePlanMetrics] N calc failed for ${field.b_id}:`,
                                e,
                            )
                        }
                    }
                }

                fieldMetricsMap[field.b_id] = {
                    normsFilling: {
                        manure: manureFilling,
                        nitrogen: nitrogenFilling,
                        phosphate: phosphateFilling,
                    },
                    norms: { manure, nitrogen, phosphate },
                    nBalance: {
                        balance: nBalance.balance,
                        target: nBalance.target,
                        emission: nBalance.emission,
                    },
                    omBalance,
                    advice,
                    proposedDose: proposedDose.dose,
                }
                return {
                    b_id: field.b_id,
                    b_area: field.b_area ?? 0,
                    b_bufferstrip: field.b_bufferstrip,
                    nBalance,
                    fieldData: field,
                }
            }),
    )

    const validFields = fieldResults
        .filter(
            (
                r,
            ): r is PromiseFulfilledResult<{
                b_id: string
                b_area: number
                b_bufferstrip: boolean
                nBalance: any
                fieldData: any
            }> => r.status === "fulfilled",
        )
        .map((r) => r.value)
        .filter((f) => fieldMetricsMap[f.b_id])

    if (validFields.length === 0) return null

    const farmNormsKg = aggregateNormsToFarmLevel(
        validFields.map((f) => ({
            b_id: f.b_id,
            b_area: f.b_area,
            norms: fieldMetricsMap[f.b_id].norms,
        })),
    )

    const farmFillingsKg = aggregateNormFillingsToFarmLevel(
        validFields.map((f) => ({
            b_id: f.b_id,
            b_area: f.b_area,
            normsFilling: fieldMetricsMap[f.b_id].normsFilling,
        })),
    )

    const farmNBalance = calculateNitrogenBalancesFieldToFarm(
        validFields.map((f) => ({
            b_id: f.b_id,
            b_area: f.b_area,
            b_bufferstrip: f.b_bufferstrip,
            balance: f.nBalance,
        })),
        false,
        [],
    )

    return {
        fieldMetricsMap,
        farmTotals: {
            normsFilling: farmFillingsKg,
            norms: farmNormsKg,
            nBalance: farmNBalance,
        },
    }
}

export async function action({ request, params }: ActionFunctionArgs) {
    const session = await getSession(request)
    const b_id_farm = params.b_id_farm
    const timeframe = getTimeframe(params)
    const calendar = getCalendar(params)

    if (!b_id_farm) throw data("Missing farm ID", { status: 400 })

    const clonedRequest = request.clone()
    const formData = await request.formData()
    const intent = formData.get("intent")

    if (intent === "generate") {
        const { errors, data: formValues } = await getValidatedFormData<
            z.infer<typeof GerritFormSchema>
        >(clonedRequest, zodResolver(GerritFormSchema) as any)
        if (errors || !formValues) {
            return dataWithError(
                null,
                "Ongeldige invoer, controleer het formulier.",
            )
        }

        try {
            const strategies = {
                isOrganic: formValues.isOrganic,
                fillManureSpace: formValues.fillManureSpace,
                reduceAmmoniaEmissions: formValues.reduceAmmoniaEmissions,
                keepNitrogenBalanceBelowTarget:
                    formValues.keepNitrogenBalanceBelowTarget,
                workOnRotationLevel: formValues.workOnRotationLevel,
                isDerogation: formValues.isDerogation ?? false,
            }
            const additionalContext = formValues.additionalContext
            const modelName = formValues.geminiModel

            const rawFields = await getFields(
                fdm,
                session.principal_id,
                b_id_farm,
                timeframe,
            )
            const fieldsData = await Promise.all(
                rawFields.map(async (field) => {
                    const [cultivations, soilData] = await Promise.all([
                        getCultivations(
                            fdm,
                            session.principal_id,
                            field.b_id,
                            timeframe,
                        ),
                        getCurrentSoilData(
                            fdm,
                            session.principal_id,
                            field.b_id,
                        ),
                    ])
                    const mainCultivation = getDefaultCultivation(
                        cultivations,
                        calendar,
                    )
                    const getSoilParam = (param: string) =>
                        soilData.find((d) => d.parameter === param)?.value ??
                        null
                    return {
                        b_id: field.b_id,
                        b_name: field.b_name || field.b_id,
                        b_area: field.b_area,
                        b_bufferstrip: field.b_bufferstrip,
                        b_lu_catalogue:
                            mainCultivation?.b_lu_catalogue || "Onbekend",
                        b_lu_name:
                            mainCultivation?.b_lu_name || "Onbekend gewas",
                        b_lu_croprotation:
                            mainCultivation?.b_lu_croprotation || null,
                        b_soiltype_agr: getSoilParam("b_soiltype_agr") as
                            | string
                            | null,
                        b_gwl_class: getSoilParam("b_gwl_class") as
                            | string
                            | null,
                        a_som_loi: getSoilParam("a_som_loi") as number | null,
                    }
                }),
            )
            const fieldsSummary: FarmFieldSummary[] = fieldsData.map((f) => ({
                b_id: f.b_id,
                b_name: f.b_name,
                b_area: f.b_area ?? 0,
                b_bufferstrip: f.b_bufferstrip ?? false,
                b_lu_catalogue: f.b_lu_catalogue,
                b_lu_name: f.b_lu_name,
                b_soiltype_agr: f.b_soiltype_agr,
                b_gwl_class: f.b_gwl_class,
                a_som_loi: f.a_som_loi,
            }))
            const fertilizers = await getFertilizers(
                fdm,
                session.principal_id,
                b_id_farm,
            )
            const agent = createFertilizerPlannerAgent(
                fdm,
                serverConfig.integrations.gemini?.api_key,
                modelName,
            )
            const prompt = buildFertilizerPlanPrompt(
                { b_id_farm },
                strategies,
                calendar,
                additionalContext,
                fieldsSummary,
            )
            const agentContext = {
                principalId: session.principal_id,
                b_id_farm,
                calendar,
                nmiApiKey: serverConfig.integrations.nmi?.api_key,
                strategies,
                additionalContext: additionalContext ?? "",
            }

            const startTime = Date.now()
            let rawResult = ""
            let usageData: OneShotAgentResult["usage"] = null
            let toolCalls: string[] | undefined = undefined

            try {
                const agentResult = await runOneShotAgent(
                    agent,
                    prompt,
                    agentContext,
                )
                rawResult = agentResult.result
                usageData = agentResult.usage
                toolCalls = agentResult.toolCalls
            } catch (err: unknown) {
                return dataWithError(
                    null,
                    err instanceof Error
                        ? err.message
                        : "Gerrit kon geen plan genereren.",
                )
            }

            const firstBrace = rawResult.indexOf("{")
            const lastBrace = rawResult.lastIndexOf("}")
            if (firstBrace === -1 || lastBrace <= firstBrace)
                return dataWithError(
                    null,
                    "Gerrit gaf een onleesbaar antwoord. Probeer het opnieuw.",
                )

            let parsedPlan: ParsedPlan
            try {
                parsedPlan = JSON.parse(
                    rawResult.slice(firstBrace, lastBrace + 1),
                ) as ParsedPlan
            } catch {
                return dataWithError(
                    null,
                    "Gerrit gaf een ongeldig plan terug. Probeer het opnieuw.",
                )
            }

            const fertilizerParameterDescription =
                getFertilizerParametersDescription()
            const applicationMethods = fertilizerParameterDescription.find(
                (x: any) => x.parameter === "p_app_method_options",
            )

            const enrichedPlan = fieldsData.map((fd) => {
                const proposedField = parsedPlan.plan?.find(
                    (p) => p.b_id === fd.b_id,
                )
                return {
                    b_id: fd.b_id,
                    b_name: fd.b_name,
                    b_lu_catalogue: fd.b_lu_catalogue,
                    b_lu_name: fd.b_lu_name,
                    b_lu_croprotation: fd.b_lu_croprotation,
                    b_area: fd.b_area,
                    b_bufferstrip: fd.b_bufferstrip ?? false,
                    applications: (proposedField?.applications || []).map(
                        (app) => {
                            const fert = fertilizers.find(
                                (f: Fertilizer) =>
                                    f.p_id_catalogue === app.p_id_catalogue,
                            )
                            const methodMeta =
                                applicationMethods?.options?.find(
                                    (x: any) => x.value === app.p_app_method,
                                )
                            return {
                                ...app,
                                p_name_nl:
                                    fert?.p_name_nl || app.p_id_catalogue,
                                p_type: fert?.p_type || "other",
                                p_app_method_name:
                                    methodMeta?.label ?? app.p_app_method,
                            }
                        },
                    ),
                    fieldMetrics:
                        (proposedField as any)?.fieldMetrics ??
                        (null as FieldMetrics | null),
                }
            })

            const serverMetrics = await computePlanMetrics(
                session.principal_id,
                b_id_farm,
                calendar,
                enrichedPlan,
                fertilizers,
                serverConfig.integrations.nmi?.api_key,
            ).catch(() => null)
            for (const field of enrichedPlan) {
                field.fieldMetrics =
                    serverMetrics?.fieldMetricsMap?.[field.b_id] ?? null
            }

            const latencySeconds = (Date.now() - startTime) / 1000
            const posthog = PostHogClient()
            if (posthog) {
                posthog.capture({
                    distinctId: session.principal_id,
                    event: "$ai_generation",
                    properties: {
                        $ai_model: modelName,
                        $ai_latency: latencySeconds,
                        $ai_input_tokens: usageData?.inputTokens ?? null,
                        $ai_output_tokens: usageData?.outputTokens ?? null,
                        $ai_total_tokens: usageData?.totalTokens ?? null,
                        $ai_input: [
                            { role: "user", content: prompt.slice(0, 2000) },
                        ],
                        $ai_output_choices: [
                            {
                                role: "assistant",
                                content: rawResult.slice(0, 2000),
                            },
                        ],
                        $ai_tools_called: toolCalls || [],
                        $ai_tool_call_count: toolCalls?.length || 0,
                        $ai_trace_id: `gerrit-${b_id_farm}-${calendar}`,
                        b_id_farm,
                        calendar,
                        field_count: fieldsData.length,
                    },
                })
                await posthog.flush()
            }

            return data({
                intent: "generate",
                plan: {
                    summary: parsedPlan.summary,
                    plan: enrichedPlan,
                    metrics: serverMetrics
                        ? { farmTotals: serverMetrics.farmTotals }
                        : null,
                },
                strategies,
            })
        } catch (e: unknown) {
            return handleActionError(e)
        }
    }

    if (intent === "accept") {
        const planStr = formData.get("plan")?.toString()
        if (!planStr)
            return dataWithError(null, "Geen plan gevonden om op te slaan.")

        try {
            const plan = JSON.parse(planStr)
            if (!plan?.plan || !Array.isArray(plan.plan)) {
                return dataWithError(null, "Ongeldig bemestingsplan.")
            }
            const fertilizers = await getFertilizers(
                fdm,
                session.principal_id,
                b_id_farm,
            )

            // Overwrite existing applications for the timeframe
            const rawFields = await getFields(
                fdm,
                session.principal_id,
                b_id_farm,
                timeframe,
            )

            await fdm.transaction(async (tx) => {
                // 1. Remove all existing applications for the timeframe across all fields
                await Promise.all(
                    rawFields.map(async (field) => {
                        const existingApps = await getFertilizerApplications(
                            tx,
                            session.principal_id,
                            field.b_id,
                            timeframe,
                        )
                        await Promise.all(
                            existingApps.map((app) =>
                                removeFertilizerApplication(
                                    tx,
                                    session.principal_id,
                                    app.p_app_id,
                                ),
                            ),
                        )
                    }),
                )

                // 2. Add the proposed ones
                for (const field of plan.plan) {
                    for (const app of field.applications) {
                        const fertilizer = fertilizers.find(
                            (f: Fertilizer) =>
                                f.p_id_catalogue === app.p_id_catalogue,
                        )
                        if (!fertilizer) {
                            throw new Error(
                                `Meststof ${app.p_id_catalogue} niet gevonden in inventaris.`,
                            )
                        }

                        await addFertilizerApplication(
                            tx,
                            session.principal_id,
                            field.b_id,
                            fertilizer.p_id,
                            app.p_app_amount,
                            app.p_app_method,
                            new Date(app.p_app_date),
                        )
                    }
                }
            })

            return redirectWithSuccess(
                `/farm/${b_id_farm}/${calendar}/rotation`,
                "Gerrit's bemestingsplan is succesvol toegepast!",
            )
        } catch (e: unknown) {
            console.error("Save failed:", e)
            return dataWithError(
                null,
                "Fout bij opslaan: " +
                    (e instanceof Error ? e.message : String(e)),
            )
        }
    }

    return null
}

export default function GerritApp() {
    const { farm, farmOptions, defaultStrategies, calendar } =
        useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const navigation = useNavigation()

    const supportedYears = ["2025", "2026"]
    const isSupportedYear = supportedYears.includes(calendar)
    const isGerritEnabled = useFeatureFlagEnabled("gerrit")

    const form = useRemixForm<z.infer<typeof GerritFormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(GerritFormSchema) as any,
        defaultValues: {
            ...defaultStrategies,
            reduceAmmoniaEmissions: false,
            keepNitrogenBalanceBelowTarget: false,
            workOnRotationLevel: false,
            additionalContext: "",
            geminiModel: GEMINI_MODELS[0].value,
        },
    })

    const additionalContextValue = form.watch("additionalContext")

    const isSaving =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "accept"

    // Check if Gerrit is currently generating a plan
    const isAIGenerating =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "generate"

    useBeforeUnload(
        (event) => {
            if (isAIGenerating) {
                event.preventDefault()
            }
        },
        { capture: true },
    )

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            isAIGenerating &&
            currentLocation.pathname !== nextLocation.pathname,
    )

    const plan = actionData?.intent === "generate" ? actionData.plan : null
    const strategies =
        actionData?.intent === "generate" ? actionData.strategies : null
    const farmTotals = plan?.metrics?.farmTotals

    const [showStrategyForm, setShowStrategyForm] = useState(true)
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (plan) setShowStrategyForm(false)
    }, [plan])

    function toggleRow(b_id: string) {
        setExpandedRows((prev) => {
            const next = new Set(prev)
            next.has(b_id) ? next.delete(b_id) : next.add(b_id)
            return next
        })
    }

    const activeStrategyLabels = strategies
        ? Object.entries(strategies)
              .filter(([, v]) => v === true)
              .map(([k]) => STRATEGY_LABELS[k] ?? k)
        : []

    const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState<
        boolean | null
    >(null)
    const [isCheckboxChecked, setIsCheckboxChecked] = useState(false)

    useEffect(() => {
        const key = `gerrit_disclaimer_accepted_${farm.b_id_farm}`
        try {
            const accepted = localStorage.getItem(key) === "true"
            setHasAcceptedDisclaimer(accepted)
        } catch {
            setHasAcceptedDisclaimer(false)
        }
    }, [farm.b_id_farm])

    const handleAcceptDisclaimer = () => {
        if (!isCheckboxChecked) return
        const key = `gerrit_disclaimer_accepted_${farm.b_id_farm}`
        try {
            localStorage.setItem(key, "true")
        } catch (err) {
            console.warn(
                "[Gerrit] Could not persist disclaimer acceptance:",
                err,
            )
        }
        setHasAcceptedDisclaimer(true)
    }

    const blockerDialog = (
        <AlertDialog open={blocker.state === "blocked"}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Wil je de berekening annuleren?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Gerrit is momenteel een bemestingsplan voor je aan het
                        berekenen. Als je nu weg navigeert, wordt de berekening
                        gestopt.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => blocker.reset?.()}>
                        Verder gaan met Gerrit
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={() => blocker.proceed?.()}>
                        Berekening annuleren
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )

    if (isGerritEnabled === false) {
        return (
            <SidebarInset>
                <Header action={undefined}>
                    <HeaderFarm
                        b_id_farm={farm.b_id_farm}
                        farmOptions={farmOptions}
                    />
                </Header>
                <FarmContent>
                    <div className="max-w-2xl mx-auto mt-20 text-center space-y-6">
                        <div className="bg-primary/10 border border-primary/20 p-8 rounded-xl">
                            <Bot className="w-12 h-12 text-primary mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-foreground mb-2">
                                Gerrit is nog niet beschikbaar voor je.
                            </h2>
                            <p className="text-muted-foreground mb-6">
                                Gerrit is momenteel in ontwikkeling en is nog
                                niet voor iedereen beschikbaar. We zijn de
                                functionaliteit aan het testen met een selecte
                                groep gebruikers. Als je interesse of vragen
                                over Gerrit, neem dan contact op met
                                Ondersteuning.
                            </p>
                        </div>
                    </div>
                </FarmContent>
            </SidebarInset>
        )
    }

    if (hasAcceptedDisclaimer === null) {
        return (
            <>
                <SidebarInset>
                    <Header action={undefined}>
                        <HeaderFarm
                            b_id_farm={farm.b_id_farm}
                            farmOptions={farmOptions}
                        />
                    </Header>
                    <FarmContent>
                        <div className="min-h-[50vh]" />
                    </FarmContent>
                </SidebarInset>
                {blockerDialog}
            </>
        )
    }

    if (hasAcceptedDisclaimer === false) {
        return (
            <>
                <SidebarInset>
                    <Header action={undefined}>
                        <HeaderFarm
                            b_id_farm={farm.b_id_farm}
                            farmOptions={farmOptions}
                        />
                    </Header>
                    <FarmContent>
                        <GerritOnboarding
                            isCheckboxChecked={isCheckboxChecked}
                            setIsCheckboxChecked={setIsCheckboxChecked}
                            onAccept={handleAcceptDisclaimer}
                        />
                    </FarmContent>
                </SidebarInset>
                {blockerDialog}
            </>
        )
    }

    if (!isSupportedYear) {
        return (
            <>
                <SidebarInset>
                    <Header action={undefined}>
                        <HeaderFarm
                            b_id_farm={farm.b_id_farm}
                            farmOptions={farmOptions}
                        />
                    </Header>
                    <FarmContent>
                        <div className="max-w-2xl mx-auto mt-20 text-center space-y-6">
                            <div className="bg-amber-50 border border-amber-200 p-8 rounded-xl">
                                <Bot className="w-12 h-12 text-amber-600 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-amber-900 mb-2">
                                    Gerrit is alleen beschikbaar voor 2025 en
                                    2026
                                </h2>
                                <p className="text-amber-800 mb-6">
                                    Het AI-bemestingsplan van Gerrit kan
                                    momenteel alleen worden gegenereerd voor
                                    2025 en 2026. Schakel over naar een van deze
                                    jaren om aan de slag te gaan.
                                </p>
                                <div className="flex justify-center gap-4">
                                    <Button asChild size="lg">
                                        <a
                                            href={`/farm/${farm.b_id_farm}/2025/gerrit`}
                                        >
                                            Switch naar 2025
                                        </a>
                                    </Button>
                                    <Button asChild size="lg">
                                        <a
                                            href={`/farm/${farm.b_id_farm}/2026/gerrit`}
                                        >
                                            Switch naar 2026
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </FarmContent>
                </SidebarInset>
                {blockerDialog}
            </>
        )
    }

    const isGenerating =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "generate"

    return (
        <>
            <SidebarInset>
                <Header action={undefined}>
                    <HeaderFarm
                        b_id_farm={farm.b_id_farm}
                        farmOptions={farmOptions}
                    />
                </Header>
                <FarmContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                        {/* ── Left column ── */}
                        <div className="lg:col-span-1 flex flex-col gap-6">
                            {/* Strategy form OR compact summary */}
                            {showStrategyForm ? (
                                <StrategyForm
                                    form={form as any}
                                    isGenerating={isAIGenerating}
                                    additionalContextValue={
                                        additionalContextValue
                                    }
                                    calendar={calendar}
                                />
                            ) : (
                                <SummaryCards
                                    farmTotals={farmTotals}
                                    planSummary={plan?.summary}
                                    activeStrategyLabels={activeStrategyLabels}
                                    onEditStrategy={() =>
                                        setShowStrategyForm(true)
                                    }
                                    traceId={`gerrit-${farm.b_id_farm}-${calendar}`}
                                />
                            )}
                        </div>

                        {/* ── Right column ── */}
                        <div className="lg:col-span-2 space-y-6">
                            {isGenerating ? (
                                <GerritLoading />
                            ) : plan ? (
                                <>
                                    <PlanTable
                                        plan={plan}
                                        isSaving={isSaving}
                                        expandedRows={expandedRows}
                                        toggleRow={toggleRow}
                                    />
                                </>
                            ) : (
                                <Card className="h-full min-h-100 flex flex-col items-center justify-center text-center p-12 text-muted-foreground border-dashed">
                                    <div className="bg-primary/10 p-6 rounded-full mb-6">
                                        <Bot className="w-12 h-12 text-primary opacity-80" />
                                    </div>
                                    <h3 className="font-semibold text-xl text-foreground mb-3">
                                        Gerrit staat voor je klaar
                                    </h3>
                                    <p className="max-w-lg leading-relaxed text-muted-foreground">
                                        Selecteer aan de linkerkant jouw
                                        bedrijfsvoorkeuren. Gerrit berekent een
                                        integraal bemestingsplan voor het hele
                                        bedrijf, rekening houdend met
                                        gebruiksnormen, bemestingsadvies en je
                                        voorkeuren.
                                    </p>
                                </Card>
                            )}
                        </div>
                    </div>
                </FarmContent>
            </SidebarInset>
            {blockerDialog}
        </>
    )
}
