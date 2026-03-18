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
} from "@nmi-agro/fdm-core"
import {
    createFunctionsForNorms,
    createFunctionsForFertilizerApplicationFilling,
    aggregateNormsToFarmLevel,
    aggregateNormFillingsToFarmLevel,
    getNutrientAdvice,
} from "@nmi-agro/fdm-calculator"
import {
    Info,
    Bot,
    CheckCircle2,
    Square,
    Circle,
    Triangle,
    Diamond,
    ChevronDown,
    ChevronUp,
    Pencil,
} from "lucide-react"
import { Fragment, useEffect, useRef, useState } from "react"
import { Controller } from "react-hook-form"
import {
    RemixFormProvider,
    useRemixForm,
    getValidatedFormData,
} from "remix-hook-form"
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
    Form,
} from "react-router"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import { z } from "zod"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Switch } from "~/components/ui/switch"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { SidebarInset } from "~/components/ui/sidebar"
import { Spinner } from "~/components/ui/spinner"
import { Progress } from "~/components/ui/progress"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { fdm } from "~/lib/fdm.server"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
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
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"

const GerritFormSchema = z.object({
    isOrganic: z.boolean(),
    fillManureSpace: z.boolean(),
    reduceAmmoniaEmissions: z.boolean(),
    keepNitrogenBalanceBelowTarget: z.boolean(),
    workOnRotationLevel: z.boolean(),
    additionalContext: z
        .string()
        .max(1000, "Maximaal 1000 karakters toegestaan.")
        .optional()
        .default(""),
    geminiModel: z.string().optional().default("gemini-3.1-pro-preview"),
})

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
    principalId: string,
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
    const fieldMetricsMap: Record<string, any> = {}

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
                        principalId as any,
                        field.b_id,
                    )
                    ;[manure, phosphate, nitrogen] = (await Promise.all([
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
                    ])) as any
                } catch (err) {
                    console.warn(
                        `[computePlanMetrics] Norm calc failed for ${field.b_id}:`,
                        err,
                    )
                }

                const syntheticApps = field.applications.map((app, i) => ({
                    p_id_catalogue: app.p_id_catalogue,
                    p_app_amount: app.p_app_amount,
                    p_app_date: new Date(app.p_app_date),
                    p_app_id: `plan-${field.b_id}-${i}`,
                    b_id: field.b_id,
                    p_app_method: null,
                }))

                let manureFilling = {
                    normFilling: 0,
                    applicationFilling: [] as any[],
                }
                let nitrogenFilling = {
                    normFilling: 0,
                    applicationFilling: [] as any[],
                }
                let phosphateFilling = {
                    normFilling: 0,
                    applicationFilling: [] as any[],
                }
                let eomSupplyPerHa = 0

                try {
                    const baseInput =
                        await fillingFuncs.collectInputForFertilizerApplicationFilling(
                            fdm,
                            principalId as any,
                            field.b_id,
                            phosphate.normValue,
                        )
                    const fillingInput = {
                        ...baseInput,
                        applications: syntheticApps as any,
                        fertilizers: fertilizers as any,
                    }
                    ;[manureFilling, nitrogenFilling, phosphateFilling] =
                        (await Promise.all([
                            Promise.resolve(
                                fillingFuncs.calculateFertilizerApplicationFillingForManure(
                                    fdm as any,
                                    fillingInput as any,
                                ),
                            ),
                            fillingFuncs.calculateFertilizerApplicationFillingForNitrogen(
                                fdm as any,
                                fillingInput as any,
                            ),
                            Promise.resolve(
                                fillingFuncs.calculateFertilizerApplicationFillingForPhosphate(
                                    fdm as any,
                                    fillingInput as any,
                                ),
                            ),
                        ])) as any
                } catch (err) {
                    console.warn(
                        `[computePlanMetrics] Filling calc failed for ${field.b_id}, fallback:`,
                        err,
                    )
                    let mFill = 0,
                        nFill = 0,
                        pFill = 0
                    for (const app of field.applications) {
                        const fert = fertilizers.find(
                            (f: any) => f.p_id_catalogue === app.p_id_catalogue,
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
                        (f: any) => f.p_id_catalogue === app.p_id_catalogue,
                    )
                    if (fert)
                        eomSupplyPerHa +=
                            (app.p_app_amount * (fert.p_eom ?? 0)) / 1000
                }

                // Compute K applied (kg K₂O/ha)
                let kFillPerHa = 0
                for (const app of field.applications) {
                    const fert = fertilizers.find(
                        (f: any) => f.p_id_catalogue === app.p_id_catalogue,
                    )
                    if (fert)
                        kFillPerHa +=
                            (app.p_app_amount * (fert.p_k_rt ?? 0)) / 1000
                }

                // Fetch NMI nutrient advice per field
                let advice = {} as any
                if (nmiApiKey && field.b_lu_catalogue) {
                    try {
                        const [fieldData, currentSoilData] = await Promise.all([
                            getField(fdm, principalId as any, field.b_id),
                            getCurrentSoilData(
                                fdm,
                                principalId as any,
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

                const proposedDose = calculateDose(
                    field.applications.map((app) => ({
                        p_id_catalogue: app.p_id_catalogue,
                        p_app_amount: app.p_app_amount,
                    })),
                    fertilizers as any,
                )

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
            receivedValues: defaultValues,
        } = await getValidatedFormData<z.infer<typeof GerritFormSchema>>(
            clonedRequest,
            zodResolver(GerritFormSchema),
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
        } catch (err: any) {
            return dataWithError(
                null,
                err?.message ?? "Gerrit kon geen plan genereren.",
            )
        }

        const firstBrace = rawResult.indexOf("{")
        const lastBrace = rawResult.lastIndexOf("}")
        if (firstBrace === -1 || lastBrace <= firstBrace)
            return dataWithError(
                null,
                "Gerrit gaf een onleesbaar antwoord. Probeer het opnieuw.",
            )

        let parsedPlan: any
        try {
            parsedPlan = JSON.parse(rawResult.slice(firstBrace, lastBrace + 1))
        } catch {
            return dataWithError(
                null,
                "Gerrit gaf een ongeldig plan terug. Probeer het opnieuw.",
            )
        }

        const enrichedPlan = fieldsData.map((fd) => {
            const proposedField = parsedPlan.plan?.find(
                (p: any) => p.b_id === fd.b_id,
            )
            return {
                b_id: fd.b_id,
                b_name: fd.b_name,
                b_lu_catalogue: fd.b_lu_catalogue,
                b_lu_name: fd.b_lu_name,
                b_lu_croprotation: fd.b_lu_croprotation,
                b_area: fd.b_area,
                applications: (proposedField?.applications || []).map(
                    (app: any) => {
                        const fert = fertilizers.find(
                            (f: any) => f.p_id_catalogue === app.p_id_catalogue,
                        )
                        return {
                            ...app,
                            p_name_nl: fert?.p_name_nl || app.p_id_catalogue,
                            p_type: fert?.p_type || "other",
                        }
                    },
                ),
                fieldMetrics: null as any,
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
                            (f: any) => f.p_id_catalogue === app.p_id_catalogue,
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
        } catch (e: any) {
            console.error("Save failed:", e)
            return dataWithError(null, "Fout bij opslaan: " + e.message)
        }
    }

    return null
}

function FertilizerIcon({ p_type }: { p_type: string }) {
    if (p_type === "manure")
        return (
            <Square className="size-3 text-yellow-600 fill-yellow-600 shrink-0" />
        )
    if (p_type === "mineral")
        return <Circle className="size-3 text-sky-600 fill-sky-600 shrink-0" />
    if (p_type === "compost")
        return (
            <Triangle className="size-3 text-green-600 fill-green-600 shrink-0" />
        )
    return <Diamond className="size-3 text-gray-500 fill-gray-500 shrink-0" />
}

function appUnit(p_type: string): string {
    if (p_type === "manure") return "m³/ha"
    if (p_type === "compost") return "t/ha"
    return "kg/ha"
}

function NormBar({
    label,
    filling,
    norm,
}: {
    label: string
    filling: number
    norm: number
}) {
    const pct = norm > 0 ? (filling / norm) * 100 : 0
    const over = filling > norm
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {label}
                </span>
                <span
                    className={`text-xs font-bold tabular-nums shrink-0 ${over ? "text-red-600" : "text-foreground"}`}
                >
                    {Math.round(filling)} / {Math.round(norm)} kg
                </span>
            </div>
            <Progress
                value={Math.min(pct, 100)}
                colorBar={over ? "red-500" : "green-500"}
                className="h-2"
            />
        </div>
    )
}

function GerritLoading() {
    const [elapsed, setElapsed] = useState(0)
    const startRef = useRef(Date.now())
    useEffect(() => {
        const id = setInterval(
            () =>
                setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
            1000,
        )
        return () => clearInterval(id)
    }, [])
    const elapsedStr =
        elapsed >= 60
            ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
            : `${elapsed}s`
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center justify-between text-base font-semibold">
                    <span className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-primary animate-pulse" />
                        Gerrit is aan het werk…
                    </span>
                    <span className="text-sm font-normal tabular-nums text-muted-foreground">
                        {elapsedStr}
                    </span>
                </CardTitle>
                <CardDescription>
                    Dit kan 2–5 minuten duren. Gerrit analyseert het bedrijf en
                    stelt het bemestingsplan op.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Spinner className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                        Gerrit is bezig. Dit kan enkele minuten duren,
                        afhankelijk van het gekozen model en de omvang van het
                        bedrijf.
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}

const columnHelper = createColumnHelper<any>()

const columns = [
    columnHelper.accessor("b_name", {
        header: "Perceel",
        cell: (info) => (
            <span className="font-medium text-foreground">
                {info.getValue()}
            </span>
        ),
    }),
    columnHelper.accessor("b_lu_name", {
        header: "Gewas",
        cell: (info) => {
            const row = info.row.original
            return (
                <Badge
                    style={{
                        backgroundColor: getCultivationColor(
                            row.b_lu_croprotation,
                        ),
                    }}
                    className="text-white text-xs font-normal"
                >
                    {info.getValue() || row.b_lu_catalogue}
                </Badge>
            )
        },
    }),
    columnHelper.accessor("b_area", {
        header: "Opp.",
        cell: (info) => {
            const ha = info.getValue()
            return (
                <span className="text-muted-foreground tabular-nums text-sm">
                    {ha == null
                        ? "—"
                        : ha < 0.1
                          ? "< 0.1 ha"
                          : `${ha.toFixed(1)} ha`}
                </span>
            )
        },
    }),
    columnHelper.accessor("applications", {
        header: "Bemestingsmaatregelen",
        cell: (info) => {
            const apps = (info.getValue() as any[])
                ?.slice()
                .sort(
                    (a, b) =>
                        new Date(a.p_app_date).getTime() -
                        new Date(b.p_app_date).getTime(),
                )
            if (!apps || apps.length === 0)
                return (
                    <Badge variant="outline" className="font-normal opacity-60">
                        Geen bemesting
                    </Badge>
                )
            return (
                <div className="flex flex-col gap-1.5">
                    {apps.map((app, i) => (
                        <Badge
                            key={i}
                            variant="outline"
                            className="gap-1.5 font-normal text-muted-foreground w-fit"
                        >
                            <FertilizerIcon p_type={app.p_type} />
                            <span className="font-medium text-foreground">
                                {app.p_name_nl}
                            </span>
                            <span className="tabular-nums">
                                {app.p_app_amount} {appUnit(app.p_type)}
                            </span>
                            <span className="text-muted-foreground/70">·</span>
                            <span>{app.p_app_date}</span>
                        </Badge>
                    ))}
                </div>
            )
        },
    }),
]

const STRATEGY_LABELS: Record<string, string> = {
    isOrganic: "Biologisch",
    fillManureSpace: "Max. mestplaatsing",
    reduceAmmoniaEmissions: "Emissiearme aanwending",
    keepNitrogenBalanceBelowTarget: "Doelsturing N",
    workOnRotationLevel: "Bouwplanniveau",
}

const GEMINI_MODELS = [
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (standaard)" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (snel)" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (stabiel)" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (zuinig)" },
    {
        value: "gemini-3.1-flash-lite-preview",
        label: "Gemini 3.1 Flash Lite (goedkoopst)",
    },
]

export default function GerritApp() {
    const { farm, farmOptions, defaultStrategies } =
        useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const navigation = useNavigation()
    const { b_id_farm, calendar } = useParams()

    const form = useRemixForm<z.infer<typeof GerritFormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(GerritFormSchema),
        defaultValues: {
            ...defaultStrategies,
            reduceAmmoniaEmissions: false,
            keepNitrogenBalanceBelowTarget: false,
            workOnRotationLevel: false,
            additionalContext: "",
            geminiModel: GEMINI_MODELS[0].value,
        },
    })

    const selectedModel = form.watch("geminiModel")
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

    const table = useReactTable({
        data: plan?.plan || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

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
                            <Card className="h-fit sticky top-6">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                                        <Bot className="w-6 h-6 text-primary" />
                                        Bedrijfsstrategie & voorkeuren
                                    </CardTitle>
                                    <CardDescription>
                                        Stel de kaders in waarbinnen Gerrit het
                                        optimale bemestingsplan berekent.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <RemixFormProvider {...form}>
                                        <Form
                                            method="post"
                                            className="space-y-8"
                                        >
                                            <input
                                                type="hidden"
                                                name="intent"
                                                value="generate"
                                            />
                                            <div className="space-y-6">
                                                {[
                                                    "isOrganic",
                                                    "fillManureSpace",
                                                    "reduceAmmoniaEmissions",
                                                    "keepNitrogenBalanceBelowTarget",
                                                    "workOnRotationLevel",
                                                ].map((name) => (
                                                    <div
                                                        key={name}
                                                        className="flex items-start justify-between gap-4"
                                                    >
                                                        <div className="space-y-1">
                                                            <Label
                                                                htmlFor={name}
                                                                className="text-base"
                                                            >
                                                                {
                                                                    STRATEGY_LABELS[
                                                                        name
                                                                    ]
                                                                }
                                                            </Label>
                                                            <p className="text-sm text-muted-foreground leading-snug">
                                                                {name ===
                                                                    "isOrganic" &&
                                                                    "Geen gebruik van minerale kunstmeststoffen."}
                                                                {name ===
                                                                    "fillManureSpace" &&
                                                                    "Volledig invullen van de gebruiksnorm voor dierlijke mest."}
                                                                {name ===
                                                                    "reduceAmmoniaEmissions" &&
                                                                    "Reductie van ammoniakemissies via optimale techniek."}
                                                                {name ===
                                                                    "keepNitrogenBalanceBelowTarget" &&
                                                                    "Stikstofoverschot beperken tot onder de doelwaarde."}
                                                                {name ===
                                                                    "workOnRotationLevel" &&
                                                                    "Percelen met hetzelfde gewas krijgen exact hetzelfde plan."}
                                                            </p>
                                                        </div>
                                                        <Controller
                                                            name={
                                                                name as keyof z.infer<
                                                                    typeof GerritFormSchema
                                                                >
                                                            }
                                                            control={
                                                                form.control
                                                            }
                                                            render={({
                                                                field,
                                                            }) => (
                                                                <Switch
                                                                    id={name}
                                                                    checked={
                                                                        field.value as boolean
                                                                    }
                                                                    onCheckedChange={
                                                                        field.onChange
                                                                    }
                                                                    className="mt-1"
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="space-y-3 pt-2">
                                                <div className="flex justify-between items-end">
                                                    <Label
                                                        htmlFor="additionalContext"
                                                        className="text-base"
                                                    >
                                                        Aanvullende opmerkingen
                                                        of wensen
                                                    </Label>
                                                    <span
                                                        className={`text-xs ${additionalContextValue?.length > 1000 ? "text-red-500 font-medium" : "text-muted-foreground"}`}
                                                    >
                                                        {additionalContextValue?.length ||
                                                            0}{" "}
                                                        / 1000
                                                    </span>
                                                </div>
                                                <Textarea
                                                    id="additionalContext"
                                                    placeholder="Bijv: Gebruik bij voorkeur eigen drijfmest op de huiskavel..."
                                                    className={`min-h-[100px] resize-none ${form.formState.errors.additionalContext ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                                    maxLength={1000}
                                                    {...form.register(
                                                        "additionalContext",
                                                    )}
                                                />
                                                {form.formState.errors
                                                    .additionalContext && (
                                                    <p className="text-sm text-red-500">
                                                        {
                                                            form.formState
                                                                .errors
                                                                .additionalContext
                                                                .message
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                            <div className="space-y-2 pt-2">
                                                <Label
                                                    htmlFor="geminiModel"
                                                    className="text-sm font-medium text-muted-foreground"
                                                >
                                                    AI-model
                                                </Label>
                                                <Controller
                                                    name="geminiModel"
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <Select
                                                            value={field.value}
                                                            onValueChange={
                                                                field.onChange
                                                            }
                                                        >
                                                            <SelectTrigger
                                                                id="geminiModel"
                                                                className="w-full text-sm"
                                                            >
                                                                <SelectValue />
                                                                <input
                                                                    type="hidden"
                                                                    name="geminiModel"
                                                                    value={
                                                                        field.value
                                                                    }
                                                                />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {GEMINI_MODELS.map(
                                                                    (m) => (
                                                                        <SelectItem
                                                                            key={
                                                                                m.value
                                                                            }
                                                                            value={
                                                                                m.value
                                                                            }
                                                                        >
                                                                            {
                                                                                m.label
                                                                            }
                                                                        </SelectItem>
                                                                    ),
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </div>
                                            <Button
                                                type="submit"
                                                className="w-full py-6 text-lg"
                                                disabled={isGenerating}
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <Spinner className="mr-3 h-5 w-5" />
                                                        Gerrit berekent het
                                                        plan...
                                                    </>
                                                ) : (
                                                    "Bemestingsplan genereren"
                                                )}
                                            </Button>
                                        </Form>
                                    </RemixFormProvider>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                {/* Farm-level norm compliance — first so users see compliance status immediately */}
                                {farmTotals && (
                                    <Card className="shadow-sm">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm font-semibold">
                                                Bedrijfsnormen
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Totale invulling op
                                                bedrijfsniveau (kg)
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <NormBar
                                                label="Dierlijke mest N"
                                                filling={
                                                    farmTotals.fillingKg
                                                        .animalManureN
                                                }
                                                norm={
                                                    farmTotals.normKg
                                                        .animalManureN
                                                }
                                            />
                                            <NormBar
                                                label="Werkzame stikstof N"
                                                filling={
                                                    farmTotals.fillingKg
                                                        .workableN
                                                }
                                                norm={
                                                    farmTotals.normKg.workableN
                                                }
                                            />
                                            <NormBar
                                                label="Fosfaat P₂O₅"
                                                filling={
                                                    farmTotals.fillingKg
                                                        .phosphate
                                                }
                                                norm={
                                                    farmTotals.normKg.phosphate
                                                }
                                            />
                                            {/* N-balance: overschot/tekort vs. norm */}
                                            {farmTotals.normKg.workableN > 0 &&
                                                (() => {
                                                    const surplus =
                                                        farmTotals.fillingKg
                                                            .workableN -
                                                        farmTotals.normKg
                                                            .workableN
                                                    const isOver = surplus > 0
                                                    return (
                                                        <div className="pt-2 border-t space-y-1.5">
                                                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                                                Stikstofbalans
                                                            </span>
                                                            <div className="flex justify-between items-baseline gap-2">
                                                                <span className="text-xs text-muted-foreground">
                                                                    Aanvoer
                                                                    werkzaam N
                                                                </span>
                                                                <span className="text-xs font-semibold tabular-nums">
                                                                    {Math.round(
                                                                        farmTotals
                                                                            .fillingKg
                                                                            .workableN,
                                                                    )}{" "}
                                                                    kg
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-baseline gap-2">
                                                                <span className="text-xs text-muted-foreground">
                                                                    Doelwaarde
                                                                    (norm)
                                                                </span>
                                                                <span className="text-xs font-semibold tabular-nums">
                                                                    {Math.round(
                                                                        farmTotals
                                                                            .normKg
                                                                            .workableN,
                                                                    )}{" "}
                                                                    kg
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-baseline gap-2 pt-0.5 border-t">
                                                                <span className="text-xs font-medium">
                                                                    {isOver
                                                                        ? "Overschot"
                                                                        : "Onderschrijding"}
                                                                </span>
                                                                <span
                                                                    className={`text-xs font-bold tabular-nums ${isOver ? "text-red-600" : "text-green-600"}`}
                                                                >
                                                                    {isOver
                                                                        ? "+"
                                                                        : ""}
                                                                    {Math.round(
                                                                        surplus,
                                                                    )}{" "}
                                                                    kg
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })()}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Gerrit's narrative summary */}
                                {plan?.summary && (
                                    <Card className="bg-primary/5 border-primary/20">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-primary">
                                                <Info className="w-4 h-4" />
                                                Toelichting van Gerrit
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground italic">
                                                "{plan.summary}"
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Compact strategy summary */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                                            <Bot className="w-5 h-5 text-primary" />
                                            Gehanteerde strategie
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {activeStrategyLabels.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {activeStrategyLabels.map(
                                                    (label) => (
                                                        <Badge
                                                            key={label}
                                                            variant="secondary"
                                                        >
                                                            {label}
                                                        </Badge>
                                                    ),
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                Geen specifieke strategie
                                                geselecteerd.
                                            </p>
                                        )}
                                    </CardContent>
                                    <CardFooter className="border-t pt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full gap-2"
                                            onClick={() =>
                                                setShowStrategyForm(true)
                                            }
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            Wijzig & herbereken
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </>
                        )}
                    </div>

                    {/* ── Right column ── */}
                    <div className="lg:col-span-2 space-y-6">
                        {isGenerating ? (
                            <GerritLoading />
                        ) : plan ? (
                            /* Plan table */
                            <Card className="shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Voorgesteld bemestingsplan
                                    </CardTitle>
                                    <CardDescription>
                                        Klik op een rij voor perceeldetails
                                        (normen, N-balans, organische
                                        stofbalans).
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="rounded-md border-y">
                                        <Table>
                                            <TableHeader className="bg-muted/30">
                                                {table
                                                    .getHeaderGroups()
                                                    .map((hg) => (
                                                        <TableRow key={hg.id}>
                                                            {hg.headers.map(
                                                                (h) => (
                                                                    <TableHead
                                                                        key={
                                                                            h.id
                                                                        }
                                                                        className="font-semibold"
                                                                    >
                                                                        {h.isPlaceholder
                                                                            ? null
                                                                            : flexRender(
                                                                                  h
                                                                                      .column
                                                                                      .columnDef
                                                                                      .header,
                                                                                  h.getContext(),
                                                                              )}
                                                                    </TableHead>
                                                                ),
                                                            )}
                                                            <TableHead className="w-8" />
                                                        </TableRow>
                                                    ))}
                                            </TableHeader>
                                            <TableBody>
                                                {table.getRowModel().rows
                                                    ?.length ? (
                                                    table
                                                        .getRowModel()
                                                        .rows.map((row) => {
                                                            const m =
                                                                row.original
                                                                    .fieldMetrics
                                                            const isExpanded =
                                                                expandedRows.has(
                                                                    row.original
                                                                        .b_id,
                                                                )
                                                            const hasMetrics =
                                                                m != null
                                                            return (
                                                                <Fragment
                                                                    key={row.id}
                                                                >
                                                                    <TableRow
                                                                        className={`hover:bg-muted/20 transition-colors ${hasMetrics ? "cursor-pointer" : ""}`}
                                                                        onClick={() =>
                                                                            hasMetrics &&
                                                                            toggleRow(
                                                                                row
                                                                                    .original
                                                                                    .b_id,
                                                                            )
                                                                        }
                                                                    >
                                                                        {row
                                                                            .getVisibleCells()
                                                                            .map(
                                                                                (
                                                                                    cell,
                                                                                ) => (
                                                                                    <TableCell
                                                                                        key={
                                                                                            cell.id
                                                                                        }
                                                                                        className="py-3"
                                                                                    >
                                                                                        {flexRender(
                                                                                            cell
                                                                                                .column
                                                                                                .columnDef
                                                                                                .cell,
                                                                                            cell.getContext(),
                                                                                        )}
                                                                                    </TableCell>
                                                                                ),
                                                                            )}
                                                                        <TableCell className="py-3">
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                {hasMetrics &&
                                                                                    m.advice &&
                                                                                    (() => {
                                                                                        const hasAdvice =
                                                                                            m
                                                                                                .advice
                                                                                                .d_n_req >
                                                                                                0 ||
                                                                                            m
                                                                                                .advice
                                                                                                .d_p_req >
                                                                                                0 ||
                                                                                            m
                                                                                                .advice
                                                                                                .d_k_req >
                                                                                                0
                                                                                        if (
                                                                                            !hasAdvice
                                                                                        )
                                                                                            return null

                                                                                        const badges =
                                                                                            [
                                                                                                {
                                                                                                    key: "N",
                                                                                                    fill:
                                                                                                        m
                                                                                                            .proposedDose
                                                                                                            ?.p_dose_n ??
                                                                                                        0,
                                                                                                    ref: m
                                                                                                        .advice
                                                                                                        .d_n_req,
                                                                                                },
                                                                                                {
                                                                                                    key: "P",
                                                                                                    fill:
                                                                                                        m
                                                                                                            .proposedDose
                                                                                                            ?.p_dose_p ??
                                                                                                        0,
                                                                                                    ref: m
                                                                                                        .advice
                                                                                                        .d_p_req,
                                                                                                },
                                                                                                {
                                                                                                    key: "K",
                                                                                                    fill:
                                                                                                        m
                                                                                                            .proposedDose
                                                                                                            ?.p_dose_k ??
                                                                                                        0,
                                                                                                    ref: m
                                                                                                        .advice
                                                                                                        .d_k_req,
                                                                                                },
                                                                                            ]
                                                                                        return badges.map(
                                                                                            ({
                                                                                                key,
                                                                                                fill,
                                                                                                ref,
                                                                                            }) => {
                                                                                                if (
                                                                                                    ref <=
                                                                                                    0
                                                                                                )
                                                                                                    return null
                                                                                                const pct =
                                                                                                    Math.round(
                                                                                                        (fill /
                                                                                                            ref) *
                                                                                                            100,
                                                                                                    )
                                                                                                const over =
                                                                                                    fill >
                                                                                                    ref
                                                                                                return (
                                                                                                    <span
                                                                                                        key={
                                                                                                            key
                                                                                                        }
                                                                                                        title={`Advies: ${Math.round(ref)} kg/ha`}
                                                                                                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${over ? "bg-red-100 text-red-700" : pct >= 80 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}
                                                                                                    >
                                                                                                        {
                                                                                                            key
                                                                                                        }{" "}
                                                                                                        {
                                                                                                            pct
                                                                                                        }
                                                                                                        %
                                                                                                    </span>
                                                                                                )
                                                                                            },
                                                                                        )
                                                                                    })()}
                                                                                {hasMetrics &&
                                                                                    (isExpanded ? (
                                                                                        <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                                                                                    ) : (
                                                                                        <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
                                                                                    ))}
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                    {isExpanded &&
                                                                        hasMetrics && (
                                                                            <TableRow className="bg-muted/10 hover:bg-muted/10">
                                                                                <TableCell
                                                                                    colSpan={
                                                                                        columns.length +
                                                                                        1
                                                                                    }
                                                                                    className="py-4 px-6"
                                                                                >
                                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
                                                                                        {m.normsFilling &&
                                                                                            m.norms && (
                                                                                                <div className="space-y-2">
                                                                                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                                                                        Normen
                                                                                                        (kg/ha)
                                                                                                    </p>
                                                                                                    {[
                                                                                                        {
                                                                                                            label: "Dierlijke mest N",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .normsFilling
                                                                                                                    .manure
                                                                                                                    ?.normFilling ??
                                                                                                                0,
                                                                                                            norm:
                                                                                                                m
                                                                                                                    .norms
                                                                                                                    .manure
                                                                                                                    ?.normValue ??
                                                                                                                0,
                                                                                                        },
                                                                                                        {
                                                                                                            label: "Werkzame N",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .normsFilling
                                                                                                                    .nitrogen
                                                                                                                    ?.normFilling ??
                                                                                                                0,
                                                                                                            norm:
                                                                                                                m
                                                                                                                    .norms
                                                                                                                    .nitrogen
                                                                                                                    ?.normValue ??
                                                                                                                0,
                                                                                                        },
                                                                                                        {
                                                                                                            label: "Fosfaat P₂O₅",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .normsFilling
                                                                                                                    .phosphate
                                                                                                                    ?.normFilling ??
                                                                                                                0,
                                                                                                            norm:
                                                                                                                m
                                                                                                                    .norms
                                                                                                                    .phosphate
                                                                                                                    ?.normValue ??
                                                                                                                0,
                                                                                                        },
                                                                                                    ].map(
                                                                                                        ({
                                                                                                            label,
                                                                                                            fill,
                                                                                                            norm,
                                                                                                        }) => (
                                                                                                            <div
                                                                                                                key={
                                                                                                                    label
                                                                                                                }
                                                                                                                className="space-y-1"
                                                                                                            >
                                                                                                                <div className="flex justify-between text-xs">
                                                                                                                    <span className="text-muted-foreground">
                                                                                                                        {
                                                                                                                            label
                                                                                                                        }
                                                                                                                    </span>
                                                                                                                    <span
                                                                                                                        className={`tabular-nums font-medium ${fill > norm ? "text-red-600" : "text-foreground"}`}
                                                                                                                    >
                                                                                                                        {Math.round(
                                                                                                                            fill,
                                                                                                                        )}{" "}
                                                                                                                        /{" "}
                                                                                                                        {Math.round(
                                                                                                                            norm,
                                                                                                                        )}
                                                                                                                    </span>
                                                                                                                </div>
                                                                                                                <Progress
                                                                                                                    value={Math.min(
                                                                                                                        norm >
                                                                                                                            0
                                                                                                                            ? (fill /
                                                                                                                                  norm) *
                                                                                                                                  100
                                                                                                                            : 0,
                                                                                                                        100,
                                                                                                                    )}
                                                                                                                    colorBar={
                                                                                                                        fill >
                                                                                                                        norm
                                                                                                                            ? "red-500"
                                                                                                                            : "green-500"
                                                                                                                    }
                                                                                                                    className="h-1.5"
                                                                                                                />
                                                                                                            </div>
                                                                                                        ),
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        {m.nBalance && (
                                                                                            <div className="space-y-2">
                                                                                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                                                                    Stikstofbalans
                                                                                                </p>
                                                                                                <div className="flex justify-between text-sm items-center">
                                                                                                    <span className="text-muted-foreground">
                                                                                                        Balans
                                                                                                        vs.
                                                                                                        doel
                                                                                                    </span>
                                                                                                    <span
                                                                                                        className={`font-semibold tabular-nums ${m.nBalance.balance <= m.nBalance.target ? "text-green-600" : "text-amber-600"}`}
                                                                                                    >
                                                                                                        {Math.round(
                                                                                                            m
                                                                                                                .nBalance
                                                                                                                .balance,
                                                                                                        )}{" "}
                                                                                                        /{" "}
                                                                                                        {Math.round(
                                                                                                            m
                                                                                                                .nBalance
                                                                                                                .target,
                                                                                                        )}{" "}
                                                                                                        kg
                                                                                                        N/ha
                                                                                                    </span>
                                                                                                </div>
                                                                                                <Progress
                                                                                                    value={Math.min(
                                                                                                        m
                                                                                                            .nBalance
                                                                                                            .target >
                                                                                                            0
                                                                                                            ? (m
                                                                                                                  .nBalance
                                                                                                                  .balance /
                                                                                                                  m
                                                                                                                      .nBalance
                                                                                                                      .target) *
                                                                                                                  100
                                                                                                            : 0,
                                                                                                        100,
                                                                                                    )}
                                                                                                    colorBar={
                                                                                                        m
                                                                                                            .nBalance
                                                                                                            .balance <=
                                                                                                        m
                                                                                                            .nBalance
                                                                                                            .target
                                                                                                            ? "green-500"
                                                                                                            : "amber-500"
                                                                                                    }
                                                                                                    className="h-1.5"
                                                                                                />
                                                                                            </div>
                                                                                        )}
                                                                                        {(m.eomSupplyPerHa !=
                                                                                            null ||
                                                                                            m.omBalance !=
                                                                                                null) && (
                                                                                            <div className="space-y-2">
                                                                                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                                                                    Effectieve
                                                                                                    organische
                                                                                                    stof
                                                                                                </p>
                                                                                                <div className="flex justify-between items-center text-sm">
                                                                                                    <span className="text-muted-foreground">
                                                                                                        Aanvoer
                                                                                                        EOM
                                                                                                        (kg/ha)
                                                                                                    </span>
                                                                                                    <span
                                                                                                        className={`font-semibold tabular-nums ${(m.eomSupplyPerHa ?? m.omBalance ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                                                                                                    >
                                                                                                        {(m.eomSupplyPerHa ??
                                                                                                            m.omBalance ??
                                                                                                            0) >
                                                                                                        0
                                                                                                            ? "+"
                                                                                                            : ""}
                                                                                                        {Math.round(
                                                                                                            m.eomSupplyPerHa ??
                                                                                                                m.omBalance ??
                                                                                                                0,
                                                                                                        )}{" "}
                                                                                                        kg
                                                                                                    </span>
                                                                                                </div>
                                                                                                <p className="text-xs text-muted-foreground">
                                                                                                    EOM-aanvoer
                                                                                                    via
                                                                                                    meststoffen
                                                                                                    in
                                                                                                    het
                                                                                                    voorgestelde
                                                                                                    plan
                                                                                                </p>
                                                                                            </div>
                                                                                        )}
                                                                                        {m.advice &&
                                                                                            m.proposedDose &&
                                                                                            (() => {
                                                                                                const otherNutrients =
                                                                                                    [
                                                                                                        {
                                                                                                            key: "S",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .proposedDose
                                                                                                                    .p_dose_s ??
                                                                                                                0,
                                                                                                            ref:
                                                                                                                m
                                                                                                                    .advice
                                                                                                                    .d_s_req ??
                                                                                                                0,
                                                                                                        },
                                                                                                        {
                                                                                                            key: "Mg",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .proposedDose
                                                                                                                    .p_dose_mg ??
                                                                                                                0,
                                                                                                            ref:
                                                                                                                m
                                                                                                                    .advice
                                                                                                                    .d_mg_req ??
                                                                                                                0,
                                                                                                        },
                                                                                                        {
                                                                                                            key: "Ca",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .proposedDose
                                                                                                                    .p_dose_ca ??
                                                                                                                0,
                                                                                                            ref:
                                                                                                                m
                                                                                                                    .advice
                                                                                                                    .d_ca_req ??
                                                                                                                0,
                                                                                                        },
                                                                                                        {
                                                                                                            key: "Na",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .proposedDose
                                                                                                                    .p_dose_na ??
                                                                                                                0,
                                                                                                            ref:
                                                                                                                m
                                                                                                                    .advice
                                                                                                                    .d_na_req ??
                                                                                                                0,
                                                                                                        },
                                                                                                        {
                                                                                                            key: "Cu",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .proposedDose
                                                                                                                    .p_dose_cu ??
                                                                                                                0,
                                                                                                            ref:
                                                                                                                m
                                                                                                                    .advice
                                                                                                                    .d_cu_req ??
                                                                                                                0,
                                                                                                        },
                                                                                                        {
                                                                                                            key: "Zn",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .proposedDose
                                                                                                                    .p_dose_zn ??
                                                                                                                0,
                                                                                                            ref:
                                                                                                                m
                                                                                                                    .advice
                                                                                                                    .d_zn_req ??
                                                                                                                0,
                                                                                                        },
                                                                                                        {
                                                                                                            key: "B",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .proposedDose
                                                                                                                    .p_dose_b ??
                                                                                                                0,
                                                                                                            ref:
                                                                                                                m
                                                                                                                    .advice
                                                                                                                    .d_b_req ??
                                                                                                                0,
                                                                                                        },
                                                                                                        {
                                                                                                            key: "Mn",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .proposedDose
                                                                                                                    .p_dose_mn ??
                                                                                                                0,
                                                                                                            ref:
                                                                                                                m
                                                                                                                    .advice
                                                                                                                    .d_mn_req ??
                                                                                                                0,
                                                                                                        },
                                                                                                        {
                                                                                                            key: "Mo",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .proposedDose
                                                                                                                    .p_dose_mo ??
                                                                                                                0,
                                                                                                            ref:
                                                                                                                m
                                                                                                                    .advice
                                                                                                                    .d_mo_req ??
                                                                                                                0,
                                                                                                        },
                                                                                                        {
                                                                                                            key: "Co",
                                                                                                            fill:
                                                                                                                m
                                                                                                                    .proposedDose
                                                                                                                    .p_dose_co ??
                                                                                                                0,
                                                                                                            ref:
                                                                                                                m
                                                                                                                    .advice
                                                                                                                    .d_co_req ??
                                                                                                                0,
                                                                                                        },
                                                                                                    ].filter(
                                                                                                        (
                                                                                                            n,
                                                                                                        ) =>
                                                                                                            n.ref >
                                                                                                            0,
                                                                                                    )

                                                                                                if (
                                                                                                    otherNutrients.length ===
                                                                                                    0
                                                                                                )
                                                                                                    return null

                                                                                                return (
                                                                                                    <div className="space-y-2">
                                                                                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                                                                            Overige
                                                                                                            Nutriënten
                                                                                                        </p>
                                                                                                        <div className="flex flex-wrap gap-1.5">
                                                                                                            {otherNutrients.map(
                                                                                                                ({
                                                                                                                    key,
                                                                                                                    fill,
                                                                                                                    ref,
                                                                                                                }) => {
                                                                                                                    const pct =
                                                                                                                        Math.round(
                                                                                                                            (fill /
                                                                                                                                ref) *
                                                                                                                                100,
                                                                                                                        )
                                                                                                                    const over =
                                                                                                                        fill >
                                                                                                                        ref
                                                                                                                    return (
                                                                                                                        <span
                                                                                                                            key={
                                                                                                                                key
                                                                                                                            }
                                                                                                                            title={`Advies: ${Math.round(ref)} kg/ha, Aangevoerd: ${Math.round(fill)} kg/ha`}
                                                                                                                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${over ? "bg-red-100 text-red-700" : pct >= 80 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}
                                                                                                                        >
                                                                                                                            {
                                                                                                                                key
                                                                                                                            }{" "}
                                                                                                                            {
                                                                                                                                pct
                                                                                                                            }
                                                                                                                            %
                                                                                                                        </span>
                                                                                                                    )
                                                                                                                },
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )
                                                                                            })()}
                                                                                    </div>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        )}
                                                                </Fragment>
                                                            )
                                                        })
                                                ) : (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={
                                                                columns.length +
                                                                1
                                                            }
                                                            className="h-32 text-center text-muted-foreground"
                                                        >
                                                            Geen percelen
                                                            gevonden om te
                                                            bemesten.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-end gap-4 border-t p-6 bg-muted/5">
                                    <Form method="post">
                                        <input
                                            type="hidden"
                                            name="intent"
                                            value="accept"
                                        />
                                        <input
                                            type="hidden"
                                            name="plan"
                                            value={JSON.stringify(plan)}
                                        />
                                        <Button
                                            type="submit"
                                            size="lg"
                                            className="px-8"
                                            disabled={isSaving}
                                        >
                                            {isSaving ? (
                                                <Spinner className="mr-2" />
                                            ) : (
                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                            )}
                                            Plan definitief maken en toepassen
                                        </Button>
                                    </Form>
                                </CardFooter>
                            </Card>
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
