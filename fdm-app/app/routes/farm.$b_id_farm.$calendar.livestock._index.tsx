import {
  checkPermission,
  getAnimalCategoriesForFarm,
  getCultivationsForFarm,
  getFarms,
  getFields,
} from "@nmi-agro/fdm-core"
import { cn } from "cn"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { CalendarDays, ChartColumn, Plus, Warehouse } from "lucide-react"
import { useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
} from "react-router"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { GrazingDayCell, RestAlertNotice } from "~/components/blocks/grazing/calendar-grid"
import { FieldPickerButton } from "~/components/blocks/grazing/field-picker-button"
import { GrazingPopover } from "~/components/blocks/grazing/grazing-popover"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { AddAnimalDialog } from "~/components/blocks/livestock/add-animal-dialog"
import { AddHerdDialog } from "~/components/blocks/livestock/add-herd-dialog"
import { HerdCard } from "~/components/blocks/livestock/herd-card"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { SidebarInset } from "~/components/ui/sidebar"
import { useToday } from "~/hooks/use-today"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  fetchGrazingCalendarMatrix,
  type GrazingCalendarMatrix,
} from "~/lib/grazing-calendar.server"
import { handleGrazingEvent, isGrazingIntent } from "~/lib/grazing-events.server"
import { defaultMapDay, shiftDay } from "~/lib/grazing-map"
import { GRAZING_SEASON_LABEL, isInGrazingSeason } from "~/lib/grazing-status"
import { getHerdCards } from "~/lib/herd-cards.server"
import { handleLivestockEvent, isLivestockIntent } from "~/lib/livestock-events.server"

export const handle: HelpHandle = { help: "veestapel" }

