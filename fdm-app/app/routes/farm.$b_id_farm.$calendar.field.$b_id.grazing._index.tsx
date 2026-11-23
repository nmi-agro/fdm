import { calculateRestBeforeUses, REST_PERIOD_THRESHOLD_DAYS } from "@nmi-agro/fdm-calculator"
import {
  checkPermission,
  getCultivationsForFarm,
  getFarm,
  getCensusForFarm,
  getField,
  getGrazing,
  getGrazingForField,
  getHarvestsForFarm,
  getHerdsForFarm,
} from "@nmi-agro/fdm-core"
import { cn } from "cn"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { AlertTriangle, Plus } from "lucide-react"
import { lazy, Suspense, useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
} from "react-router"
import { GrazingPopover } from "~/components/blocks/grazing/grazing-popover"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe, getTimeframeForYears } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { formText } from "~/lib/form"
import {
  censusDateForYear,
  farmDayDate,
  farmToday,
  farmTodayKey,
  fieldGrazingTotals,
} from "~/lib/grazing-dates"
import { handleGrazingEvent } from "~/lib/grazing-events.server"
import { zoneWithinField } from "~/lib/grazing-herds"
import { defaultMapDay } from "~/lib/grazing-map"
import { GRAZING_USE_COLORS } from "~/lib/grazing-status"
import { serverNow } from "~/lib/server-now.server"

const formatNumber = (value: number) => value.toLocaleString("nl-NL", { maximumFractionDigits: 2 })

/** "1 dag", "3 dagen": a count with the singular or plural of a word. */
const countOf = (count: number, singular: string, plural: string) =>
  `${count.toLocaleString("nl-NL")} ${count === 1 ? singular : plural}`

// Lazy-loaded to avoid SSR issues with maplibre-gl and to keep it out of the initial bundle
const GrazingZonesMap = lazy(() => import("~/components/blocks/grazing/grazing-zones-map"))

