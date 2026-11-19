import { calculateRestBeforeUses, REST_PERIOD_THRESHOLD_DAYS } from "@nmi-agro/fdm-calculator"
import {
  checkPermission,
  getCultivationsForFarm,
  getFarm,
  getCensusForFarm,
  getField,
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
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { handleGrazingEvent } from "~/lib/grazing-events.server"
import { GRAZING_USE_COLORS } from "~/lib/grazing-status"

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
    const calendar = params.calendar ?? String(new Date().getFullYear())

    if (!b_id_farm || !b_id) {
      throw data("Farm ID and Field ID are required", { status: 400 })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)

    const [farm, field, herds, grazings, cultivationsByField, harvestsByCultivation, census] =
      await Promise.all([
        getFarm(fdm, session.principal_id, b_id_farm),
        getField(fdm, session.principal_id, b_id),
        getHerdsForFarm(fdm, session.principal_id, b_id_farm),
        getGrazingForField(fdm, session.principal_id, b_id, timeframe),
        getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getHarvestsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getCensusForFarm(fdm, session.principal_id, b_id_farm),
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

    // Field harvests
    const cults = cultivationsByField.get(b_id) ?? []
    const fieldHarvests = cults.flatMap((c) =>
      (harvestsByCultivation.get(c.b_lu) ?? []).flatMap((h) => {
        if (!h.b_lu_harvest_date) return []
        return [
          {
            b_id_harvesting: h.b_id_harvesting,
            b_lu: h.b_lu,
            b_lu_name: c.b_lu_name,
            b_harvest_date: new Date(h.b_lu_harvest_date).toISOString(),
          },
        ]
      }),
    )

    // Calculate summary statistics
    let totalGrazingDays = 0
    let totalGrazingHours = 0

    for (const g of grazings) {
      const start = new Date(g.l_grazing_start)
      const end = g.l_grazing_end ? new Date(g.l_grazing_end) : start
      const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
      totalGrazingDays += days
      totalGrazingHours += days * (g.l_grazing_hours ?? 8)
    }

    // Merge events to compute rest periods
    const allEvents = [
      ...grazings.map((g) => ({
        type: "weiden" as const,
        id: g.l_id_grazing,
        start: new Date(g.l_grazing_start),
        end: new Date(g.l_grazing_end ?? g.l_grazing_start),
        herdName: herdMap.get(g.l_id_herd)?.l_herd_name ?? "Koppel",
        hours: g.l_grazing_hours,
        area: g.l_grazing_area_grazed ?? field.b_area,
        areaType: g.l_grazing_geometry_zone
          ? ("zone" as const)
          : g.l_grazing_area
            ? ("partial" as const)
            : ("full" as const),
        zone: g.l_grazing_geometry_zone ?? null,
        // What the grazing dialog needs to change or remove this grazing
        grazing: {
          l_id_grazing: g.l_id_grazing,
          l_id_herd: g.l_id_herd,
          l_grazing_start: format(new Date(g.l_grazing_start), "yyyy-MM-dd"),
          l_grazing_end: g.l_grazing_end ? format(new Date(g.l_grazing_end), "yyyy-MM-dd") : null,
          l_grazing_hours: g.l_grazing_hours,
          l_grazing_area: g.l_grazing_area,
          l_grazing_geometry_zone: g.l_grazing_geometry_zone ?? null,
        },
      })),
      ...fieldHarvests.map((h) => ({
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
      .reverse() // Most recent first for display

    return {
      b_id_farm,
      b_id,
      b_name_farm: farm.b_name_farm,
      b_name: field.b_name,
      b_area: field.b_area != null ? Math.round(field.b_area * 10) / 10 : 0,
      calendar,
      herds: herds.map((h) => ({
        l_id_herd: h.l_id_herd,
        l_herd_name: h.l_herd_name ?? "Koppel",
        l_id_category: h.l_id_category ?? "rvo_100",
        l_lsu: h.l_lsu ?? 1.0,
        count: censusMap.get(h.l_id_herd) ?? 0,
      })),
      b_geometry: field.b_geometry,
      zones: grazings.flatMap((g) =>
        g.l_grazing_geometry_zone ? [g.l_grazing_geometry_zone] : [],
      ),
      summary: {
        totalDays: totalGrazingDays,
        totalHours: totalGrazingHours,
        periodsCount: grazings.length,
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

    // The grazing dialog of this page records grazing on this field
    const formData = await request.formData()
    formData.set("b_id", b_id)
    return await handleGrazingEvent(formData, {
      principal_id: session.principal_id,
      calendar: params.calendar ?? String(new Date().getFullYear()),
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
                            <span>
                              {countOf(ev.restDays, "dag", "dagen")}
                              {ev.isShortRest ? " (kort)" : ""}
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
        initialStartDate={editedGrazing?.l_grazing_start}
        initialEndDate={editedGrazing?.l_grazing_end ?? undefined}
        herds={herds}
        canWrite={farmWritePermission}
      />
    </div>
  )
}
