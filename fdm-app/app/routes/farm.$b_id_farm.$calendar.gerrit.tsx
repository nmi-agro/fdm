import {
    addFertilizerApplication,
    getFarms,
    getFertilizers,
    getField,
    getFields,
    getCultivations,
    getCurrentSoilData,
    isOrganicCertificationValid,
    removeFertilizerApplication,
    getFertilizerApplications,
    type Fertilizer,
    type FertilizerApplication,
    type PrincipalId,
} from "@nmi-agro/fdm-core"
import {
    createFunctionsForNorms,
    createFunctionsForFertilizerApplicationFilling,
    aggregateNormsToFarmLevel,
    aggregateNormFillingsToFarmLevel,
    getNutrientAdvice,
    calculateDose,
    type NutrientAdvice,
    type NormFilling,
} from "@nmi-agro/fdm-calculator"
import { Bot } from "lucide-react"
import { useEffect, useState } from "react"
import { type Resolver } from "react-hook-form"
import { useRemixForm, getValidatedFormData } from "remix-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    redirect,
    useActionData,
    useLoaderData,
    useNavigation,
    useParams,
} from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { Card } from "~/components/ui/card"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { fdm } from "~/lib/fdm.server"
import { serverConfig } from "~/lib/config.server"
import PostHogClient from "~/posthog.server"
import {
    runOneShotAgent,
    createFertilizerPlannerAgent,
    buildFertilizerPlanPrompt,
    type FarmFieldSummary,
    type OneShotAgentResult,
} from "@nmi-agro/fdm-agents"

import {
    GerritFormSchema,
    GEMINI_MODELS,
    STRATEGY_LABELS,
} from "~/components/blocks/gerrit/schema"
import { StrategyForm } from "~/components/blocks/gerrit/strategy-form"
import { SummaryCards } from "~/components/blocks/gerrit/summary-cards"
import { PlanTable } from "~/components/blocks/gerrit/plan-table"
import { GerritLoading } from "~/components/blocks/gerrit/gerrit-loading"
import type {
    ParsedPlan,
    ParsedPlanApplication,
    FieldMetrics,
} from "~/components/blocks/gerrit/types"

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
        },
    }
}

// Pricing per 1M tokens (USD) — source: https://ai.google.dev/gemini-api/docs/pricing
const GEMINI_MODEL_PRICING: Record<
    string,
    { input: number | [number, number]; output: number | [number, number] }
> = {
    "gemini-3.1-pro-preview": { input: [2.0, 4.0], output: [12.0, 18.0] },
    "gemini-3.1-flash-lite-preview": { input: 0.1, output: 0.4 },
    "gemini-3-flash-preview": { input: 0.5, output: 3.0 },
    "gemini-2.5-pro": { input: [1.25, 2.5], output: [10.0, 15.0] },
    "gemini-2.5-flash": { input: 0.3, output: 2.5 },
}

function calcModelCost(
    modelName: string,
    inputTokens: number,
    outputTokens: number,
) {
    const pricing =
        GEMINI_MODEL_PRICING[modelName] ??
        GEMINI_MODEL_PRICING["gemini-3.1-pro-preview"]
    const large = inputTokens > 200_000
    const inputRate = Array.isArray(pricing.input)
        ? large
            ? pricing.input[1]
            : pricing.input[0]
        : pricing.input
    const outputRate = Array.isArray(pricing.output)
        ? large
            ? pricing.output[1]
            : pricing.output[0]
        : pricing.output
    return {
        inputCost: (inputTokens / 1_000_000) * inputRate,
        outputCost: (outputTokens / 1_000_000) * outputRate,
    }
}

