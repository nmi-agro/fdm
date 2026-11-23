import {
  INSCHAREN_DRY_MATTER_TARGET_KG_HA,
  REST_PERIOD_THRESHOLD_DAYS,
} from "@nmi-agro/fdm-calculator/browser"
import { getFarm, getFarms } from "@nmi-agro/fdm-core"
import { cn } from "cn"
import { getDaysInMonth } from "date-fns"
import { AlertTriangle, ArrowRight, CheckCircle2, FileQuestion } from "lucide-react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  redirect,
  useLoaderData,
} from "react-router"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { StatTile } from "~/components/blocks/livestock/stat-tile"
import { Badge } from "~/components/ui/badge"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { getSession } from "~/lib/auth.server"
import { getCalendar } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { fetchGrazingInsightsData } from "~/lib/grazing-insights.server"
import {
  formatRestAlert,
  GRAZING_SEASON_FIRST_MONTH,
  GRAZING_SEASON_LAST_MONTH,
  GRAZING_USE_COLORS,
  PLANNED_GRAZING_BACKGROUND,
} from "~/lib/grazing-status"

export const handle: HelpHandle = { help: "beweiding-inzichten" }

export const meta: MetaFunction = () => {
  return [
    { title: `Weidegang | ${clientConfig.name}` },
    {
      name: "description",
      content: "Weidedagen, uren, Weidemelk-voortgang en veebezetting op het platform.",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = getCalendar(params)
    const calendarYear = parseInt(calendar, 10) || new Date().getFullYear()

    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const [farm, farms] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
    ])
    // Without a herd there is no grazing to show; the livestock page explains how to start
    if (!farm.b_farm_livestock) {
      return redirect(`/farm/${b_id_farm}/${calendar}/livestock`)
    }
    const insightsData = await fetchGrazingInsightsData(
      session.principal_id,
      b_id_farm,
      calendarYear,
    )

    const farmOptions = farms.map((f) => ({
      b_id_farm: f.b_id_farm,
      b_name_farm: f.b_name_farm,
    }))

    // Weidemelk counts every day of the year with enough grazing hours. The target is out of reach
    // once the missing days no longer fit in the days left in the year after today.
    // The same day the figures were calculated for
    const todayTime = Date.parse(`${insightsData.today.toISOString().slice(0, 10)}T00:00:00.000Z`)
    const countFrom = Math.max(todayTime, Date.UTC(calendarYear, 0, 0))
    const daysLeft = Math.max(
      0,
      Math.round((Date.UTC(calendarYear, 11, 31) - countFrom) / 86_400_000),
    )
    const seasonOver =
      !insightsData.metrics.weidemelk.isMet && -insightsData.metrics.weidemelk.marginDays > daysLeft

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      calendarYear,
      farmOptions,
      seasonOver,
      ...insightsData,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

const MONTH_NAMES = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
]

const formatNumber = (value: number) => value.toLocaleString("nl-NL", { maximumFractionDigits: 2 })

