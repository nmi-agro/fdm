import type { ClarifyingQuestion } from "@nmi-agro/fdm-agents"
import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  addFertilizerApplication,
  type Fertilizer,
  fromKgPerHa,
  getFarms,
  getFertilizerApplications,
  getFertilizers,
  getFields,
  isDerogationGrantedForYear,
  isOrganicCertificationValid,
  removeFertilizerApplication,
} from "@nmi-agro/fdm-core"
import { Bot, FlaskConical } from "lucide-react"
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
import type { FarmTotals, ParsedPlan } from "~/components/blocks/gerrit/types"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { ClarifyLoading } from "~/components/blocks/gerrit/clarify-loading"
import { GerritLoading } from "~/components/blocks/gerrit/loading"
import { PlanTable } from "~/components/blocks/gerrit/plan-table"
import {
  type ClarificationAnswerValue,
  QuestionsForm,
} from "~/components/blocks/gerrit/questions-form"
import { GerritFormSchema, STRATEGY_LABELS } from "~/components/blocks/gerrit/schema"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { fdm } from "~/lib/fdm.server"
import { getGerritUsage } from "~/lib/gerrit-limit.server"
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

  const gerritUsage = await getGerritUsage(session.principal_id)

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
    gerritUsage: {
      limit: gerritUsage.limit === Number.POSITIVE_INFINITY ? null : gerritUsage.limit,
      used: gerritUsage.used,
      remaining: gerritUsage.remaining === Number.POSITIVE_INFINITY ? null : gerritUsage.remaining,
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
    const planEntry = formData.get("plan")
    const planStr = typeof planEntry === "string" ? planEntry : null
    if (!planStr) return dataWithError(null, "Geen plan gevonden om op te slaan.")

    try {
      const plan = JSON.parse(planStr)
      if (!plan?.plan || !Array.isArray(plan.plan)) {
        return dataWithError(null, "Ongeldig bemestingsplan.")
      }
      const fertilizers = await getFertilizers(fdm, session.principal_id, b_id_farm)

      // Overwrite existing applications for the timeframe
      const rawFields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)

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
                removeFertilizerApplication(tx, session.principal_id, app.p_app_id),
              ),
            )
          }),
        )

        // 2. Add the proposed ones
        for (const field of plan.plan) {
          for (const app of field.applications) {
            const fertilizer = fertilizers.find(
              (f: Fertilizer) => f.p_id_catalogue === app.p_id_catalogue,
            )
            if (!fertilizer) {
              throw new Error(`Meststof ${app.p_id_catalogue} niet gevonden in inventaris.`)
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
              throw new Error(`Ongeldige toepassingsdatum: ${app.p_app_date}`)
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
      const detail = e instanceof Error ? e.message.slice(0, 200) : "Onbekende fout"
      return dataWithError(null, `Fout bij opslaan: ${detail}`)
    }
  }

  return null
}

