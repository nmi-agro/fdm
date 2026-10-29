import {
  DYNA_V2_SOIL_PARAMETERS,
  getMineralizationScenarioSchema,
  HARVEST_PARAMETER_KEYS,
  type HarvestParameterValues,
  type MineralizationScenario,
  type SeasonPhase,
} from "@nmi-agro/fdm-calculator"
import {
  addHarvest,
  getCultivation,
  getCultivationsFromCatalogue,
  getDefaultsForHarvestParameters,
  getFertilizerParametersDescription,
  getParametersForHarvestCat,
  getSoilParametersDescription,
  startOfDayInFdmTimeZone,
  toFdmDateString,
} from "@nmi-agro/fdm-core"
import { CircleAlert, CircleCheck, Info, MapPinOff } from "lucide-react"
import { Suspense, use, useEffect, useRef, useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  useFetcher,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import { z } from "zod"
import {
  ChartExplainer,
  EvaluationCard,
  KeyFigures,
  NitrogenBalanceCard,
} from "~/components/blocks/mineralization/field-cards"
import { MissingHarvestCard } from "~/components/blocks/mineralization/missing-harvest-card"
import { type ChartEvent, NitrogenChart } from "~/components/blocks/mineralization/nitrogen-chart"
import { PhaseSelector } from "~/components/blocks/mineralization/phase-selector"
import {
  getApplicationChange,
  type ScenarioAction,
  ScenarioDeltas,
  ScenarioPanel,
  scenarioReducer,
} from "~/components/blocks/mineralization/scenario-panel"
import { SignalChips } from "~/components/blocks/mineralization/signal-chips"
import { FieldMineralizationSkeleton } from "~/components/blocks/mineralization/skeletons"
import { type SoilParameterLabels, UsedInput } from "~/components/blocks/mineralization/used-input"
import { WeatherStrip } from "~/components/blocks/mineralization/weather-strip"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { Spinner } from "~/components/ui/spinner"
import { useAnalytics } from "~/hooks/use-analytics"
import {
  calculateFieldMineralization,
  getMineralizationYear,
  loadFarmMineralizationContext,
  saveScenario,
} from "~/integrations/mineralization.server"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  DYNA_V2_MIN_DAYS_BETWEEN_HARVESTS,
  type FieldMineralizationOk,
  type FieldMineralizationOutcome,
  formatLongDate,
  formatShortDate,
  getAttentionItems,
  getBulkHarvestHref,
  getNotCalculatedReason,
  getSeasonTiming,
  type MineralizationHarvestSettings,
} from "~/lib/mineralization"
import { cn } from "~/lib/utils"

export { shouldRevalidateMineralization as shouldRevalidate } from "~/lib/mineralization"