export const meta: MetaFunction = () => {
  return [
    { title: `Beweiding perceel | ${clientConfig.name}` },
    {
      name: "description",
      content: "Beweidingshistorie en maaimomenten van dit perceel.",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const b_id = params.b_id
    const calendar = getCalendar(params)

    if (!b_id_farm || !b_id) {
      throw data("Farm ID and Field ID are required", { status: 400 })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)
    // A single year, or null when the calendar shows all years
    const calendarYear = Number.isInteger(Number(calendar)) ? Number(calendar) : null
    // Today's calendar day in the Netherlands, as a date-only value like the grazing dates
    const now = serverNow()
    const today = farmToday(now)
    // The rest before the first use of a year counts from a use in the year before, so that year
    // is loaded as well; the page itself only shows the selected year
    const contextTimeframe =
      calendarYear !== null
        ? { start: new Date(Date.UTC(calendarYear - 1, 0, 1)), end: timeframe.end }
        : timeframe
    // Harvest dates are moments; they count on their calendar day in the Netherlands
    const harvestTimeframe =
      calendarYear !== null ? getTimeframeForYears(calendarYear - 1, calendarYear) : timeframe
    const inYear = (start: Date, end: Date | null) =>
      calendarYear === null ||
      (start.getUTCFullYear() <= calendarYear && (!end || end.getUTCFullYear() >= calendarYear))

    const [
      farm,
      field,
      herds,
      contextGrazings,
      cultivationsByField,
      harvestsByCultivation,
      census,
    ] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getField(fdm, session.principal_id, b_id),
      getHerdsForFarm(fdm, session.principal_id, b_id_farm),
      getGrazingForField(fdm, session.principal_id, b_id, contextTimeframe),
      getCultivationsForFarm(fdm, session.principal_id, b_id_farm, contextTimeframe),
      getHarvestsForFarm(fdm, session.principal_id, b_id_farm, harvestTimeframe),
      // The herds of the selected year, also for a past year
      getCensusForFarm(
        fdm,
        session.principal_id,
        b_id_farm,
        calendarYear !== null ? censusDateForYear(calendarYear) : new Date(),
      ),
    ])
    const censusMap = new Map(census.map((c) => [c.l_id_herd, c.count]))

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )

    const herdMap = new Map(herds.map((h) => [h.l_id_herd, h]))

    // Mowings: only harvests of grass count as a use of the grassland
    const cults = (cultivationsByField.get(b_id) ?? []).filter(
      (c) => c.b_lu_croprotation === "grass",
    )
    const contextHarvests = cults.flatMap((c) =>
      (harvestsByCultivation.get(c.b_lu) ?? []).flatMap((h) => {
        if (!h.b_lu_harvest_date) return []
        return [
          {
            b_id_harvesting: h.b_id_harvesting,
            b_lu: h.b_lu,
            b_lu_name: c.b_lu_name,
            b_harvest_date: farmDayDate(h.b_lu_harvest_date).toISOString(),
          },
        ]
      }),
    )

    // The grazings and mowings of the selected year; a stored grazing without an end counts in
    // its start year only
    const grazings = contextGrazings.filter((g) => {
      const start = new Date(g.l_grazing_start)
      return inYear(start, g.l_grazing_end ? new Date(g.l_grazing_end) : start)
    })
    const fieldHarvests = contextHarvests.filter((h) => {
      const date = new Date(h.b_harvest_date)
      return inYear(date, date)
    })
    const shownIds = new Set([
      ...grazings.map((g) => g.l_id_grazing),
      ...fieldHarvests.map((h) => h.b_id_harvesting),
    ])

    // Grazing days and hours so far, counted as in the grazing calendar: each day once, a grazing
    // up to today, and planned days not yet
    const { days: totalGrazingDays, hours: totalGrazingHours } = fieldGrazingTotals(
      grazings,
      calendarYear,
      today,
    )

    // Grazings that have started by today; later ones are planned
    const startedGrazings = grazings.filter((g) => new Date(g.l_grazing_start) <= today)

    // Merge events to compute rest periods, with the uses of the year before as context
    const allEvents = [
      ...contextGrazings
        .map((g) => {
          const start = new Date(g.l_grazing_start)
          // Every grazing has an end; a record without one covers its start day
          const end = g.l_grazing_end ? new Date(g.l_grazing_end) : start
          return { g, start, end }
        })
        .map(({ g, start, end }) => ({
          type: "weiden" as const,
          id: g.l_id_grazing,
          start,
          end,
          herdName: herdMap.get(g.l_id_herd)?.l_herd_name ?? "Koppel",
          hours: g.l_grazing_hours,
          area: g.l_grazing_area_grazed ?? field.b_area,
          areaType: g.l_grazing_geometry_zone
            ? ("zone" as const)
            : g.l_grazing_area
              ? ("partial" as const)
              : ("full" as const),
          zone: zoneWithinField(g.l_grazing_geometry_zone, field.b_geometry),
          // What the grazing dialog needs to change or remove this grazing
          grazing: {
            l_id_grazing: g.l_id_grazing,
            l_id_herd: g.l_id_herd,
            // The stored calendar days (midnight UTC), in any time zone
            l_grazing_start: new Date(g.l_grazing_start).toISOString().slice(0, 10),
            l_grazing_end: g.l_grazing_end
              ? new Date(g.l_grazing_end).toISOString().slice(0, 10)
              : null,
            l_grazing_hours: g.l_grazing_hours,
            l_grazing_area: g.l_grazing_area,
            l_grazing_geometry_zone: g.l_grazing_geometry_zone ?? null,
          },
        })),
      ...contextHarvests.map((h) => ({
        type: "maaien" as const,
        id: h.b_id_harvesting,
        start: new Date(h.b_harvest_date),
        end: new Date(h.b_harvest_date),
        herdName: null,
        hours: null,
        area: field.b_area,
        areaType: "full" as const,
        zone: null,
        grazing: null,
      })),
    ]

    // Rest before each event, counted from the last use of the same part of the field, so
    // successive strips each get their own rest
    const eventsWithRest = calculateRestBeforeUses(
      allEvents.map((ev) => ({
        type: ev.type,
        start: ev.start,
        end: ev.end,
        zone: ev.zone,
        data: ev,
      })),
    )
      .map(({ use, restDays }) => {
        const { zone: _zone, ...ev } = use.data!
        return {
          ...ev,
          startStr: format(ev.start, "d MMMM", { locale: nl }),
          endStr: format(ev.end, "d MMMM", { locale: nl }),
          restDays,
          isShortRest: restDays !== null && restDays < REST_PERIOD_THRESHOLD_DAYS,
        }
      })
      // Only the uses of the selected year are shown
      .filter((ev) => shownIds.has(ev.id))
      .reverse() // Most recent first for display

    return {
      b_id_farm,
      b_id,
      b_name_farm: farm.b_name_farm,
      b_name: field.b_name,
      // Unrounded: the grazing dialog computes the area it saves from it; the display rounds
      b_area: field.b_area ?? 0,
      calendar,
      calendarYear,
      todayKey: farmTodayKey(now),
      herds: herds.map((h) => ({
        l_id_herd: h.l_id_herd,
        l_herd_name: h.l_herd_name ?? "Koppel",
        l_id_category: h.l_id_category,
        l_lsu: h.l_lsu ?? 1.0,
        count: censusMap.get(h.l_id_herd) ?? 0,
      })),
      b_geometry: field.b_geometry,
      // The zones grazed so far; planned grazings are in the list but not on the map
      zones: startedGrazings.flatMap((g) =>
        g.l_grazing_geometry_zone ? [g.l_grazing_geometry_zone] : [],
      ),
      summary: {
        totalDays: totalGrazingDays,
        totalHours: totalGrazingHours,
        periodsCount: startedGrazings.length,
        harvestsCount: fieldHarvests.length,
      },
      events: eventsWithRest,
      fieldHarvests,
      farmWritePermission,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const b_id = params.b_id
    if (!b_id_farm || !b_id) {
      throw data("Farm ID and Field ID are required", { status: 400 })
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

    // The grazing dialog of this page records grazing on this field, and only changes or removes
    // a grazing of this field
    const formData = await request.formData()
    formData.set("b_id", b_id)
    const intent = formText(formData, "intent")
    const l_id_grazing = formText(formData, "l_id_grazing")
    if ((intent === "update_grazing" || intent === "remove_grazing") && l_id_grazing) {
      const grazing = await getGrazing(fdm, session.principal_id, l_id_grazing)
      if (grazing.b_id !== b_id) {
        throw data("Beweiding niet gevonden op dit perceel", { status: 404 })
      }
    }
    return await handleGrazingEvent(formData, {
      principal_id: session.principal_id,
      calendar: getCalendar(params),
    })
  } catch (error) {
    return handleActionError(error)
  }
}