export const meta: MetaFunction = () => {
  return [
    { title: `Melkvee | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Overzicht van je melkvee: koppels en dieren, de beweiding van de afgelopen en komende dagen en de kengetallen voor weidegang.",
    },
  ]
}

/** Days before and after the shown day in the grazing overview. */
const DAYS_BACK = 6
const DAYS_AHEAD = 7

/** The key figures of a farm without a herd, which has no grazing calendar yet. */
const EMPTY_SUMMARY: GrazingCalendarMatrix["summary"] = {
  weidedagen: 0,
  averageHours: 0,
  weidemelkDays: 0,
  platformArea: 0,
  platformGvePerHa: null,
  overgrazingAlertsCount: 0,
  alerts: [],
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = getCalendar(params)
    const calendarYear = Number.parseInt(calendar, 10) || new Date().getFullYear()
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)

    const herdCardsPromise = getHerdCards(session.principal_id, b_id_farm, timeframe)
    const [farms, herdCards, categories, allFields, cultivationsByField, matrix] =
      await Promise.all([
        getFarms(fdm, session.principal_id),
        herdCardsPromise,
        getAnimalCategoriesForFarm(fdm, session.principal_id, b_id_farm),
        getFields(fdm, session.principal_id, b_id_farm, timeframe),
        getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        // Days, fields and key figures of the grazing calendar; a farm without a herd only gets
        // the first-herd form, so it skips these reads
        herdCardsPromise.then((cards) =>
          cards.length > 0
            ? fetchGrazingCalendarMatrix(session.principal_id, b_id_farm, calendarYear)
            : null,
        ),
      ])

    const farmOptions = farms.map((f) => ({
      b_id_farm: f.b_id_farm,
      b_name_farm: f.b_name_farm,
    }))

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )

    // Total grassland area (excluding buffer strips)
    const grasslandArea = allFields
      .filter((f) => {
        if (f.b_bufferstrip) return false
        const cults = cultivationsByField.get(f.b_id) ?? []
        return cults.some((c) => c.b_lu_croprotation === "grass")
      })
      .reduce((acc, f) => acc + (f.b_area ?? 0), 0)

    return {
      b_id_farm,
      calendar,
      calendarYear,
      farmOptions,
      herds: herdCards,
      categories,
      grasslandArea: Math.round(grasslandArea * 10) / 10,
      // The grazing fields with their days, and the herds as the grazing dialog needs them
      grazingFields: matrix?.fields ?? [],
      grazingHerds: matrix?.herds ?? [],
      summary: matrix?.summary ?? EMPTY_SUMMARY,
      farmWritePermission,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** Saves the quick entries of the overview: herds, animals and the grazing dialog. */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )
    if (!farmWritePermission) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    const formData = await request.formData()
    const intent = formData.get("intent")
    if (isLivestockIntent(intent)) {
      return await handleLivestockEvent(formData, { principal_id: session.principal_id, b_id_farm })
    }
    if (isGrazingIntent(intent)) {
      return await handleGrazingEvent(formData, {
        principal_id: session.principal_id,
        calendar: getCalendar(params),
      })
    }
    throw data("Ongeldige actie", { status: 400 })
  } catch (error) {
    return handleActionError(error)
  }
}

export default function MelkveeOverview() {
  const {
    b_id_farm,
    calendar,
    calendarYear,
    farmOptions,
    herds,
    categories,
    grasslandArea,
    grazingFields,
    grazingHerds,
    summary,
    farmWritePermission,
  } = useLoaderData<typeof loader>()

  const [isAddHerdOpen, setIsAddHerdOpen] = useState(false)
  const [isAddAnimalOpen, setIsAddAnimalOpen] = useState(false)

  // The grazing dialog for a field picked with "Beweiding toevoegen"
  const [grazingField, setGrazingField] = useState<{
    b_id: string
    b_name: string
    b_area: number
  } | null>(null)
  const [grazingSession, setGrazingSession] = useState(0)

  // "Today" is only known on the client; the overview is centred on today, or on the same day in
  // another year
  const todayDate = useToday()
  const centerDay = todayDate
    ? defaultMapDay(format(todayDate, "yyyy-MM-dd"), calendarYear)
    : undefined

  const totalAnimals = herds.reduce((acc, h) => acc + h.count, 0)
  const totalGve = Number(herds.reduce((acc, h) => acc + h.count * (h.l_lsu ?? 1.0), 0).toFixed(1))
  const gvePerHaGrassland = grasslandArea > 0 ? Number((totalGve / grasslandArea).toFixed(1)) : null
  const calendarHref = `/farm/${b_id_farm}/${calendar}/livestock/grazing`
  const insightsHref = `/farm/${b_id_farm}/${calendar}/livestock/grazing/insights`

  return (
    <SidebarInset>
      <Header action={{ to: `/farm/${b_id_farm}`, label: "Terug naar bedrijf", disabled: false }}>
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbItem>Melkvee</BreadcrumbItem>
      </Header>

      <main>
        <FarmTitle
          title={`Melkvee ${calendar}`}
          description="Je koppels en dieren, de beweiding van deze dagen en de kengetallen voor weidegang."
          rightNode={
            herds.length > 0 && farmWritePermission ? (
              <div className="flex flex-wrap items-center gap-2">
                {grazingFields.length > 0 && (
                  <FieldPickerButton
                    label="Beweiding toevoegen"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    variant="default"
                    fields={grazingFields}
                    onPick={(b_id) => {
                      const field = grazingFields.find((f) => f.b_id === b_id)
                      if (!field) return
                      setGrazingSession((s) => s + 1)
                      setGrazingField({ b_id, b_name: field.b_name, b_area: field.b_area })
                    }}
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setIsAddAnimalOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Dier toevoegen</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setIsAddHerdOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Koppel toevoegen</span>
                </Button>
              </div>
            ) : undefined
          }
        />

        <FarmContent>
          {herds.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <Warehouse className="text-muted-foreground mx-auto h-12 w-12" />
              <h3 className="mt-4 text-lg font-semibold">Nog geen koppels aanwezig</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Voeg een eerste koppel toe om te starten met veestapel- en beweidingsbeheer.
              </p>
              <Button
                className="mt-6 gap-1.5"
                nativeButton={false}
                render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/new`} />}
              >
                <Plus className="h-4 w-4" />
                Melkvee toevoegen
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Key figures */}
              <section className="space-y-3" aria-labelledby="melkvee-kengetallen">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="melkvee-kengetallen" className="text-lg font-semibold">
                    Kengetallen {calendar}
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    nativeButton={false}
                    render={<NavLink to={insightsHref} />}
                  >
                    <ChartColumn className="h-3.5 w-3.5" />
                    Weidegang
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatTile
                    label="Dieren"
                    value={totalAnimals.toLocaleString("nl-NL")}
                    detail={`${totalGve.toLocaleString("nl-NL")} GVE`}
                  />
                  <StatTile
                    label="Weidedagen"
                    value={summary.weidedagen.toLocaleString("nl-NL")}
                    detail={`gemiddeld ${summary.averageHours.toLocaleString("nl-NL")} uur per dag`}
                  />
                  <Card className="gap-2 p-4">
                    <p className="text-muted-foreground text-xs">Weidemelk 120 × 6</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {summary.weidemelkDays}
                      <span className="text-muted-foreground text-sm font-normal">/120 dagen</span>
                    </p>
                    <Progress
                      value={Math.min(100, (summary.weidemelkDays / 120) * 100)}
                      aria-label="Voortgang naar Weidemelk"
                    />
                  </Card>
                  <StatTile
                    label="Beweidingsplatform"
                    value={`${summary.platformArea.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} ha`}
                    detail={
                      summary.platformGvePerHa !== null
                        ? `${summary.platformGvePerHa.toLocaleString("nl-NL")} GVE/ha op het platform`
                        : "Nog geen beweiding"
                    }
                  />
                </div>
                <RestAlertNotice alerts={summary.alerts} insightsHref={insightsHref} />
              </section>

              {/* Grazing of the last and coming days */}
              <GrazingWindow
                centerDay={centerDay}
                fields={grazingFields}
                calendarHref={calendarHref}
              />

              {/* Herds */}
              <section className="space-y-3" aria-labelledby="melkvee-koppels">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="melkvee-koppels" className="text-lg font-semibold">
                    Koppels
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    nativeButton={false}
                    render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/animals`} />}
                  >
                    <Warehouse className="h-3.5 w-3.5" />
                    Al het vee bekijken
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {herds.map((herd) => (
                    <HerdCard
                      key={herd.l_id_herd}
                      b_id_farm={b_id_farm}
                      calendar={calendar}
                      herd={herd}
                      allHerds={herds}
                      status={herd.status}
                      canWrite={farmWritePermission}
                    />
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Aantallen zijn afgeleid uit de dieren in de koppel; GVE volgens de diercategorie.
                  {gvePerHaGrassland !== null
                    ? ` Veebezetting op ${grasslandArea.toLocaleString("nl-NL")} ha grasland: ${gvePerHaGrassland.toLocaleString("nl-NL")} GVE/ha.`
                    : ""}
                </p>
              </section>
            </div>
          )}
        </FarmContent>
      </main>

      <GrazingPopover
        key={grazingSession}
        open={grazingField !== null}
        onOpenChange={(open) => {
          if (!open) setGrazingField(null)
        }}
        b_id_farm={b_id_farm}
        calendar={calendar}
        field={grazingField}
        initialStartDate={centerDay}
        initialEndDate={centerDay}
        herds={grazingHerds}
        canWrite={farmWritePermission}
      />
      <AddAnimalDialog open={isAddAnimalOpen} onOpenChange={setIsAddAnimalOpen} herds={herds} />
      <AddHerdDialog open={isAddHerdOpen} onOpenChange={setIsAddHerdOpen} categories={categories} />
    </SidebarInset>
  )
}

/** A key figure: a label, a large value and a line of detail. */
function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{detail}</p>
    </Card>
  )
}

/**
 * The grazing of the last 7 days and the coming 7 days: per field with a use in that window a
 * strip of days in the colours of the calendar, and the planned grazing of the coming week.
 */
function GrazingWindow({
  centerDay,
  fields,
  calendarHref,
}: {
  centerDay: string | undefined
  fields: Array<{
    b_id: string
    b_name: string
    cells: Array<Parameters<typeof GrazingDayCell>[0]["cell"]>
  }>
  calendarHref: string
}) {
  const days = centerDay
    ? Array.from({ length: DAYS_BACK + DAYS_AHEAD + 1 }, (_, i) =>
        shiftDay(centerDay, i - DAYS_BACK),
      )
    : []
  const rows = fields
    .map((field) => {
      const cellByDay = new Map(field.cells.map((cell) => [cell.dateStart, cell]))
      return { field, cells: days.map((day) => cellByDay.get(day)) }
    })
    .filter((row) => row.cells.some((cell) => cell && cell.type !== "empty"))
  // The calendar only has the days of the grazing season
  const outsideSeason = days.length > 0 && days.every((day) => !isInGrazingSeason(day))

  // Planned grazing in the coming week, once per grazing
  const upcoming = new Map<
    string,
    { herd: string; field: string; start: string; end: string | null }
  >()
  for (const row of rows) {
    row.cells.forEach((cell, i) => {
      if (!cell || i <= DAYS_BACK) return
      for (const g of cell.grazingEntries ?? []) {
        upcoming.set(g.l_id_grazing, {
          herd: g.l_herd_name,
          field: row.field.b_name,
          start: g.l_grazing_start,
          end: g.l_grazing_end,
        })
      }
    })
  }
  const formatShort = (day: string) =>
    format(new Date(`${day}T12:00:00`), "EEE d MMM", { locale: nl })

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-lg">Beweiding</CardTitle>
          <CardDescription className="text-xs">
            De afgelopen week en de komende week, in de kleuren van de beweidingskalender.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          nativeButton={false}
          render={<NavLink to={calendarHref} />}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Beweidingskalender
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground max-w-prose text-sm">
            {outsideSeason
              ? `Deze twee weken vallen buiten het weideseizoen van de beweidingskalender (${GRAZING_SEASON_LABEL}). Beweiding op deze dagen telt wel mee en staat op de tab Beweiding van het perceel.`
              : "Geen beweiding of maaisnede in deze twee weken."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="p-1.5 text-left font-medium">Perceel</th>
                  {days.map((day, i) => (
                    <th
                      key={day}
                      className={cn(
                        "w-7 p-0.5 text-center font-normal",
                        i === DAYS_BACK && "bg-primary/20 text-foreground font-semibold",
                      )}
                    >
                      <span className="block">
                        {format(new Date(`${day}T12:00:00`), "EEEEEE", { locale: nl })}
                      </span>
                      <span className="block tabular-nums">{Number(day.slice(8))}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ field, cells }) => (
                  <tr key={field.b_id} className="border-t">
                    <td className="max-w-40 truncate p-1.5 font-medium">{field.b_name}</td>
                    {cells.map((cell, i) => (
                      <td key={days[i]} className={cn("p-0.5", i === DAYS_BACK && "bg-primary/10")}>
                        {cell ? <GrazingDayCell cell={cell} /> : <div className="h-7" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">Gepland deze week</h3>
          {upcoming.size === 0 ? (
            <p className="text-muted-foreground text-xs">Geen geplande beweiding.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {[...upcoming.values()]
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((g) => (
                  <li key={`${g.herd}-${g.field}-${g.start}`} className="flex flex-wrap gap-x-2">
                    <span className="tabular-nums">
                      {g.end && g.end !== g.start
                        ? `${formatShort(g.start)} – ${formatShort(g.end)}`
                        : formatShort(g.start)}
                    </span>
                    <span className="font-medium">{g.herd}</span>
                    <span className="text-muted-foreground">op {g.field}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