export const meta: MetaFunction = () => {
  return [
    { title: `Mineralisatie | Perceel | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Stikstofaanbod, opname door het gewas, beschikbare stikstof en uitspoeling door het seizoen heen.",
    },
  ]
}

/**
 * Streams the mineralization outcome of the field; nothing slow is awaited.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const b_id = params.b_id
    if (!b_id_farm) {
      throw data("invalid: b_id_farm", { status: 400, statusText: "invalid: b_id_farm" })
    }
    if (!b_id) {
      throw data("invalid: b_id", { status: 400, statusText: "invalid: b_id" })
    }
    const session = await getSession(request)
    const year = getMineralizationYear(params.calendar)
    const today = toFdmDateString(new Date())

    const outcome = loadFarmMineralizationContext({
      principal_id: session.principal_id,
      b_id_farm,
      year,
    })
      .then((ctx) => calculateFieldMineralization(ctx, b_id, session.principal_id, b_id_farm))
      .catch((error: unknown): FieldMineralizationOutcome => {
        reportError(error, { page: "mineralization", scope: "field" })
        return {
          b_id,
          b_name: null,
          b_area: null,
          status: "error",
          message: "De gegevens van dit perceel konden niet worden geladen.",
        }
      })

    // What can be entered for a harvest of the main cultivation, as in the harvest form
    const harvestSettings = outcome.then(
      async (result): Promise<MineralizationHarvestSettings | null> => {
        if (result.status !== "ok" && result.status !== "missing_harvest") return null
        const { b_lu_catalogue, b_lu_harvestcat } = result.mainCultivation
        const defaults: HarvestParameterValues = {}
        try {
          const catalogue = await getCultivationsFromCatalogue(fdm, session.principal_id, b_id_farm)
          const values = getDefaultsForHarvestParameters(b_lu_catalogue, catalogue)
          for (const [key, value] of Object.entries(values)) {
            if (typeof value === "number") defaults[key as keyof HarvestParameterValues] = value
          }
        } catch (error) {
          // Without usual values a new harvest starts empty
          reportError(error, { page: "mineralization", scope: "harvest-defaults" })
        }
        return { parameters: getParametersForHarvestCat(b_lu_harvestcat), defaults }
      },
    )

    // Parameters the calculation accepts but that are not stored as soil analysis parameters
    const soilLabels: SoilParameterLabels = {
      a_nmin_cc_d30: { name: "Minerale stikstof 0–30 cm", unit: "kg N/ha" },
      a_nmin_cc_d60: { name: "Minerale stikstof 30–60 cm", unit: "kg N/ha" },
      b_gwl_glg: { name: "Gemiddeld laagste grondwaterstand (GLG)", unit: "cm-mv" },
      b_gwl_ghg: { name: "Gemiddeld hoogste grondwaterstand (GHG)", unit: "cm-mv" },
    }
    const sourceLabels: Record<string, string> = {}
    for (const description of getSoilParametersDescription()) {
      if (description.parameter === "a_source") {
        for (const option of description.options ?? []) {
          sourceLabels[String(option.value)] = option.label
        }
      }
      if (DYNA_V2_SOIL_PARAMETERS.includes(description.parameter)) {
        soilLabels[description.parameter] = {
          name: description.description ?? description.name,
          unit: description.unit,
        }
      }
    }

    const methodLabels: Record<string, string> = {}
    const methodDescription = getFertilizerParametersDescription().find(
      (x: { parameter: string }) => x.parameter === "p_app_method_options",
    )
    for (const option of methodDescription?.options ?? []) {
      if (option.value !== null) methodLabels[String(option.value)] = option.label
    }

    return {
      b_id_farm,
      b_id,
      calendar: params.calendar ?? String(year),
      methodLabels,
      year,
      today,
      isCurrentYear: Number(today.slice(0, 4)) === year,
      soilLabels,
      sourceLabels,
      outcome,
      harvestSettings,
    }
  } catch (error) {
    const normalized = handleLoaderError(error)
    throw normalized ?? error
  }
}

const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().min(0).optional(),
)
const harvestFormSchema = z.object({
  b_lu: z.string().min(1),
  b_lu_harvest_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ...(Object.fromEntries(HARVEST_PARAMETER_KEYS.map((key) => [key, optionalNumber])) as Record<
    (typeof HARVEST_PARAMETER_KEYS)[number],
    typeof optionalNumber
  >),
})

/**
 * Saves a measured or planned harvest of the main cultivation.
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    if (!params.b_id) {
      throw data("invalid: b_id", { status: 400, statusText: "invalid: b_id" })
    }
    const session = await getSession(request)
    const formData = await request.formData()
    const intent = formData.get("intent")

    if (intent === "save_harvest") {
      const parsed = harvestFormSchema.safeParse(Object.fromEntries(formData))
      if (!parsed.success) {
        throw data("Ongeldige oogstgegevens", { status: 400 })
      }
      // Either all parameters of the harvest class are given, or none (only the date is saved)
      const cultivation = await getCultivation(fdm, session.principal_id, parsed.data.b_lu)
      const required = getParametersForHarvestCat(cultivation.b_lu_harvestcat)
      const given = required.filter((key) => parsed.data[key] !== undefined)
      if (given.length > 0 && given.length < required.length) {
        throw data("Vul alle gegevens van de oogst in, of laat ze allemaal leeg.", { status: 400 })
      }
      const properties: HarvestParameterValues = {}
      for (const key of given) properties[key] = parsed.data[key]
      const [y, m, d] = parsed.data.b_lu_harvest_date.split("-").map(Number)
      await addHarvest(
        fdm,
        session.principal_id,
        parsed.data.b_lu,
        startOfDayInFdmTimeZone(y, m, d),
        given.length > 0 ? properties : undefined,
      )
      return dataWithSuccess(
        { result: "ok" },
        { message: "Oogst opgeslagen. De mineralisatie wordt opnieuw berekend." },
      )
    }

    if (intent === "save_scenario") {
      const b_id_farm = params.b_id_farm
      if (!b_id_farm) {
        throw data("invalid: b_id_farm", { status: 400, statusText: "invalid: b_id_farm" })
      }
      const year = getMineralizationYear(params.calendar)
      const schema = getMineralizationScenarioSchema(year)
      const parseField = (name: string) => {
        try {
          const value = formData.get(name)
          return schema.safeParse(JSON.parse(typeof value === "string" ? value : ""))
        } catch {
          return null
        }
      }
      const parsed = parseField("scenario")
      const parsedBase = parseField("base")
      if (!parsed?.success || !parsedBase?.success) {
        throw data("Ongeldig scenario", { status: 400 })
      }
      await saveScenario({
        principal_id: session.principal_id,
        b_id_farm,
        b_id: params.b_id,
        year,
        scenario: parsed.data,
        base: parsedBase.data,
      })
      return dataWithSuccess(
        { result: "ok" },
        { message: "Scenario opgeslagen in het bemestingsplan." },
      )
    }

    throw data("Ongeldige actie", { status: 400 })
  } catch (error) {
    return handleActionError(error)
  }
}

export default function MineralizationFieldPage() {
  const loaderData = useLoaderData<typeof loader>()
  return (
    <Suspense fallback={<FieldMineralizationSkeleton />}>
      <FieldMineralization {...loaderData} />
    </Suspense>
  )
}

type LoaderData = ReturnType<typeof useLoaderData<typeof loader>>

function FieldMineralization(props: LoaderData) {
  const outcome = use(props.outcome)
  const revalidator = useRevalidator()
  const { capture } = useAnalytics()

  useEffect(() => {
    capture("mineralization_viewed", {
      b_id_farm: props.b_id_farm,
      year: props.year,
      page: "field",
      status: outcome.status,
    })
  }, [capture, props.b_id_farm, props.year, outcome.status])

  switch (outcome.status) {
    case "excluded":
    case "missing_location":
    case "no_cultivation":
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPinOff />
            </EmptyMedia>
            <EmptyTitle>Niet berekend</EmptyTitle>
            <EmptyDescription>
              {getNotCalculatedReason(outcome, props.year)}.{" "}
              {outcome.status === "excluded"
                ? "Voor bufferstroken, natuur en landschapselementen wordt de mineralisatie niet berekend."
                : outcome.status === "no_cultivation"
                  ? "Voeg een teelt toe aan dit perceel om de mineralisatie te berekenen."
                  : "Dit perceel heeft geen geldige ligging; teken het perceel opnieuw in."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    case "missing_harvest":
      return (
        <MissingHarvestCard
          mainCultivation={outcome.mainCultivation}
          harvestSettings={use(props.harvestSettings)}
          defaultHarvestDate={outcome.defaultHarvestDate}
          year={props.year}
          bulkHarvestHref={getBulkHarvestHref({
            b_id_farm: props.b_id_farm,
            calendar: props.calendar,
            b_lu_catalogue: outcome.mainCultivation.b_lu_catalogue,
            fieldIds: [props.b_id],
            returnUrl: `/farm/${props.b_id_farm}/${props.calendar}/mineralization/${props.b_id}`,
          })}
        />
      )
    case "error":
      return (
        <Alert variant="destructive" className="max-w-2xl">
          <CircleAlert aria-hidden />
          <AlertTitle>De berekening is niet gelukt</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{outcome.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => revalidator.revalidate()}
              disabled={revalidator.state !== "idle"}
            >
              Opnieuw proberen
            </Button>
          </AlertDescription>
        </Alert>
      )
    case "ok": {
      const base = getScenarioBase(outcome)
      return (
        <FieldMineralizationResult
          key={JSON.stringify(base)}
          {...props}
          outcome={outcome}
          base={base}
          harvestSettings={use(props.harvestSettings)}
        />
      )
    }
  }
}

/**
 * The current fertilization plan and the harvests of the main cultivation in the year (every cut
 * for grassland), as the starting point of a scenario.
 */
function getScenarioBase(outcome: FieldMineralizationOk): MineralizationScenario {
  const mainHarvests = outcome.usedInput.harvests.filter(
    (h) => h.b_lu === outcome.mainCultivation.b_lu,
  )
  return {
    fertilizerApplications: outcome.usedInput.fertilizerApplications.map((a) => ({
      p_app_id: a.p_app_id,
      p_id: a.p_id,
      p_app_amount_display: a.amount ?? 0,
      p_app_method: a.method ?? "broadcasting",
      p_app_date: a.date,
    })),
    ...(mainHarvests.length > 0
      ? {
          harvests: mainHarvests.map((h) => ({
            b_id_harvesting: h.b_id_harvesting,
            b_date_harvest: h.date,
            parameters: h.parameters,
          })),
        }
      : {}),
  }
}

/** The events of the calculation, with the fertilizer type of each application for its icon. */
function getChartEvents(outcome: FieldMineralizationOk): ChartEvent[] {
  const typeById = new Map(outcome.fertilizerOptions.map((o) => [o.p_id, o.p_type]))
  const productByApplication = new Map(
    outcome.usedInput.fertilizerApplications.map((a) => [a.p_app_id, a.p_id]),
  )
  return outcome.events.map((event) => {
    const p_id = event.p_app_id ? productByApplication.get(event.p_app_id) : undefined
    return p_id ? { ...event, p_type: typeById.get(p_id) ?? null } : event
  })
}

/**
 * Applications and harvests of the scenario that are new or moved, as events for the lane of the
 * chart; the plan's own events stay in place, so the shift is visible.
 */
function getScenarioEvents(
  outcome: FieldMineralizationOk,
  base: MineralizationScenario,
  scenario: MineralizationScenario,
): ChartEvent[] {
  const optionById = new Map(outcome.fertilizerOptions.map((o) => [o.p_id, o]))
  const harvestEvents = (scenario.harvests ?? []).flatMap((harvest): ChartEvent[] => {
    const original = base.harvests?.find((h) => h.b_id_harvesting === harvest.b_id_harvesting)
    if (original?.b_date_harvest === harvest.b_date_harvest) return []
    return [
      {
        date: harvest.b_date_harvest,
        type: "harvest",
        label: outcome.mainCultivation.b_lu_name ?? outcome.mainCultivation.b_lu_catalogue,
        planned: true,
        b_lu: outcome.mainCultivation.b_lu,
        ...(harvest.parameters?.b_lu_yield !== undefined
          ? { amount: harvest.parameters.b_lu_yield, unit: "kg DS/ha" }
          : {}),
      },
    ]
  })
  const applicationEvents = scenario.fertilizerApplications.flatMap((app): ChartEvent[] => {
    const original = base.fertilizerApplications.find((a) => a.p_app_id === app.p_app_id)
    const isNew = getApplicationChange(app, base) === "new"
    if (!isNew && original?.p_app_date === app.p_app_date) return []
    const option = optionById.get(app.p_id)
    return [
      {
        date: app.p_app_date,
        type: "fertilizer",
        label: option?.p_name_nl ?? "Meststof",
        planned: true,
        ...(app.p_app_id ? { p_app_id: app.p_app_id } : {}),
        fertilizerKind: option?.p_type === "mineral" ? "mineral" : "organic",
        p_type: option?.p_type ?? null,
        amount: app.p_app_amount_display,
        unit: option?.p_app_amount_unit ?? "kg/ha",
      },
    ]
  })
  return [...applicationEvents, ...harvestEvents]
}

const SCENARIO_DEBOUNCE_MS = 600
const SCENARIO_PANEL_ID = "scenario"
const CHART_ID = "stikstof-grafiek"
const USED_INPUT_ID = "gebruikte-gegevens"

function isPhase(value: string | null): value is SeasonPhase {
  return value === "planning" || value === "growing" || value === "evaluation"
}

function FieldMineralizationResult(
  props: Omit<LoaderData, "outcome" | "harvestSettings"> & {
    outcome: FieldMineralizationOk
    base: MineralizationScenario
    harvestSettings: MineralizationHarvestSettings | null
  },
) {
  const { outcome, base, year, today, isCurrentYear } = props
  const { capture } = useAnalytics()

  // What-if scenario: edited locally, calculated through the scenario resource route
  const [scenario, setScenario] = useState(base)
  const scenarioFetcher = useFetcher<{ key: string; outcome: FieldMineralizationOutcome }>()
  const saveFetcher = useFetcher()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const scenarioUrl = `/farm/${props.b_id_farm}/${props.calendar}/mineralization/${props.b_id}/scenario`
  const dirty = JSON.stringify(scenario) !== JSON.stringify(base)
  const loadScenario = (next: MineralizationScenario) =>
    void scenarioFetcher.load(`${scenarioUrl}?scenario=${encodeURIComponent(JSON.stringify(next))}`)
  const dispatch = (action: ScenarioAction) => {
    const next = scenarioReducer(scenario, action)
    setScenario(next)
    if (timer.current) clearTimeout(timer.current)
    if (JSON.stringify(next) === JSON.stringify(base)) return
    timer.current = setTimeout(() => loadScenario(next), SCENARIO_DEBOUNCE_MS)
    capture("mineralization_scenario_changed", { action: action.type })
  }
  const [usedInputOpen, setUsedInputOpen] = useState(false)
  // A result only counts when it was calculated for exactly the scenario on screen
  const scenarioKey = JSON.stringify(scenario)
  const scenarioOutcome =
    dirty && scenarioFetcher.state === "idle" && scenarioFetcher.data?.key === scenarioKey
      ? scenarioFetcher.data.outcome
      : undefined
  const scenarioOk = scenarioOutcome?.status === "ok" ? scenarioOutcome : null
  const scenarioError = scenarioOutcome?.status === "error" ? scenarioOutcome.message : null
  const scenarioPending = dirty && !scenarioOutcome
  const saving = saveFetcher.state !== "idle"
  const [searchParams, setSearchParams] = useSearchParams()
  const timing = getSeasonTiming(year, today, outcome.mainHarvest)
  // The growing season view (last 30 and next 14 days) only applies while the main crop grows
  const inGrowingSeason = timing === "before_harvest" && today >= outcome.mainStart
  const growingUnavailable = inGrowingSeason
    ? undefined
    : timing === "after_harvest"
      ? `De hoofdteelt is op ${formatShortDate(outcome.mainHarvest)} geoogst.`
      : timing === "before_harvest"
        ? "De hoofdteelt is nog niet gestart."
        : "Alleen beschikbaar in het lopende jaar."
  const requested = searchParams.get("phase")
  const phase: SeasonPhase =
    isPhase(requested) && !(requested === "growing" && growingUnavailable)
      ? requested
      : outcome.insights.defaultPhase
  const newApplicationDate =
    timing === "before_harvest" || timing === "after_harvest" ? today : `${year}-04-01`
  const scenarioEvents = dirty ? getScenarioEvents(outcome, base, scenario) : []

  const rainEventDates = outcome.insights.signals.flatMap((s) =>
    s.type === "rain_near_event" ? [s.eventDate] : [],
  )
  const attention = getAttentionItems(outcome)
  const fieldHref = `/farm/${props.b_id_farm}/${props.calendar}/field/${props.b_id}`
  const nextYearHref = `/farm/${props.b_id_farm}/${year + 1}/mineralization/${props.b_id}?phase=planning`

  const balanceAndAttention = (
    <div className="grid gap-6 lg:grid-cols-2">
      <NitrogenBalanceCard
        balance={outcome.result.balance}
        hasFertilizerApplications={outcome.usedInput.fertilizerApplications.length > 0}
      />
      {phase === "evaluation" ? (
        <EvaluationCard
          insights={outcome.insights}
          nextYear={year + 1}
          nextYearHref={nextYearHref}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Aandachtspunten</CardTitle>
            <CardDescription>
              {phase === "planning"
                ? "Wat de berekening van je bemestingsplan laat zien."
                : "Wat er de komende tijd aandacht vraagt."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attention.length > 0 ? (
              <SignalChips items={attention} className="flex-col items-start" />
            ) : (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <CircleCheck className="size-4" aria-hidden /> Geen aandachtspunten op dit moment.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
  const weatherStrip =
    phase === "growing" && outcome.forecast && outcome.forecast.days.length > 0 ? (
      <WeatherStrip
        forecast={outcome.forecast}
        signals={outcome.insights.signals}
        canSuggestShift={(signal) =>
          signal.eventType === "fertilizer"
            ? scenario.fertilizerApplications.some((a) => a.p_app_id === signal.p_app_id)
            : signal.b_lu === outcome.mainCultivation.b_lu &&
              (scenario.harvests ?? []).some((h) => h.b_date_harvest === signal.eventDate)
        }
        onSuggestShift={(suggestion) => {
          dispatch({
            type: "shift",
            eventType: suggestion.eventType,
            p_app_id: suggestion.p_app_id,
            eventDate: suggestion.eventDate,
            newDate: suggestion.newDate,
          })
          // Bring the changed scenario into view, so the effect of the shift is not off-screen
          const panel = document.getElementById(SCENARIO_PANEL_ID)
          panel?.scrollIntoView({ behavior: "smooth", block: "start" })
          panel?.focus({ preventScroll: true })
        }}
      />
    ) : null
  const scenarioPanel =
    phase !== "evaluation" ? (
      <ScenarioPanel
        id={SCENARIO_PANEL_ID}
        base={base}
        scenario={scenario}
        dispatch={dispatch}
        year={year}
        newApplicationDate={newApplicationDate}
        mainCultivation={outcome.mainCultivation}
        harvestSettings={props.harvestSettings}
        fertilizerOptions={outcome.fertilizerOptions}
        methodLabels={props.methodLabels}
        dirty={dirty}
        pending={scenarioPending}
        error={scenarioError}
        current={outcome.insights.kpis}
        result={scenarioOk?.insights.kpis ?? null}
        saving={saving}
        onSave={() => {
          capture("mineralization_scenario_saved", { b_id_farm: props.b_id_farm, year })
          void saveFetcher.submit(
            {
              intent: "save_scenario",
              scenario: JSON.stringify(scenario),
              base: JSON.stringify(base),
            },
            { method: "post" },
          )
        }}
        onDiscard={() => {
          if (timer.current) clearTimeout(timer.current)
          setScenario(base)
        }}
        onRetry={() => loadScenario(scenario)}
        resultKey={scenarioKey}
        onShowChart={() => {
          const chart = document.getElementById(CHART_ID)
          chart?.scrollIntoView({ behavior: "smooth", block: "start" })
        }}
      />
    ) : null

  return (
    // Bands: the chart with what matters most in this phase, then the rest, then the data behind
    // it. Planning puts the scenario under the chart; the growing season reads the balance and
    // attention points first, then acts on them with the weather and the scenario.
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PhaseSelector
              value={phase}
              currentPhase={isCurrentYear ? outcome.insights.defaultPhase : null}
              disabled={growingUnavailable ? { growing: growingUnavailable } : undefined}
              onChange={(next) =>
                setSearchParams(
                  (prev) => {
                    prev.set("phase", next)
                    return prev
                  },
                  { replace: true, preventScrollReset: true },
                )
              }
            />
            <Button
              variant="link"
              size="sm"
              className="text-muted-foreground"
              nativeButton={false}
              render={
                <a href={`#${USED_INPUT_ID}`} onClick={() => setUsedInputOpen(true)}>
                  Welke gegevens zijn gebruikt?
                </a>
              }
            />
          </div>
          {isCurrentYear && growingUnavailable ? (
            <p className="text-muted-foreground text-xs">
              Groeiseizoen is niet beschikbaar: {growingUnavailable.charAt(0).toLowerCase()}
              {growingUnavailable.slice(1)}
            </p>
          ) : null}
        </div>

        {outcome.partial ? (
          <Alert>
            <Info aria-hidden />
            <AlertTitle>Alleen de hoofdteelt is meegerekend</AlertTitle>
            <AlertDescription>
              De groenbemester of het vanggewas na de hoofdteelt kon nog niet worden meegenomen in
              de berekening. Het verloop na de oogst is daardoor minder nauwkeurig.
            </AlertDescription>
          </Alert>
        ) : null}

        {outcome.usedInput.omittedHarvests.length > 0 ? (
          <Alert>
            <Info aria-hidden />
            <AlertTitle>Niet alle oogsten meegerekend</AlertTitle>
            <AlertDescription>
              Tussen twee oogsten of sneden moeten voor de berekening minimaal{" "}
              {DYNA_V2_MIN_DAYS_BETWEEN_HARVESTS} dagen zitten. Niet meegerekend, omdat ze binnen{" "}
              {DYNA_V2_MIN_DAYS_BETWEEN_HARVESTS} dagen na de vorige vallen:{" "}
              {outcome.usedInput.omittedHarvests.map((h) => formatLongDate(h.date)).join(", ")}.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card id={CHART_ID} className="scroll-mt-4">
          <CardHeader className="space-y-4">
            <div className="space-y-1.5">
              <CardTitle>Stikstof door het seizoen</CardTitle>
              <CardDescription>
                {outcome.mainCultivation.b_lu_name ?? outcome.mainCultivation.b_lu_catalogue},{" "}
                {year}
              </CardDescription>
            </div>
            <KeyFigures insights={outcome.insights} phase={phase} timing={timing} />
            {dirty && phase !== "evaluation" ? (
              // Remounts with every new result, so the highlight plays once per recalculation
              <div
                key={scenarioOk ? scenarioKey : "pending"}
                className={cn(
                  "bg-muted/50 flex flex-col gap-3 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between",
                  scenarioOk && "motion-safe:animate-just-updated",
                )}
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">
                    Scenario (gestippeld) ten opzichte van je plan
                  </p>
                  {scenarioPending ? (
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Spinner /> Wordt berekend…
                    </p>
                  ) : scenarioError ? (
                    <p className="text-destructive text-sm">
                      De berekening van het scenario is niet gelukt.
                    </p>
                  ) : scenarioOk ? (
                    <ScenarioDeltas
                      current={outcome.insights.kpis}
                      result={scenarioOk.insights.kpis}
                    />
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 self-start sm:self-center"
                  nativeButton={false}
                  render={<a href={`#${SCENARIO_PANEL_ID}`}>Naar scenario</a>}
                />
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            <NitrogenChart
              series={outcome.result.series}
              scenarioSeries={scenarioOk && !scenarioPending ? scenarioOk.result.series : undefined}
              events={getChartEvents(outcome)}
              scenarioEvents={scenarioEvents}
              year={year}
              today={today}
              phase={phase}
              forecastDays={outcome.forecast?.days}
              rainEventDates={rainEventDates}
            />
            <ChartExplainer />
          </CardContent>
        </Card>

        {/* While planning, the scenario sits right under the chart it redraws */}
        {phase === "planning" ? scenarioPanel : balanceAndAttention}
      </div>

      {phase === "planning" ? (
        balanceAndAttention
      ) : phase === "growing" ? (
        <div className="flex flex-col gap-6">
          {weatherStrip}
          {scenarioPanel}
        </div>
      ) : null}

      <UsedInput
        id={USED_INPUT_ID}
        open={usedInputOpen}
        onOpenChange={setUsedInputOpen}
        usedInput={outcome.usedInput}
        soilLabels={props.soilLabels}
        sourceLabels={props.sourceLabels}
        fertilizerTypes={Object.fromEntries(
          outcome.fertilizerOptions.map((o) => [o.p_id, o.p_type]),
        )}
        fieldHref={fieldHref}
        partial={outcome.partial}
      />
    </div>
  )
}