export default function FieldGrazingPage() {
  const {
    b_id_farm,
    b_id,
    b_name,
    b_area,
    calendar,
    calendarYear,
    todayKey,
    herds,
    summary,
    events,
    fieldHarvests,
    farmWritePermission,
    b_geometry,
    zones,
  } = useLoaderData<typeof loader>()

  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  // Bumped on every open so the popover remounts with the form of the chosen grazing
  const [popoverSession, setPopoverSession] = useState(0)
  // The grazing to change or remove; null adds a new one
  const [editedGrazing, setEditedGrazing] = useState<(typeof events)[number]["grazing"]>(null)

  // A new grazing starts on today's day and month in the selected year
  const newGrazingDay = calendarYear !== null ? defaultMapDay(todayKey, calendarYear) : undefined

  const openGrazing = (grazing: (typeof events)[number]["grazing"]) => {
    setPopoverSession((s) => s + 1)
    setEditedGrazing(grazing)
    setIsPopoverOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Beweiding & Graslandgebruik {calendar}
          </h3>
          <p className="text-muted-foreground text-xs">
            {formatNumber(b_area)} ha · Beweidingsperioden, maaimomenten en rusttijden
          </p>
        </div>
        {farmWritePermission && (
          <Button
            type="button"
            onClick={() => openGrazing(null)}
            disabled={herds.length === 0}
            className="gap-1.5 text-xs font-medium"
          >
            <Plus className="h-4 w-4" />
            Beweiding toevoegen
          </Button>
        )}
      </div>

      {/* Headline Summary Card */}
      <Card>
        <CardContent className="p-4">
          {/* Two by two until the four figures fit on one line; the dots only show on that line */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm xl:flex xl:flex-wrap xl:items-center">
            <div>
              <span className="text-muted-foreground">Dit jaar: </span>
              <strong className="text-foreground font-semibold">
                {countOf(summary.totalDays, "weidedag", "weidedagen")}
              </strong>
            </div>
            <span aria-hidden="true" className="text-muted-foreground hidden xl:inline">
              ·
            </span>
            <div>
              <strong className="text-foreground font-semibold">
                {countOf(summary.totalHours, "weide-uur", "weide-uren")}
              </strong>
            </div>
            <span aria-hidden="true" className="text-muted-foreground hidden xl:inline">
              ·
            </span>
            <div>
              <strong className="text-foreground font-semibold">
                {countOf(summary.periodsCount, "beweidingsperiode", "beweidingsperioden")}
              </strong>
            </div>
            <span aria-hidden="true" className="text-muted-foreground hidden xl:inline">
              ·
            </span>
            <div>
              <strong className="text-foreground font-semibold">
                {countOf(summary.harvestsCount, "snede gemaaid", "sneden gemaaid")}
              </strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zones grazed this year */}
      {b_geometry && zones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Beweide zones {calendar}</CardTitle>
            <CardDescription className="text-xs">
              De delen van het perceel die als zone zijn beweid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
                <GrazingZonesMap fieldGeometry={b_geometry} zones={zones} height="280px" />
              </Suspense>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gebruikshistorie {calendar}</CardTitle>
          <CardDescription className="text-xs">
            Chronologisch overzicht van beweidingen en maaisneden op dit perceel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Periode</TableHead>
                  <TableHead>Gebruik / Koppel</TableHead>
                  <TableHead className="text-right">Uren/dag</TableHead>
                  <TableHead>Oppervlak</TableHead>
                  <TableHead className="text-right">Rust ervoor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                      Nog geen beweiding of oogst geregistreerd voor dit perceel in {calendar}.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((ev, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs tabular-nums">
                        {ev.grazing && ev.grazing.l_grazing_end === null
                          ? `vanaf ${ev.startStr}`
                          : ev.startStr === ev.endStr
                            ? ev.startStr
                            : `${ev.startStr} – ${ev.endStr}`}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                            style={{
                              backgroundColor:
                                ev.type === "weiden"
                                  ? GRAZING_USE_COLORS.weiden
                                  : GRAZING_USE_COLORS.maaien,
                            }}
                          />
                          {ev.grazing && farmWritePermission ? (
                            // The grazing opens in the grazing dialog, also outside the season
                            // of the grazing calendar
                            <button
                              type="button"
                              onClick={() => openGrazing(ev.grazing)}
                              className="cursor-pointer underline-offset-2 hover:underline focus-visible:underline"
                            >
                              {ev.herdName}
                              <span className="sr-only"> (beweiding wijzigen)</span>
                            </button>
                          ) : (
                            <span>{ev.type === "weiden" ? ev.herdName : "Maaisnede"}</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {ev.hours != null ? `${formatNumber(ev.hours)} uur` : "—"}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {ev.areaType === "zone" && ev.area != null
                          ? `${formatNumber(ev.area)} ha (zone)`
                          : ev.areaType === "partial" && ev.area != null
                            ? `${formatNumber(ev.area)} ha (deel)`
                            : "Volledig"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {ev.restDays !== null ? (
                          <span
                            className={cn(
                              ev.isShortRest &&
                                "flex items-center justify-end gap-1 font-semibold text-amber-800",
                            )}
                          >
                            {ev.isShortRest && (
                              <AlertTriangle aria-hidden="true" className="h-3 w-3" />
                            )}
                            <span key={ev.isShortRest ? "short" : "normal"}>
                              {ev.isShortRest
                                ? `${countOf(ev.restDays, "dag", "dagen")} (kort)`
                                : countOf(ev.restDays, "dag", "dagen")}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {fieldHarvests.length > 0 && (
            <p className="text-muted-foreground mt-4 text-xs">
              Maaimomenten komen uit de oogstregistratie van de graslandteelt op dit perceel.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Grazing dialog: a new grazing, or the grazing picked in the table */}
      <GrazingPopover
        key={popoverSession}
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        b_id_farm={b_id_farm}
        calendar={calendar}
        field={{ b_id, b_name, b_area }}
        existingGrazing={editedGrazing}
        initialStartDate={editedGrazing?.l_grazing_start ?? newGrazingDay}
        initialEndDate={editedGrazing ? (editedGrazing.l_grazing_end ?? undefined) : newGrazingDay}
        herds={herds}
        canWrite={farmWritePermission}
      />
    </div>
  )
}
