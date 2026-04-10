import { zodResolver } from "@hookform/resolvers/zod"
import {
    addFertilizerApplication,
    type Fertilizer,
    getFarms,
    getFertilizerApplications,
    getFertilizers,
    getFields,
    isDerogationGrantedForYear,
    isOrganicCertificationValid,
    removeFertilizerApplication,
} from "@nmi-agro/fdm-core"
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
import { GerritChat } from "~/components/blocks/gerrit/chat"
import { GerritIntentPanel } from "~/components/blocks/gerrit/intent-panel"
import { GerritReasoning } from "~/components/blocks/gerrit/reasoning"
import { ThinkingSteps } from "~/components/blocks/gerrit/thinking-steps"
import { GerritOnboarding } from "~/components/blocks/gerrit/onboarding"
import { PlanTable } from "~/components/blocks/gerrit/plan-table"
import {
    GerritFormSchema,
    STRATEGY_LABELS,
} from "~/components/blocks/gerrit/schema"
import { StrategyForm } from "~/components/blocks/gerrit/strategy-form"
import { SummaryCards } from "~/components/blocks/gerrit/summary-cards"
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
import {
    makeGerritSessionKey,
    serializeIntentAnswers,
    useGerritSession,
} from "~/store/gerrit-session"

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
    )

    const isDerogationFarm = await isDerogationGrantedForYear(
        fdm,
        session.principal_id,
        b_id_farm,
        Number.parseInt(calendar, 10),
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
    const isGerritEnabled =
        (await posthog?.isFeatureEnabled("gerrit", session.principal_id)) ??
        true
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
    const navigation = useNavigation()

    const supportedYears = ["2025", "2026"]
    const isSupportedYear = supportedYears.includes(calendar)
    const isGerritEnabled = useFeatureFlagEnabled("gerrit") ?? true

    const form = useRemixForm<z.infer<typeof GerritFormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(GerritFormSchema) as any,
        defaultValues: {
            ...defaultStrategies,
            reduceAmmoniaEmissions: false,
            keepNitrogenBalanceBelowTarget: false,
            workOnRotationLevel: false,
            additionalContext: "",
        },
    })

    const additionalContextValue = form.watch("additionalContext")

    const isSaving =
        navigation.state === "submitting" &&
        navigation.formData?.get("intent") === "accept"

    const {
        phase,
        intentQuestions,
        intentAnswers,
        thinkingSteps,
        messages,
        currentPlan,
        errorMessage,
        loadSession,
        startNewSession,
        setIntentQuestions,
        setIntentAnswer,
        addThinkingStep,
        clearThinkingSteps,
        setPlan,
        addMessage,
        updateLastAssistantMessage,
        setError,
        setPhase,
    } = useGerritSession()

    // Elapsed timer — counts seconds while generation is in progress
    const [elapsed, setElapsed] = useState(0)
    useEffect(() => {
        if (phase !== "generating") {
            setElapsed(0)
            return
        }
        const id = setInterval(() => setElapsed((s) => s + 1), 1000)
        return () => clearInterval(id)
    }, [phase])

    const sseAbortRef = useRef<AbortController | null>(null)

    // On farm/calendar change: activate the stored session (if any) and
    // auto-start intent loading only when there is no meaningful state to show.
    useEffect(() => {
        if (!isSupportedYear) return
        sseAbortRef.current?.abort()
        const { hadMeaningfulState } = loadSession(farm.b_id_farm, calendar)
        if (!hadMeaningfulState) {
            loadIntentQuestions()
        }
        // loadIntentQuestions is stable (useCallback with stable deps)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [farm.b_id_farm, calendar])

    const startGenerationRef = useRef<(() => void) | null>(null)

    const loadIntentQuestions = useCallback(async () => {
        // Capture key before the async call so we can guard stale responses
        const sessionKey = makeGerritSessionKey(farm.b_id_farm, calendar)
        startNewSession(farm.b_id_farm, calendar)
        const strategies = form.getValues()
        try {
            const resp = await fetch(
                `/api/gerrit/${farm.b_id_farm}/${calendar}/stream`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phase: "intent",
                        strategies: {
                            isOrganic: strategies.isOrganic,
                            fillManureSpace: strategies.fillManureSpace,
                            reduceAmmoniaEmissions:
                                strategies.reduceAmmoniaEmissions,
                            keepNitrogenBalanceBelowTarget:
                                strategies.keepNitrogenBalanceBelowTarget,
                            workOnRotationLevel: strategies.workOnRotationLevel,
                            isDerogation: strategies.isDerogation ?? false,
                        },
                        additionalContext: strategies.additionalContext,
                    }),
                },
            )
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
            const json = await resp.json()
            // Guard: discard result if user navigated to a different farm/calendar
            if (useGerritSession.getState().activeKey !== sessionKey) return
            setIntentQuestions(json.questions ?? [])
            if ((json.questions ?? []).length === 0) {
                // No questions needed — go straight to generation
                startGenerationRef.current?.()
            }
        } catch (err) {
            if (useGerritSession.getState().activeKey !== sessionKey) return
            setError(
                err instanceof Error
                    ? err.message
                    : "Kon vragen niet laden.",
            )
        }
    }, [farm.b_id_farm, calendar, form, startNewSession, setIntentQuestions, setError])

    const startGeneration = useCallback(async () => {
        if (sseAbortRef.current) sseAbortRef.current.abort()
        const ctrl = new AbortController()
        sseAbortRef.current = ctrl

        clearThinkingSteps()
        setPhase("generating")

        const strategies = form.getValues()
        const contextFromAnswers = serializeIntentAnswers(intentQuestions, intentAnswers)
        const additionalCtx = [strategies.additionalContext, contextFromAnswers]
            .filter(Boolean)
            .join("\n\n")

        try {
            const resp = await fetch(
                `/api/gerrit/${farm.b_id_farm}/${calendar}/stream`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: ctrl.signal,
                    body: JSON.stringify({
                        phase: "generate",
                        strategies: {
                            isOrganic: strategies.isOrganic,
                            fillManureSpace: strategies.fillManureSpace,
                            reduceAmmoniaEmissions:
                                strategies.reduceAmmoniaEmissions,
                            keepNitrogenBalanceBelowTarget:
                                strategies.keepNitrogenBalanceBelowTarget,
                            workOnRotationLevel: strategies.workOnRotationLevel,
                            isDerogation: strategies.isDerogation ?? false,
                        },
                        additionalContext: additionalCtx,
                    }),
                },
            )
            if (!resp.ok || !resp.body)
                throw new Error(`HTTP ${resp.status}`)

            const reader = resp.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n\n")
                buffer = lines.pop() ?? ""
                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue
                    const payload = line.slice(6).trim()
                    if (payload === "[DONE]") return
                    const event = JSON.parse(payload)
                    if (event.type === "thinking_step") {
                        addThinkingStep(event.step)
                    } else if (event.type === "plan_enriched") {
                        setPlan(event.plan)
                    } else if (event.type === "error") {
                        setError(event.message)
                    }
                }
            }
        } catch (err) {
            if ((err as Error)?.name !== "AbortError") {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Generatie mislukt.",
                )
            }
        }
    }, [farm.b_id_farm, calendar, form, intentQuestions, intentAnswers, clearThinkingSteps, setPhase, addThinkingStep, setPlan, setError])

    // Keep the ref in sync so loadIntentQuestions can call startGeneration without
    // creating a circular useCallback dependency
    startGenerationRef.current = startGeneration

    const sendFollowUp = useCallback(async (text: string) => {
        if (sseAbortRef.current) sseAbortRef.current.abort()
        const ctrl = new AbortController()
        sseAbortRef.current = ctrl

        addMessage({ role: "user", content: text, type: "question" })
        addMessage({ role: "assistant", content: "", type: "follow_up" })

        try {
            const resp = await fetch(
                `/api/gerrit/${farm.b_id_farm}/${calendar}/stream`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: ctrl.signal,
                    body: JSON.stringify({
                        phase: "follow_up",
                        message: text,
                        sessionId: useGerritSession.getState().sessionId,
                    }),
                },
            )
            if (!resp.ok || !resp.body)
                throw new Error(`HTTP ${resp.status}`)

            const reader = resp.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""
            let accumulated = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n\n")
                buffer = lines.pop() ?? ""
                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue
                    const payload = line.slice(6).trim()
                    if (payload === "[DONE]") return
                    const event = JSON.parse(payload)
                    if (event.type === "text_chunk") {
                        accumulated += event.text
                        updateLastAssistantMessage(accumulated)
                    } else if (event.type === "final_response") {
                        updateLastAssistantMessage(event.text)
                        setPhase("follow_up")
                    } else if (event.type === "error") {
                        updateLastAssistantMessage("Er ging iets mis: " + event.message)
                    }
                }
            }
        } catch (err) {
            if ((err as Error)?.name !== "AbortError") {
                updateLastAssistantMessage(
                    "Er ging iets mis bij het verwerken van je vraag.",
                )
            }
        }
    }, [farm.b_id_farm, calendar, addMessage, updateLastAssistantMessage, setPhase])

    useBeforeUnload(
        (event) => {
            if (phase === "generating") {
                event.preventDefault()
            }
        },
        { capture: true },
    )

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            phase === "generating" &&
            currentLocation.pathname !== nextLocation.pathname,
    )

    const [showStrategyForm, setShowStrategyForm] = useState(false)
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

    function toggleRow(b_id: string) {
        setExpandedRows((prev) => {
            const next = new Set(prev)
            next.has(b_id) ? next.delete(b_id) : next.add(b_id)
            return next
        })
    }

    const hasPlan = phase === "plan_ready" || phase === "follow_up"
    const isFollowUpStreaming =
        phase === "follow_up" &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "assistant" &&
        messages[messages.length - 1].content === ""

    const activeStrategyLabels = Object.entries(form.getValues())
        .filter(([k, v]) => v === true && k in STRATEGY_LABELS)
        .map(([k]) => STRATEGY_LABELS[k] ?? k)

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
                            {hasPlan && !showStrategyForm ? (
                                <SummaryCards
                                    farmTotals={
                                        currentPlan?.metrics?.farmTotals
                                    }
                                    planSummary={currentPlan?.summary}
                                    activeStrategyLabels={activeStrategyLabels}
                                    onEditStrategy={() =>
                                        setShowStrategyForm(true)
                                    }
                                    traceId={`gerrit-${farm.b_id_farm}-${calendar}`}
                                />
                            ) : (
                                <StrategyForm
                                    form={form as any}
                                    isGenerating={phase === "generating"}
                                    additionalContextValue={
                                        additionalContextValue
                                    }
                                    calendar={calendar}
                                />
                            )}
                        </div>

                        {/* ── Right column ── */}
                        <div className="lg:col-span-2 space-y-6">
                            {phase === "intent" || phase === "loading_intent" ? (
                                <GerritIntentPanel
                                    questions={intentQuestions}
                                    answers={intentAnswers}
                                    onAnswer={setIntentAnswer}
                                    onSubmit={startGeneration}
                                    onSkip={startGeneration}
                                    isLoading={phase === "loading_intent"}
                                />
                            ) : phase === "generating" ? (
                                <ThinkingSteps steps={thinkingSteps} isGenerating={phase === "generating"} elapsed={elapsed} />
                            ) : hasPlan && currentPlan ? (
                                <>
                                    {currentPlan.rawPlan.summary && (
                                        <GerritReasoning
                                            summary={currentPlan.rawPlan.summary}
                                            farmTotals={currentPlan.metrics?.farmTotals}
                                            activeStrategyLabels={activeStrategyLabels}
                                        />
                                    )}
                                    <PlanTable
                                        plan={currentPlan}
                                        isSaving={isSaving}
                                        expandedRows={expandedRows}
                                        toggleRow={toggleRow}
                                    />
                                    <GerritChat
                                        messages={messages}
                                        suggestedFollowUps={
                                            currentPlan.suggestedFollowUps
                                        }
                                        isStreaming={isFollowUpStreaming}
                                        onSendMessage={sendFollowUp}
                                    />
                                </>
                            ) : errorMessage ? (
                                <Card className="p-8 text-center border-destructive/30">
                                    <p className="text-destructive font-medium mb-4">
                                        {errorMessage}
                                    </p>
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            loadIntentQuestions()
                                        }
                                    >
                                        Opnieuw proberen
                                    </Button>
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
                                        Gerrit berekent een integraal
                                        bemestingsplan voor het hele bedrijf,
                                        rekening houdend met gebruiksnormen,
                                        bemestingsadvies en je voorkeuren.
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
