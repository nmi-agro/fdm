import { zodResolver } from "@hookform/resolvers/zod"
import {
    getFarms,
    isDerogationGrantedForYear,
    isOrganicCertificationValid,
    addFertilizerApplication,
    fromKgPerHa,
    getFertilizerApplications,
    getFertilizers,
    getFields,
    removeFertilizerApplication,
    type Fertilizer,
} from "@nmi-agro/fdm-core"
import type { ClarifyingQuestion } from "@nmi-agro/fdm-agents"
import { Bot } from "lucide-react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    redirect,
    useBeforeUnload,
    useBlocker,
    useLoaderData,
    useNavigation,
} from "react-router"
import { useRemixForm } from "remix-hook-form"
import { dataWithError, redirectWithSuccess } from "remix-toast"
import type { z } from "zod"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { ClarifyLoading } from "~/components/blocks/gerrit/clarify-loading"
import { GerritLoading } from "~/components/blocks/gerrit/loading"
import { GerritOnboarding } from "~/components/blocks/gerrit/onboarding"
import { PlanTable } from "~/components/blocks/gerrit/plan-table"
import {
    QuestionsForm,
    type ClarificationAnswerValue,
} from "~/components/blocks/gerrit/questions-form"
import {
    GEMINI_MODELS,
    GerritFormSchema,
    STRATEGY_LABELS,
} from "~/components/blocks/gerrit/schema"
import { StrategyForm } from "~/components/blocks/gerrit/strategy-form"
import { SummaryCards } from "~/components/blocks/gerrit/summary-cards"
import type { FarmTotals, ParsedPlan } from "~/components/blocks/gerrit/types"
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
import { clientConfig } from "~/lib/config"
import { fdm } from "~/lib/fdm.server"
import PostHogClient from "~/posthog.server"

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
        return redirect("/farm")
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
    ).catch(() => false)

    const isDerogationFarm = await isDerogationGrantedForYear(
        fdm,
        session.principal_id,
        b_id_farm,
        Number.parseInt(calendar, 10),
    ).catch(() => false)

    const farmFertilizers = await getFertilizers(fdm, session.principal_id, b_id_farm).catch(() => [])
    const fertilizerOptions = farmFertilizers.map((f: any) => ({
        p_id_catalogue: f.p_id_catalogue as string,
        p_name_nl: (f.p_name_nl ?? f.p_id_catalogue) as string,
        p_type: (f.p_type ?? "mineral") as "manure" | "mineral" | "compost",
    }))

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
        fertilizerOptions,
    }
}

export async function action({ request, params }: ActionFunctionArgs) {
    const session = await getSession(request)
    const b_id_farm = params.b_id_farm
    const timeframe = getTimeframe(params)
    const calendar = getCalendar(params)

    if (!b_id_farm) throw data("Missing farm ID", { status: 400 })

    const formData = await request.formData()
    const intent = formData.get("intent")

    const posthog = PostHogClient()

    // If Gerrit is explicitly disabled for this user reject the request
    let isGerritEnabled = false
    try {
        isGerritEnabled =
            (
                await posthog?.evaluateFlags(session.principal_id, {
                    flagKeys: ["gerrit"],
                })
            )?.isEnabled("gerrit") ?? false
    } catch {
        // PostHog unavailable — default to blocked (fail-closed)
    }
    if (!isGerritEnabled) {
        throw data(null, {
            status: 403,
            statusText: "Feature is not enabled for this user",
        })
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

                        const amount = fromKgPerHa(
                            app.p_app_amount,
                            fertilizer.p_app_amount_unit,
                            fertilizer.p_density,
                        )

                        if (amount === null) {
                            throw new Error(
                                `Meststof "${fertilizer.p_name_nl}" moet een waarde hebben voor zijn dichtheid.`,
                            )
                        }

                        const appDate = new Date(app.p_app_date)
                        if (Number.isNaN(appDate.getTime())) {
                            throw new Error(
                                `Ongeldige toepassingsdatum: ${app.p_app_date}`,
                            )
                        }

                        await addFertilizerApplication(
                            tx,
                            session.principal_id,
                            field.b_id,
                            fertilizer.p_id,
                            amount,
                            app.p_app_method,
                            appDate,
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
            const detail =
                e instanceof Error ? e.message.slice(0, 200) : "Onbekende fout"
            return dataWithError(null, `Fout bij opslaan: ${detail}`)
        }
    }

    return null
}