export default function GerritApp() {
  const { farm, farmOptions, defaultStrategies, calendar, fertilizerOptions, gerritUsage } =
    useLoaderData<typeof loader>()
  const navigation = useNavigation()

  const headerAction = {
    to: `/farm/${farm.b_id_farm}`,
    label: "Terug naar bedrijf",
    disabled: false,
  }

  const supportedYears = ["2025", "2026"]
  const isSupportedYear = supportedYears.includes(calendar)
  const isGerritEnabled = useFeatureFlagEnabled("gerrit") ?? false

  // Optimistic usage counter: increments when generation starts, reverts on
  // error. This makes the counter immediately reflect an in-flight request
  // without waiting for PostHog ingestion + page reload.
  const [optimisticUsed, setOptimisticUsed] = useState(gerritUsage.used)

  // Phase state machine: idle → clarifying → questions → generating → (idle with plan)
  type Phase = "idle" | "clarifying" | "questions" | "generating"
  const [phase, setPhase] = useState<Phase>("idle")

  // Events for the active streaming phase (clarify or plan)
  const [events, setEvents] = useState<Array<{ type: string; data: any }>>([])
  const [planData, setPlanData] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Clarify-phase state
  const [clarifyingQuestions, setClarifyingQuestions] = useState<ClarifyingQuestion[]>([])
  const [pendingFormData, setPendingFormData] = useState<z.infer<typeof GerritFormSchema> | null>(
    null,
  )

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
      if (type === "reasoning" && prev.length > 0 && prev[prev.length - 1].type === "reasoning") {
        const next = [...prev]
        const last = next[next.length - 1]
        next[next.length - 1] = {
          type: "reasoning",
          data: {
            chunk: (last.data?.chunk ?? "") + (payload?.chunk ?? ""),
          },
        }
        return next
      }
      return [...prev, { type, data: payload }]
    })
  }, [])

  /** Builds the strategy+clarifications URL search params shared by both SSE endpoints */
  const buildSearchParams = useCallback(
    (formData: z.infer<typeof GerritFormSchema>, clarifications?: ClarificationAnswerValue[]) => {
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
        if (json.length > 4000) {
          throw new Error(
            "De antwoorden zijn te lang om te versturen. Verkort uw antwoorden en probeer opnieuw.",
          )
        }
        searchParams.set("clarifications", json)
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

      // Optimistically count this attempt immediately so the counter
      // reflects the in-flight request. Reverted on error/abort.
      setOptimisticUsed((n) => n + 1)

      const searchParams = (() => {
        try {
          return buildSearchParams(formData, clarifications)
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : "Gerrit kon geen plan genereren.")
          setOptimisticUsed((n) => Math.max(0, n - 1))
          setPhase("idle")
          return null
        }
      })()
      if (!searchParams) return
      const es = new EventSource(`/api/gerrit/stream?${searchParams.toString()}`)
      eventSourceRef.current = es

      es.addEventListener("start", ((e: MessageEvent) => {
        try {
          addEvent("status", JSON.parse(e.data))
        } catch {}
      }) as EventListener)
      es.addEventListener("reasoning", ((e: MessageEvent) => {
        try {
          addEvent("reasoning", JSON.parse(e.data))
        } catch {}
      }) as EventListener)
      es.addEventListener("on_tool_start", ((e: MessageEvent) => {
        try {
          addEvent("on_tool_start", JSON.parse(e.data))
        } catch {}
      }) as EventListener)
      es.addEventListener("on_tool_end", ((e: MessageEvent) => {
        try {
          addEvent("on_tool_end", JSON.parse(e.data))
        } catch {}
      }) as EventListener)
      es.addEventListener("status", ((e: MessageEvent) => {
        try {
          addEvent("status", JSON.parse(e.data))
        } catch {}
      }) as EventListener)
      es.addEventListener("complete", ((e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data)
          if (!payload.plan || !payload.strategies) {
            throw new Error("Incomplete payload")
          }
          setPlanData({
            plan: payload.plan,
            strategies: payload.strategies,
          })
          closeEventSource()
          setPhase("idle")
        } catch {
          setErrorMessage("Gerrit kon geen plan genereren.")
          closeEventSource()
          setPhase("idle")
        }
      }) as EventListener)
      es.addEventListener("error", ((e: MessageEvent) => {
        // Revert the optimistic increment — this run didn't count.
        setOptimisticUsed((n) => Math.max(0, n - 1))
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
        try {
          addEvent("status", JSON.parse(e.data))
        } catch {}
      }) as EventListener)
      es.addEventListener("reasoning", ((e: MessageEvent) => {
        try {
          addEvent("reasoning", JSON.parse(e.data))
        } catch {}
      }) as EventListener)
      es.addEventListener("on_tool_start", ((e: MessageEvent) => {
        try {
          addEvent("on_tool_start", JSON.parse(e.data))
        } catch {}
      }) as EventListener)
      es.addEventListener("on_tool_end", ((e: MessageEvent) => {
        try {
          addEvent("on_tool_end", JSON.parse(e.data))
        } catch {}
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
        startPlanStream(formData)
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
      selectedFertilizerIds:
        fertilizerOptions.length > 0
          ? (fertilizerOptions.map((f) => f.p_id_catalogue) as any)
          : undefined,
      additionalContext: "",
      geminiModel: "gemini-3.5-flash",
    },
    submitHandlers: {
      onValid: handleSubmit,
    },
  })

  const additionalContextValue = form.watch("additionalContext")

  const isSaving =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "accept"

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
      isAIGenerating && currentLocation.pathname !== nextLocation.pathname,
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

  const isRateLimited =
    gerritUsage.limit !== null && optimisticUsed >= (gerritUsage.limit ?? Number.POSITIVE_INFINITY)

  const [showStrategyForm, setShowStrategyForm] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (plan) setShowStrategyForm(false)
  }, [plan])

  function toggleRow(b_id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(b_id)) {
        next.delete(b_id)
      } else {
        next.add(b_id)
      }
      return next
    })
  }

  const activeStrategyLabels = strategies
    ? Object.entries(strategies)
        .filter(([, v]) => v === true)
        .map(([k]) => STRATEGY_LABELS[k] ?? k)
    : []

  const [showInfoDialog, setShowInfoDialog] = useState(false)

  const blockerDialog = (
    <AlertDialog open={blocker.state === "blocked"}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Wil je de berekening annuleren?</AlertDialogTitle>
          <AlertDialogDescription>
            Gerrit is momenteel een bemestingsplan voor je aan het berekenen. Als je nu weg
            navigeert, wordt de berekening gestopt.
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
        <Header action={headerAction}>
          <HeaderFarm b_id_farm={farm.b_id_farm} farmOptions={farmOptions} />
        </Header>
        <FarmContent>
          <div className="mx-auto mt-20 max-w-2xl space-y-6 text-center">
            <div className="bg-primary/10 border-primary/20 rounded-xl border p-8">
              <Bot className="text-primary mx-auto mb-4 h-12 w-12" />
              <h2 className="text-foreground mb-2 text-2xl font-bold">
                Gerrit is nog niet beschikbaar voor je.
              </h2>
              <p className="text-muted-foreground mb-6">
                Gerrit is momenteel in ontwikkeling en is nog niet voor iedereen beschikbaar. We
                zijn de functionaliteit aan het testen met een selecte groep gebruikers. Als je
                interesse of vragen over Gerrit, neem dan contact op met Ondersteuning.
              </p>
            </div>
          </div>
        </FarmContent>
      </SidebarInset>
    )
  }

  if (!isSupportedYear) {
    return (
      <>
        <SidebarInset>
          <Header action={headerAction}>
            <HeaderFarm b_id_farm={farm.b_id_farm} farmOptions={farmOptions} />
          </Header>
          <FarmContent>
            <div className="mx-auto mt-20 max-w-2xl space-y-6 text-center">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-8">
                <Bot className="mx-auto mb-4 h-12 w-12 text-amber-600" />
                <h2 className="mb-2 text-2xl font-bold text-amber-900">
                  Gerrit is alleen beschikbaar voor 2025 en 2026
                </h2>
                <p className="mb-6 text-amber-800">
                  Het AI-bemestingsplan van Gerrit kan momenteel alleen worden gegenereerd voor 2025
                  en 2026. Schakel over naar een van deze jaren om aan de slag te gaan.
                </p>
                <div className="flex justify-center gap-4">
                  <Button asChild size="lg">
                    <a href={`/farm/${farm.b_id_farm}/2025/gerrit`}>Switch naar 2025</a>
                  </Button>
                  <Button asChild size="lg">
                    <a href={`/farm/${farm.b_id_farm}/2026/gerrit`}>Switch naar 2026</a>
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
        <Header action={headerAction}>
          <HeaderFarm b_id_farm={farm.b_id_farm} farmOptions={farmOptions} />
        </Header>
        <FarmContent>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* ── Left column ── */}
            <div className="flex flex-col gap-6 lg:col-span-1">
              {/* Research preview notice + daily usage counter */}
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-800">Experimenteel</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInfoDialog(true)}
                    className="shrink-0 text-[11px] text-amber-700 hover:underline"
                  >
                    Meer info
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-amber-700">
                  Gerrit is een vroege onderzoeksversie. De uitkomsten kunnen onjuist zijn —
                  controleer altijd het gegenereerde plan.
                </p>
                {gerritUsage.limit !== null && (
                  <p className="text-xs font-medium text-amber-700">
                    Gebruikt vandaag:{" "}
                    <span className={isRateLimited ? "font-bold text-red-600" : ""}>
                      {optimisticUsed} / {gerritUsage.limit}
                    </span>
                    {isRateLimited && (
                      <span className="mt-1 block text-red-600">
                        Dagelijks limiet bereikt. Probeer morgen opnieuw.
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Strategy form OR compact summary */}
              {showStrategyForm ? (
                <StrategyForm
                  form={form as any}
                  isGenerating={isAIGenerating || phase === "questions"}
                  isRateLimited={isRateLimited}
                  additionalContextValue={additionalContextValue}
                  calendar={calendar}
                  fertilizerOptions={fertilizerOptions}
                />
              ) : (
                <SummaryCards
                  farmTotals={farmTotals as FarmTotals | undefined}
                  planSummary={plan?.summary}
                  activeStrategyLabels={activeStrategyLabels}
                  onEditStrategy={() => setShowStrategyForm(true)}
                  traceId={`gerrit-${farm.b_id_farm}-${calendar}`}
                />
              )}
            </div>

            {/* ── Right column ── */}
            <div className="space-y-6 lg:col-span-2">
              {errorMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
                  <Bot className="mx-auto mb-4 h-12 w-12 text-red-600" />
                  <h2 className="mb-2 text-xl font-bold text-red-900">Er is een fout opgetreden</h2>
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
                    plan as ParsedPlan & {
                      plan: import("~/components/blocks/gerrit/types").PlanRow[]
                    }
                  }
                  isSaving={isSaving}
                  expandedRows={expandedRows}
                  toggleRow={toggleRow}
                />
              ) : (
                <Card className="text-muted-foreground flex h-full min-h-100 flex-col items-center justify-center border-dashed p-12 text-center">
                  <div className="bg-primary/10 mb-6 rounded-full p-6">
                    <Bot className="text-primary h-12 w-12 opacity-80" />
                  </div>
                  <h3 className="text-foreground mb-3 text-xl font-semibold">
                    Gerrit staat voor je klaar
                  </h3>
                  <p className="text-muted-foreground max-w-lg leading-relaxed">
                    Selecteer aan de linkerkant jouw bedrijfsvoorkeuren. Gerrit berekent een
                    integraal bemestingsplan voor het hele bedrijf, rekening houdend met
                    gebruiksnormen, bemestingsadvies en je voorkeuren.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </FarmContent>
      </SidebarInset>
      {blockerDialog}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="text-primary h-5 w-5" />
              Hoe werkt Gerrit?
            </DialogTitle>
            <DialogDescription>
              Gerrit stelt een bemestingsplan op op basis van jouw gekozen strategie. Elk voorstel
              wordt direct getoetst en doorloopt een cyclus van verbeteringen tot het plan optimaal
              is.
            </DialogDescription>
          </DialogHeader>
          <ol className="mt-2 space-y-4">
            <li className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                1
              </div>
              <div>
                <p className="text-sm font-semibold">Inventarisatie</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Eerst worden alle gegevens verzameld: je percelen, de gewassen, de bodemanalyses
                  en welke meststoffen beschikbaar zijn.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                2
              </div>
              <div>
                <p className="text-sm font-semibold">Verduidelijkende vragen</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Als er onduidelijkheden zijn over je strategie of percelen, stelt Gerrit een paar
                  gerichte vragen. Je kunt deze beantwoorden of overslaan.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                3
              </div>
              <div>
                <p className="text-sm font-semibold">Ontwerpen en controleren</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Gerrit maakt een eerste bemestingsplan en rekent dit direct door. Er wordt
                  getoetst of het plan past binnen de gebruiksruimte en of de gewassen voldoende
                  krijgen.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                4
              </div>
              <div>
                <p className="text-sm font-semibold">Bijsturen tot het klopt</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Als het eerste ontwerp niet voldoet, past Gerrit het plan zelfstandig aan. Dit
                  herhaalt zich tot er een agronomisch en wettelijk correct voorstel ligt.
                </p>
              </div>
            </li>
          </ol>
          <p className="text-muted-foreground mt-2 text-xs italic">
            Het uiteindelijke voorstel zie je op je scherm. Pas als je op 'Plan toepassen' klikt,
            worden de bemestingen opgeslagen.
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