export default function GrazingInsightsPage() {
  const { b_id_farm, calendar, calendarYear, farmOptions, metrics, seasonOver } =
    useLoaderData<typeof loader>()

  const weidemelkProgressPercent = Math.min(
    100,
    Math.round((metrics.weidemelk.qualifyingDays / metrics.weidemelk.targetDays) * 100),
  )
  const hasAttentionPoints =
    metrics.overbeweidingAlerts.length > 0 || metrics.incompleteRecords.count > 0

  return (
    <div className="bg-background relative flex w-full flex-1 flex-col">
      <Header
        action={{
          to: `/farm/${b_id_farm}/${calendar}/livestock`,
          label: "Terug naar Melkvee",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator className="hidden xl:block" />
        <BreadcrumbItem className="hidden xl:block">
          <BreadcrumbLink render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock`} />}>
            Melkvee
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>Weidegang</BreadcrumbItem>
      </Header>

      <div>
        <FarmTitle
          title={`Weidegang ${calendar}`}
          description="Inzichten in weidedagen, uren, Weidemelk-voortgang en veebezetting op het platform."
          help="achtergrond-beweiding"
        />

        <FarmContent>
          <div className="space-y-8">
            {/* Top KPI Cards Grid */}
            {/* Two by two on a phone, like the key figures on the Melkvee page */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Weidedagen"
                value={metrics.weidedagen.total.toLocaleString("nl-NL")}
                detail={
                  metrics.weidedagen.planned > 0
                    ? `+ ${metrics.weidedagen.planned.toLocaleString("nl-NL")} gepland`
                    : `Gerealiseerd in ${calendar}`
                }
              />
              <StatTile
                label="Weide-uren per dag"
                value={`${formatNumber(metrics.weideUren.averageHoursPerDay)} uur`}
                detail={`Gemiddeld per weidedag met vastgelegde uren (${formatNumber(metrics.weideUren.totalHours)} uur totaal)`}
              />
              <StatTile
                label="Beweidingsplatform"
                value={`${formatNumber(metrics.beweidingsplatform.areaHa)} ha`}
                detail={`${metrics.beweidingsplatform.fieldCount} ${metrics.beweidingsplatform.fieldCount === 1 ? "perceel" : "percelen"} beweid`}
              />
              <StatTile
                label="Veebezetting platform"
                value={
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span>
                      {metrics.veebezetting.platformGvePerHa !== null
                        ? `${formatNumber(metrics.veebezetting.platformGvePerHa)} GVE/ha`
                        : "—"}
                    </span>
                    {metrics.veebezetting.platformStockingCategory && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {metrics.veebezetting.platformStockingCategory}
                      </Badge>
                    )}
                  </div>
                }
                detail={
                  metrics.veebezetting.totalGrasslandGvePerHa !== null
                    ? `${formatNumber(metrics.veebezetting.totalGrasslandGvePerHa)} GVE/ha op al het grasland`
                    : "Op al het grasland: —"
                }
              />
            </div>

            {/* Weidemelk and the points of attention side by side on a wide screen */}
            <div
              className={cn("grid gap-6", hasAttentionPoints && "xl:grid-cols-2 xl:items-start")}
            >
              {/* Weidemelk 120 x 6 Card */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">Weidemelk (120 dagen × 6 uur)</CardTitle>
                      <CardDescription className="text-xs">
                        Alleen dagen met minimaal 6 uur weidegang van de melkkoeien (categorie 100)
                        tellen mee.
                      </CardDescription>
                    </div>
                    {metrics.weidemelk.isMet ? (
                      <Badge className="gap-1 bg-emerald-700 py-1 text-white">
                        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>
                          {metrics.weidemelk.marginDays > 0
                            ? `Gehaald, ${metrics.weidemelk.marginDays} dagen marge`
                            : "Gehaald"}
                        </span>
                      </Badge>
                    ) : seasonOver ? (
                      <Badge variant="outline" className="text-muted-foreground py-1">
                        Niet gehaald in {calendar}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground py-1">
                        Nog {Math.abs(metrics.weidemelk.marginDays)} dagen nodig
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{metrics.weidemelk.qualifyingDays} van 120 dagen gerealiseerd</span>
                    <span>{weidemelkProgressPercent}%</span>
                  </div>
                  <Progress value={weidemelkProgressPercent} className="h-3" />
                  <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1 text-xs">
                    <span>Start weideseizoen</span>
                    <span>Doel: 120 dagen met ≥ 6 uur</span>
                    {metrics.weidemelk.plannedQualifyingDays > 0 && (
                      <span>+ {metrics.weidemelk.plannedQualifyingDays} dagen gepland</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Aandachtspunten, only when there is something to look at */}
              {hasAttentionPoints && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Aandachtspunten</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {metrics.overbeweidingAlerts.length > 0 && (
                      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900">
                        <AlertTriangle
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                        />
                        <div className="space-y-1.5">
                          <p className="font-semibold">Rustperiode korter dan de richtlijn</p>
                          <ul className="list-disc space-y-0.5 pl-4">
                            {metrics.overbeweidingAlerts.map((alert, idx) => (
                              <li key={idx}>
                                {formatRestAlert({
                                  b_id: alert.b_id,
                                  b_name: alert.b_name ?? null,
                                  restDays: alert.restDays,
                                  thresholdDays: alert.thresholdDays,
                                })}
                              </li>
                            ))}
                          </ul>
                          <p>
                            De richtlijn van {REST_PERIOD_THRESHOLD_DAYS} dagen rust houdt geen
                            rekening met de werkelijke grasgroei. Als richtwaarde voor inscharen
                            geldt ± {INSCHAREN_DRY_MATTER_TARGET_KG_HA.toLocaleString("nl-NL")} kg
                            ds/ha; dat kost minstens {REST_PERIOD_THRESHOLD_DAYS} groeidagen
                            (Handboek Melkveehouderij, tabel 3.8).
                          </p>
                        </div>
                      </div>
                    )}

                    {metrics.incompleteRecords.count > 0 && (
                      <div className="bg-muted/40 text-muted-foreground flex flex-col gap-2 rounded-lg border p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <FileQuestion className="text-muted-foreground h-4 w-4" />
                          <span>
                            Van <strong>{metrics.incompleteRecords.count}</strong> beweidingen
                            ontbreekt het aantal uren per dag.
                          </span>
                        </div>
                        <NavLink
                          to={`/farm/${b_id_farm}/${calendar}/livestock/grazing`}
                          className="text-primary flex items-center gap-1 font-medium hover:underline"
                        >
                          <span>Aanvullen in kalender</span>
                          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                        </NavLink>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Weidedagen per maand */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weidedagen per maand</CardTitle>
                <CardDescription className="text-xs">
                  Verdeling van gerealiseerde en geplande weidedagen over het seizoen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Not wider than needed, so a day count stays close to its bar */}
                <div className="max-w-4xl space-y-3">
                  {metrics.monthlyDistribution
                    // The months of the grazing season, as in the grazing calendar
                    .filter(
                      (m) =>
                        m.month >= GRAZING_SEASON_FIRST_MONTH &&
                        m.month <= GRAZING_SEASON_LAST_MONTH,
                    )
                    .map((m) => {
                      const totalMonthDays = getDaysInMonth(new Date(calendarYear, m.month - 1))
                      const realisedWidth = Math.min(100, (m.realisedDays / totalMonthDays) * 100)
                      const plannedWidth = Math.min(
                        100 - realisedWidth,
                        (m.plannedDays / totalMonthDays) * 100,
                      )

                      return (
                        <div key={m.month} className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground w-8 font-medium">
                            {MONTH_NAMES[m.month - 1]}
                          </span>
                          <div className="bg-muted/40 relative flex h-6 flex-1 items-center overflow-hidden rounded-sm">
                            {realisedWidth > 0 && (
                              <div
                                style={{
                                  width: `${realisedWidth}%`,
                                  backgroundColor: GRAZING_USE_COLORS.weiden,
                                }}
                                className="h-full"
                              />
                            )}
                            {plannedWidth > 0 && (
                              <div
                                style={{
                                  width: `${plannedWidth}%`,
                                  backgroundImage: PLANNED_GRAZING_BACKGROUND,
                                }}
                                className="h-full"
                              />
                            )}
                          </div>
                          <span className="w-28 text-right font-medium tabular-nums">
                            {m.realisedDays > 0 && m.plannedDays > 0
                              ? `${m.realisedDays} + ${m.plannedDays} gepland`
                              : m.realisedDays > 0
                                ? `${m.realisedDays} ${m.realisedDays === 1 ? "dag" : "dagen"}`
                                : m.plannedDays > 0
                                  ? `${m.plannedDays} gepland`
                                  : "—"}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </FarmContent>
      </div>
    </div>
  )
}
