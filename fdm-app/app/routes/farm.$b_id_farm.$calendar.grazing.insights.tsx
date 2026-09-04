import {
  getFarm,
  getFarms,
} from "@nmi-agro/fdm-core"
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileQuestion,
  Info,
  Landmark,
  Scale,
} from "lucide-react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
} from "react-router"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { fetchGrazingInsightsData } from "~/lib/grazing-insights.server"

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
    const calendar = params.calendar ?? String(new Date().getFullYear())
    const calendarYear = parseInt(calendar, 10) || new Date().getFullYear()

    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const [farm, farms, insightsData] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
      fetchGrazingInsightsData(session.principal_id, b_id_farm, calendarYear),
    ])

    const farmOptions = farms.map((f) => ({
      b_id_farm: f.b_id_farm,
      b_name_farm: f.b_name_farm,
    }))

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      calendarYear,
      farmOptions,
      ...insightsData,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

const MONTH_NAMES = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]

export default function GrazingInsightsPage() {
  const { b_id_farm, calendar, farmOptions, metrics } = useLoaderData<typeof loader>()

  const weidemelkProgressPercent = Math.min(100, Math.round((metrics.weidemelk.qualifyingDays / metrics.weidemelk.targetDays) * 100))

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${b_id_farm}/${calendar}/grazing`,
          label: "Terug naar Beweidingskalender",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbLink asChild>
          <NavLink to={`/farm/${b_id_farm}/${calendar}/grazing`}>Beweiding</NavLink>
        </BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbItem>Kengetallen</BreadcrumbItem>
      </Header>

      <main>
        <FarmTitle
          title={`Weidegang ${calendar}`}
          description="Inzichten in weidedagen, uren, Weidemelk-voortgang en veebezetting op het platform."
        />

        <FarmContent>
          <div className="space-y-8">
            {/* Top KPI Cards Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Weidedagen</CardTitle>
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.weidedagen.total}</div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {metrics.weidedagen.planned > 0 ? `+ ${metrics.weidedagen.planned} gepland` : `Gerealiseerd in ${calendar}`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Weide-uren per dag</CardTitle>
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.weideUren.averageHoursPerDay} u</div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Gemiddeld ({metrics.weideUren.totalHours} u totaal)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Beweidingsplatform</CardTitle>
                    <Compass className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.beweidingsplatform.areaHa} ha</div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {metrics.beweidingsplatform.fieldCount} {metrics.beweidingsplatform.fieldCount === 1 ? "perceel" : "percelen"} beweid
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Veebezetting platform</CardTitle>
                    <Scale className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {metrics.veebezetting.platformGvePerHa !== null ? `${metrics.veebezetting.platformGvePerHa} GVE/ha` : "—"}
                    </span>
                    {metrics.veebezetting.platformStockingCategory && (
                      <Badge
                        variant={metrics.veebezetting.platformStockingCategory === "intensief" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {metrics.veebezetting.platformStockingCategory}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Totaal {metrics.veebezetting.totalGrasslandGvePerHa ?? "—"} GVE/ha grasland
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Weidemelk 120 x 6 Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Award className="h-5 w-5 text-amber-500" />
                      Weidemelk · 120 dagen × 6 uur
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Alleen dagen met minimaal 6 uur weidegang van de melkkoeien (categorie 100) tellen mee.
                    </CardDescription>
                  </div>
                  {metrics.weidemelk.isMet ? (
                    <Badge className="bg-emerald-600 text-white gap-1 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Norm behaald ({metrics.weidemelk.marginDays >= 0 ? `+${metrics.weidemelk.marginDays}d marge` : ""})
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
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Start weideseizoen</span>
                  <span>Doel: 120 dagen met ≥ 6 uur</span>
                  {metrics.weidemelk.plannedQualifyingDays > 0 && (
                    <span>+ {metrics.weidemelk.plannedQualifyingDays} dagen gepland</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Weidedagen per maand */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weidedagen per maand</CardTitle>
                <CardDescription className="text-xs">
                  Verdeling van gerealiseerde en geplande weidedagen over het seizoen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.monthlyDistribution
                    .filter((m) => m.month >= 4 && m.month <= 10) // April to October
                    .map((m) => {
                      const totalMonthDays = 30
                      const realisedWidth = Math.min(100, Math.round((m.realisedDays / totalMonthDays) * 100))
                      const plannedWidth = Math.min(100 - realisedWidth, Math.round((m.plannedDays / totalMonthDays) * 100))

                      return (
                        <div key={m.month} className="flex items-center gap-3 text-xs">
                          <span className="w-8 font-mono font-medium text-muted-foreground uppercase">
                            {MONTH_NAMES[m.month - 1]}
                          </span>
                          <div className="relative h-6 flex-1 bg-muted/40 rounded-sm overflow-hidden flex items-center">
                            {realisedWidth > 0 && (
                              <div
                                style={{ width: `${realisedWidth}%` }}
                                className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all"
                              />
                            )}
                            {plannedWidth > 0 && (
                              <div
                                style={{ width: `${plannedWidth}%` }}
                                className="h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(16,185,129,0.3)_2px,rgba(16,185,129,0.3)_4px)] border-l border-emerald-500/40 opacity-70"
                              />
                            )}
                          </div>
                          <span className="w-16 text-right font-medium">
                            {m.realisedDays > 0 ? `${m.realisedDays} dgn` : m.plannedDays > 0 ? `(${m.plannedDays} p)` : "—"}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Aandachtspunten */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aandachtspunten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics.overbeweidingAlerts.map((alert, idx) => (
                  <div key={idx} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-semibold">Rustperiode te kort op {alert.b_name ?? "perceel"}</p>
                      <p className="mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                ))}

                {metrics.incompleteRecords.count > 0 && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileQuestion className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Van <strong>{metrics.incompleteRecords.count}</strong> beweidingen ontbreekt het aantal uren per dag.
                      </span>
                    </div>
                    <NavLink
                      to={`/farm/${b_id_farm}/${calendar}/grazing`}
                      className="text-primary font-medium hover:underline flex items-center gap-1"
                    >
                      Aanvullen in kalender →
                    </NavLink>
                  </div>
                )}

                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                  <Landmark className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Stikstofgebruiksnorm</p>
                      <p className="mt-0.5">
                        Beweiding {calendar} staat aan. In de stikstofgebruiksnorm rekent dit als beweid grasland in plaats van geheel maaien.
                      </p>
                    </div>
                    <NavLink
                      to={`/farm/${b_id_farm}/${calendar}/norms`}
                      className="text-primary font-medium hover:underline text-xs shrink-0 ml-4"
                    >
                      Bekijk Gebruiksruimte →
                    </NavLink>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Provenance Footer */}
            <div className="border-t pt-4 text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Herkomst: handmatig ingevulde beweidingsregistraties · GVE-factoren uit de diercategorieëncatalogus · gebruiksnorm-effect via de bestaande normen van {calendar}.</span>
            </div>
          </div>
        </FarmContent>
      </main>
    </SidebarInset>
  )
}
