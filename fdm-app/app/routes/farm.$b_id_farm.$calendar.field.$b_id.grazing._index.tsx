import {
  addGrazing,
  checkPermission,
  getCultivationsForFarm,
  getFarm,
  getField,
  getGrazingForField,
  getHarvestsForFarm,
  getHerdsForFarm,
} from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { AlertTriangle, Plus, Tractor } from "lucide-react"
import { useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import { GrazingPopover } from "~/components/blocks/grazing/grazing-popover"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
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
import { cn } from "~/lib/utils"

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

    const [farm, field, herds, grazings, cultivationsByField, harvestsByCultivation] =
      await Promise.all([
        getFarm(fdm, session.principal_id, b_id_farm),
        getField(fdm, session.principal_id, b_id),
        getHerdsForFarm(fdm, session.principal_id, b_id_farm),
        getGrazingForField(fdm, session.principal_id, b_id, timeframe),
        getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getHarvestsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      ])

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
        area: g.l_grazing_area ?? field.b_area,
        areaType: g.l_grazing_type,
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
      })),
    ].sort((a, b) => a.start.getTime() - b.start.getTime())

    // Compute rest before each event
    const eventsWithRest = allEvents.map((ev, idx) => {
      let restDays: number | null = null
      let isShortRest = false
      if (idx > 0) {
        const prev = allEvents[idx - 1]
        const diffMs = ev.start.getTime() - prev.end.getTime()
        restDays = Math.max(0, Math.floor(diffMs / 86400000))
        isShortRest = restDays < 14
      }
      return {
        ...ev,
        startStr: format(ev.start, "dd-MM-yyyy"),
        endStr: format(ev.end, "dd-MM-yyyy"),
        restDays,
        isShortRest,
      }
    }).reverse() // Most recent first for display

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
      })),
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

    const formData = await request.formData()
    const intent = String(formData.get("intent") ?? "")

    if (intent === "add_grazing") {
      const l_id_herd = String(formData.get("l_id_herd") ?? "")
      const l_grazing_start = new Date(String(formData.get("l_grazing_start")))
      const endVal = formData.get("l_grazing_end")
      const l_grazing_end = endVal ? new Date(String(endVal)) : undefined
      const hoursVal = formData.get("l_grazing_hours")
      const l_grazing_hours = hoursVal ? parseFloat(String(hoursVal)) : undefined
      const areaTypeVal = formData.get("l_grazing_type") as "full" | "partial" | null
      const areaVal = formData.get("l_grazing_area")
      const l_grazing_area = areaVal ? parseFloat(String(areaVal)) : undefined

      await addGrazing(fdm, session.principal_id, l_id_herd, l_grazing_start, {
        b_id,
        l_grazing_end,
        l_grazing_hours,
        l_grazing_type: areaTypeVal ?? "full",
        l_grazing_area,
      })

      return dataWithSuccess({}, { message: "Beweiding op perceel vastgelegd." })
    }

    throw data("Ongeldige actie", { status: 400 })
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
  } = useLoaderData<typeof loader>()

  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Beweiding & Graslandgebruik {calendar}
          </h3>
          <p className="text-muted-foreground text-xs">
            {b_area} ha · Beweidingsperioden, maaimomenten en rusttijden
          </p>
        </div>
        {farmWritePermission && (
          <Button
            type="button"
            onClick={() => setIsPopoverOpen(true)}
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
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Dit jaar: </span>
              <strong className="text-foreground font-semibold">{summary.totalDays} weidedagen</strong>
            </div>
            <span className="text-muted-foreground">·</span>
            <div>
              <strong className="text-foreground font-semibold">{summary.totalHours} weide-uren</strong>
            </div>
            <span className="text-muted-foreground">·</span>
            <div>
              <strong className="text-foreground font-semibold">{summary.periodsCount} beweidingsperioden</strong>
            </div>
            <span className="text-muted-foreground">·</span>
            <div>
              <strong className="text-foreground font-semibold">{summary.harvestsCount} sneden gemaaid</strong>
            </div>
          </div>
        </CardContent>
      </Card>

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
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nog geen beweiding of oogst geregistreerd voor dit perceel in {calendar}.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((ev, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">
                        {ev.startStr === ev.endStr ? ev.startStr : `${ev.startStr} → ${ev.endStr}`}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {ev.type === "weiden" ? (
                          <span className="flex items-center gap-1.5 text-emerald-950 dark:text-emerald-200">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            {ev.herdName}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-amber-950 dark:text-amber-200">
                            <Tractor className="h-3.5 w-3.5 text-amber-600" />
                            Maaisnede
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {ev.hours !== null ? `${ev.hours} u` : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {ev.areaType === "partial" ? `${ev.area} ha (deel)` : "Volledig"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {ev.restDays !== null ? (
                          <span className={cn(ev.isShortRest && "text-amber-600 font-semibold flex items-center justify-end gap-1")}>
                            {ev.isShortRest && <AlertTriangle className="h-3 w-3" />}
                            {ev.restDays} dagen {ev.isShortRest ? "(kort)" : ""}
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
            <div className="mt-4 text-xs text-muted-foreground">
              ⓘ Maaimomenten komen uit de oogstregistratie van de graslandteelt op dit perceel.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Grazing Popover */}
      <GrazingPopover
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        b_id_farm={b_id_farm}
        calendar={calendar}
        field={{ b_id, b_name, b_area }}
        herds={herds}
        canWrite={farmWritePermission}
      />
    </div>
  )
}