export default function GerritApp() {
    const { farm, farmOptions, defaultStrategies, calendar, fertilizerOptions } =
        useLoaderData<typeof loader>()
    const navigation = useNavigation()

    const supportedYears = ["2025", "2026"]
    const isSupportedYear = supportedYears.includes(calendar)
    const isGerritEnabled = useFeatureFlagEnabled("gerrit") ?? false

    // Phase state machine: idle → clarifying → questions → generating → (idle with plan)
    type Phase = "idle" | "clarifying" | "questions" | "generating"
    const [phase, setPhase] = useState<Phase>("idle")

    // Events for the active streaming phase (clarify or plan)
    const [events, setEvents] = useState<Array<{ type: string; data: any }>>([])
    const [planData, setPlanData] = useState<any>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // Clarify-phase state
    const [clarifyingQuestions, setClarifyingQuestions] = useState<ClarifyingQuestion[]>([])
    const [pendingFormData, setPendingFormData] = useState<z.infer<typeof GerritFormSchema> | null>(null)

    const eventSourceRef = useRef<EventSource | null>(null)

    const isAIGenerating = phase === "clarifying" || phase === "generating"

    const closeEventSource = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
    }, [])

    useEffect(() => () => closeEventSource(), [closeEventSource])

    const addEvent = useCallback((type: string, payload: any) => {
        setEvents((prev) => {
            if (
                type === "reasoning" &&
                prev.length > 0 &&
                prev[prev.length - 1].type === "reasoning"
            ) {
                const next = [...prev]
                const last = next[next.length - 1]
                next[next.length - 1] = {
                    type: "reasoning",
                    data: { chunk: (last.data?.chunk ?? "") + (payload?.chunk ?? "") },
                }
                return next
            }
            return [...prev, { type, data: payload }]
        })
    }, [])

    /** Builds the strategy+clarifications URL search params shared by both SSE endpoints */
    const buildSearchParams = useCallback(
        (
            formData: z.infer<typeof GerritFormSchema>,
            clarifications?: ClarificationAnswerValue[],
        ) => {
            const searchParams = new URLSearchParams()
            searchParams.set("b_id_farm", farm.b_id_farm)
            searchParams.set("calendar", calendar)
            Object.entries(formData).forEach(([key, value]) => {
                if (value === undefined) return
                if (key === "selectedFertilizerIds") {
                    // Serialise as JSON; skip if all fertilizers are selected (no restriction)
                    if (Array.isArray(value) && value.length < fertilizerOptions.length) {
                        searchParams.set(key, JSON.stringify(value))
                    }
                } else {
                    searchParams.set(key, String(value))
                }
            })
            if (clarifications && clarifications.length > 0) {
                const payload = clarifications.map((a) => ({
                    question: a.question,
                    selectedOptionLabels: a.selectedOptionLabels,
                    other: a.other,
                }))
                const json = JSON.stringify(payload)
                if (json.length <= 4000) searchParams.set("clarifications", json)
            }
            return searchParams
        },
        [farm.b_id_farm, calendar, fertilizerOptions.length],
    )

    /** Opens the plan-generation SSE stream */
    const startPlanStream = useCallback(
        (formData: z.infer<typeof GerritFormSchema>, clarifications?: ClarificationAnswerValue[]) => {
            closeEventSource()
            setEvents([])
            setPhase("generating")

            const searchParams = buildSearchParams(formData, clarifications)
            const es = new EventSource(`/api/gerrit/stream?${searchParams.toString()}`)
            eventSourceRef.current = es

            es.addEventListener("start", ((e: MessageEvent) => {
                try { addEvent("status", JSON.parse(e.data)) } catch {}
            }) as EventListener)
            es.addEventListener("reasoning", ((e: MessageEvent) => {
                try { addEvent("reasoning", JSON.parse(e.data)) } catch {}
            }) as EventListener)
            es.addEventListener("on_tool_start", ((e: MessageEvent) => {
                try { addEvent("on_tool_start", JSON.parse(e.data)) } catch {}
            }) as EventListener)
            es.addEventListener("on_tool_end", ((e: MessageEvent) => {
                try { addEvent("on_tool_end", JSON.parse(e.data)) } catch {}
            }) as EventListener)
            es.addEventListener("status", ((e: MessageEvent) => {
                try { addEvent("status", JSON.parse(e.data)) } catch {}
            }) as EventListener)
            es.addEventListener("complete", ((e: MessageEvent) => {
                try {
                    const payload = JSON.parse(e.data)
                    setPlanData({ plan: payload.plan, strategies: payload.strategies })
                } catch {}
                closeEventSource()
                setPhase("idle")
            }) as EventListener)
            es.addEventListener("error", ((e: MessageEvent) => {
                if ((e as any).data) {
                    try {
                        const payload = JSON.parse((e as any).data)
                        setErrorMessage(payload.message || "Gerrit kon geen plan genereren.")
                    } catch {
                        setErrorMessage("Gerrit kon geen plan genereren.")
                    }
                } else {
                    setErrorMessage("Verbinding met Gerrit verbroken.")
                }
                closeEventSource()
                setPhase("idle")
            }) as EventListener)
        },
        [addEvent, buildSearchParams, closeEventSource],
    )

    /** On form submit: start the clarify stream first */
    const handleSubmit = useCallback(
        async (formData: z.infer<typeof GerritFormSchema>) => {
            closeEventSource()
            setEvents([])
            setPlanData(null)
            setErrorMessage(null)
            setClarifyingQuestions([])
            setPendingFormData(formData)
            setPhase("clarifying")

            const searchParams = buildSearchParams(formData)
            const es = new EventSource(`/api/gerrit/clarify?${searchParams.toString()}`)
            eventSourceRef.current = es

            es.addEventListener("start", ((e: MessageEvent) => {
                try { addEvent("status", JSON.parse(e.data)) } catch {}
            }) as EventListener)
            es.addEventListener("reasoning", ((e: MessageEvent) => {
                try { addEvent("reasoning", JSON.parse(e.data)) } catch {}
            }) as EventListener)
            es.addEventListener("on_tool_start", ((e: MessageEvent) => {
                try { addEvent("on_tool_start", JSON.parse(e.data)) } catch {}
            }) as EventListener)
            es.addEventListener("on_tool_end", ((e: MessageEvent) => {
                try { addEvent("on_tool_end", JSON.parse(e.data)) } catch {}
            }) as EventListener)
            es.addEventListener("questions", ((e: MessageEvent) => {
                try {
                    const payload = JSON.parse(e.data)
                    const questions: ClarifyingQuestion[] = payload.questions ?? []
                    closeEventSource()
                    if (questions.length === 0) {
                        // No questions — go straight to plan
                        startPlanStream(formData)
                    } else {
                        setClarifyingQuestions(questions)
                        setPhase("questions")
                    }
                } catch {
                    // Parse error — degrade gracefully
                    closeEventSource()
                    startPlanStream(formData)
                }
            }) as EventListener)
            es.addEventListener("error", ((_e: Event) => {
                // Connection error during clarify — degrade gracefully
                closeEventSource()
                if (pendingFormData) startPlanStream(pendingFormData)
                else setPhase("idle")
            }) as EventListener)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [addEvent, buildSearchParams, closeEventSource, startPlanStream],
    )

    const form = useRemixForm<z.infer<typeof GerritFormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(GerritFormSchema) as any,
        defaultValues: {
            ...defaultStrategies,
            reduceAmmoniaEmissions: false,
            keepNitrogenBalanceBelowTarget: false,
            workOnRotationLevel: false,
            selectedFertilizerIds: fertilizerOptions.map((f) => f.p_id_catalogue) as any,
            additionalContext: "",
            geminiModel: GEMINI_MODELS[0].value,
        },
        submitHandlers: {
            onValid: handleSubmit,
        },
    })

    const additionalContextValue = form.watch("additionalContext")

    const isSaving =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "accept"

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

    // When the user confirms navigation away, close the stream
    useEffect(() => {
        if (blocker.state === "proceeding") {
            closeEventSource()
            setPhase("idle")
        }
    }, [blocker.state, closeEventSource])

    const plan = planData?.plan ?? null
    const strategies = planData?.strategies ?? null
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
                                    isGenerating={isAIGenerating || phase === "questions"}
                                    additionalContextValue={
                                        additionalContextValue
                                    }
                                    calendar={calendar}
                                    fertilizerOptions={fertilizerOptions}
                                />
                            ) : (
                                <SummaryCards
                                    farmTotals={farmTotals as FarmTotals | undefined}
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
                            {errorMessage ? (
                                <div className="bg-red-50 border border-red-200 p-8 rounded-xl text-center">
                                    <Bot className="w-12 h-12 text-red-600 mx-auto mb-4" />
                                    <h2 className="text-xl font-bold text-red-900 mb-2">Er is een fout opgetreden</h2>
                                    <p className="text-red-800">{errorMessage}</p>
                                    <Button onClick={() => setErrorMessage(null)} className="mt-4" variant="outline">
                                        Probeer opnieuw
                                    </Button>
                                </div>
                            ) : phase === "clarifying" ? (
                                <ClarifyLoading events={events} />
                            ) : phase === "questions" ? (
                                <QuestionsForm
                                    questions={clarifyingQuestions}
                                    onSubmit={(answers) => {
                                        if (pendingFormData) startPlanStream(pendingFormData, answers)
                                    }}
                                    onSkip={() => {
                                        if (pendingFormData) startPlanStream(pendingFormData)
                                    }}
                                />
                            ) : phase === "generating" ? (
                                <GerritLoading events={events} />
                            ) : plan ? (
                                <PlanTable
                                    plan={
                                        plan as ParsedPlan & { plan: import("~/components/blocks/gerrit/types").PlanRow[] }
                                    }
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