async function computePlanMetrics(
    principalId: PrincipalId,
    calendar: string,
    enrichedPlan: Array<{
        b_id: string
        b_lu_catalogue?: string
        b_area: number | null
        applications: Array<{
            p_id_catalogue: string
            p_app_amount: number
            p_app_date: string
        }>
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

    const fieldResults = await Promise.allSettled(
        enrichedPlan
            .filter((f) => f.applications.length > 0 && f.b_area)
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
                            normFuncs.calculateNormForManure(fdm, normsInput as any),
                            normFuncs.calculateNormForPhosphate(fdm, normsInput as any),
                            normFuncs.calculateNormForNitrogen(fdm, normsInput as any),
                        ])
                    manure = { normValue: manureResult.normValue, normSource: manureResult.normSource }
                    phosphate = { normValue: phosphateResult.normValue, normSource: phosphateResult.normSource }
                    nitrogen = { normValue: nitrogenResult.normValue, normSource: nitrogenResult.normSource }
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
                            p_app_method: null,
                        }
                    })

                let manureFilling: NormFilling = {
                    normFilling: 0,
                    applicationFilling: [],
                }
                let nitrogenFilling: NormFilling = {
                    normFilling: 0,
                    applicationFilling: [],
                }
                let phosphateFilling: NormFilling = {
                    normFilling: 0,
                    applicationFilling: [],
                }
                let eomSupplyPerHa = 0

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
                    } as Awaited<ReturnType<typeof fillingFuncs.collectInputForFertilizerApplicationFilling>>
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

                for (const app of field.applications) {
                    const fert = fertilizers.find(
                        (f: Fertilizer) =>
                            f.p_id_catalogue === app.p_id_catalogue,
                    )
                    if (fert)
                        eomSupplyPerHa +=
                            (app.p_app_amount * (fert.p_eom ?? 0)) / 1000
                }

                // Compute K applied (kg K₂O/ha)
                let kFillPerHa = 0
                for (const app of field.applications) {
                    const fert = fertilizers.find(
                        (f: Fertilizer) =>
                            f.p_id_catalogue === app.p_id_catalogue,
                    )
                    if (fert)
                        kFillPerHa +=
                            (app.p_app_amount * (fert.p_k_rt ?? 0)) / 1000
                }

                // Fetch NMI nutrient advice per field
                let advice: NutrientAdvice | null = null
                if (nmiApiKey && field.b_lu_catalogue) {
                    try {
                        const [fieldData, currentSoilData] = await Promise.all([
                            getField(fdm, principalId, field.b_id),
                            getCurrentSoilData(
                                fdm,
                                principalId,
                                field.b_id,
                            ),
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

                fieldMetricsMap[field.b_id] = {
                    normsFilling: {
                        manure: manureFilling,
                        nitrogen: nitrogenFilling,
                        phosphate: phosphateFilling,
                    },
                    norms: { manure, nitrogen, phosphate },
                    nBalance: {
                        balance: nitrogenFilling.normFilling,
                        target: nitrogen.normValue,
                        emission: {
                            ammonia: { total: 0 },
                            nitrate: { total: 0 },
                        },
                    },
                    omBalance: null, // Stubbed for fallback
                    eomSupplyPerHa,
                    advice,
                    proposedDose,
                }
                return { b_id: field.b_id, b_area: field.b_area! }
            }),
    )

    const validFields = fieldResults
        .filter(
            (
                r,
            ): r is PromiseFulfilledResult<{ b_id: string; b_area: number }> =>
                r.status === "fulfilled",
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

    // Minimal fallback for farm-level N-balance
    let totalArea = 0
    let totalBal = 0
    let totalTarg = 0
    for (const f of validFields) {
        totalArea += f.b_area
        totalBal += (fieldMetricsMap[f.b_id].nBalance.balance || 0) * f.b_area
        totalTarg += (fieldMetricsMap[f.b_id].nBalance.target || 0) * f.b_area
    }
    const farmNBalance = {
        balance: totalArea > 0 ? totalBal / totalArea : 0,
        target: totalArea > 0 ? totalTarg / totalArea : 0,
        emission: { ammonia: { total: 0 }, nitrate: { total: 0 } },
    }

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
        const {
            errors,
            data: formValues,
        } = await getValidatedFormData<z.infer<typeof GerritFormSchema>>(
            clonedRequest,
            zodResolver(GerritFormSchema) as any,
        )
        if (errors || !formValues) {
            return dataWithError(
                null,
                "Ongeldige invoer, controleer het formulier.",
            )
        }

        const strategies = {
            isOrganic: formValues.isOrganic,
            fillManureSpace: formValues.fillManureSpace,
            reduceAmmoniaEmissions: formValues.reduceAmmoniaEmissions,
            keepNitrogenBalanceBelowTarget:
                formValues.keepNitrogenBalanceBelowTarget,
            workOnRotationLevel: formValues.workOnRotationLevel,
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
                const cultivations = await getCultivations(
                    fdm,
                    session.principal_id,
                    field.b_id,
                    timeframe,
                )
                return {
                    b_id: field.b_id,
                    b_name: field.b_name || field.b_id,
                    b_area: field.b_area,
                    b_bufferstrip: field.b_bufferstrip,
                    b_lu_catalogue:
                        cultivations[0]?.b_lu_catalogue || "Onbekend",
                    b_lu_name: cultivations[0]?.b_lu_name || "Onbekend gewas",
                    b_lu_croprotation:
                        cultivations[0]?.b_lu_croprotation || null,
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
        }

        const startTime = Date.now()
        let rawResult = ""
        let usageData: OneShotAgentResult["usage"] = null

        try {
            const agentResult = await runOneShotAgent(
                agent,
                prompt,
                agentContext,
            )
            rawResult = agentResult.result
            usageData = agentResult.usage
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
                applications: (proposedField?.applications || []).map(
                    (app) => {
                        const fert = fertilizers.find(
                            (f: Fertilizer) =>
                                f.p_id_catalogue === app.p_id_catalogue,
                        )
                        return {
                            ...app,
                            p_name_nl: fert?.p_name_nl || app.p_id_catalogue,
                            p_type: fert?.p_type || "other",
                        }
                    },
                ),
                fieldMetrics: null as FieldMetrics | null,
            }
        })

        const serverMetrics = await computePlanMetrics(
            session.principal_id,
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
            const inputTokens = usageData?.inputTokens ?? 0
            const outputTokens = usageData?.outputTokens ?? 0
            const { inputCost, outputCost } = calcModelCost(
                modelName,
                inputTokens,
                outputTokens,
            )
            posthog.capture({
                distinctId: session.principal_id,
                event: "$ai_generation",
                properties: {
                    $ai_model: modelName,
                    $ai_latency: latencySeconds,
                    $ai_input_tokens: usageData?.inputTokens ?? null,
                    $ai_output_tokens: usageData?.outputTokens ?? null,
                    $ai_total_tokens: usageData?.totalTokens ?? null,
                    $ai_input_cost: inputCost,
                    $ai_output_cost: outputCost,
                    $ai_total_cost: inputCost + outputCost,
                    $ai_input: [
                        { role: "user", content: prompt.slice(0, 2000) },
                    ],
                    $ai_output_choices: [
                        {
                            role: "assistant",
                            content: rawResult.slice(0, 2000),
                        },
                    ],
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
    }

    if (intent === "accept") {
        const planStr = formData.get("plan")?.toString()
        if (!planStr)
            return dataWithError(null, "Geen plan gevonden om op te slaan.")

        try {
            const plan = JSON.parse(planStr)
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
                            console.warn(
                                `Fertilizer ${app.p_id_catalogue} not found in inventory, skipping.`,
                            )
                            continue
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
                `./rotation/fertilizer`,
                "Gerrit's plan is succesvol toegepast!",
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
    const { farm, farmOptions, defaultStrategies } =
        useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const navigation = useNavigation()

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

    const isGenerating =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "generate"

    const isSaving =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "accept"

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

    return (
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
                                isGenerating={isGenerating}
                                additionalContextValue={additionalContextValue}
                            />
                        ) : (
                            <SummaryCards
                                farmTotals={farmTotals}
                                planSummary={plan?.summary}
                                activeStrategyLabels={activeStrategyLabels}
                                onEditStrategy={() => setShowStrategyForm(true)}
                            />
                        )}
                    </div>

                    {/* ── Right column ── */}
                    <div className="lg:col-span-2 space-y-6">
                        {isGenerating ? (
                            <GerritLoading />
                        ) : plan ? (
                            <PlanTable
                                plan={plan}
                                isSaving={isSaving}
                                expandedRows={expandedRows}
                                toggleRow={toggleRow}
                            />
                        ) : (
                            <Card className="h-full min-h-100 flex flex-col items-center justify-center text-center p-12 text-muted-foreground border-dashed">
                                <div className="bg-primary/10 p-6 rounded-full mb-6">
                                    <Bot className="w-12 h-12 text-primary opacity-80" />
                                </div>
                                <h3 className="font-semibold text-xl text-foreground mb-3">
                                    Gerrit staat voor je klaar
                                </h3>
                                <p className="max-w-lg leading-relaxed text-muted-foreground">
                                    Selecteer aan de linkerkant de kaders voor
                                    jouw bedrijfsvoering. Gerrit berekent een
                                    integraal bemestingsplan voor het hele
                                    bedrijf, rekening houdend met
                                    gebruiksnormen, bodemvruchtbaarheid en
                                    agronomisch advies.
                                </p>
                            </Card>
                        )}
                    </div>
                </div>
            </FarmContent>
        </SidebarInset>
    )
}
