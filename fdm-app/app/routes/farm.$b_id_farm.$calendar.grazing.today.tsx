import type { FeatureCollection, Geometry } from "geojson"
import {
  addGrazing,
  checkPermission,
  getCensusForFarm,
  getCultivationsForFarm,
  getFarm,
  getFarms,
  getFields,
  getGrazingCalendarForFarm,
  getHarvestsForFarm,
  updateGrazing,
} from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import { addDays, differenceInDays, format } from "date-fns"
import { nl } from "date-fns/locale"
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react"
import { useMemo, useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import { QuickEntrySheet } from "~/components/blocks/grazing/quick-entry-sheet"
import { TodayGrazingMap } from "~/components/blocks/grazing/today-map"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import { SidebarInset } from "~/components/ui/sidebar"
import { useToday } from "~/hooks/use-today"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { fetchGrazingCalendarMatrix } from "~/lib/grazing-calendar.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Vandaag op de kaart | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Bekijk welke koppel op welk perceel loopt en leg snel wijzigingen vast op de kaart.",
    },
  ]
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
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
    const timeframe = getTimeframe(params)

    const [
      farm,
      farms,
      allFields,
      cultivationsByField,
      harvestsByCultivation,
      grazings,
      census,
      matrix,
    ] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
      getFields(fdm, session.principal_id, b_id_farm, timeframe),
      getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getHarvestsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getGrazingCalendarForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getCensusForFarm(fdm, session.principal_id, b_id_farm),
      fetchGrazingCalendarMatrix(session.principal_id, b_id_farm, calendarYear),
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

    // Build herd census map
    const herdCensusMap: Record<string, number> = {}
    for (const c of census) {
      if (c.l_id_herd) {
        herdCensusMap[c.l_id_herd] = (herdCensusMap[c.l_id_herd] ?? 0) + 1
      }
    }

    // Build harvests per field
    const harvestsByFieldData: Record<
      string,
      Array<{ b_id_harvesting: string; harvestDate: string; yield?: number | null }>
    > = {}

    for (const field of allFields) {
      const cults = cultivationsByField.get(field.b_id) ?? []
      const fieldHarvests = cults.flatMap((c) =>
        (harvestsByCultivation.get(c.b_lu) ?? []).flatMap((h) => {
          if (!h.b_lu_harvest_date) return []
          return [
            {
              b_id_harvesting: h.b_id_harvesting,
              harvestDate: toIsoDate(new Date(h.b_lu_harvest_date)),
              yield: h.harvestable?.harvestable_analyses?.[0]?.b_lu_yield,
            },
          ]
        }),
      )
      harvestsByFieldData[field.b_id] = fieldHarvests
    }

    // Process all fields into GeoJSON
    const featureCollection: FeatureCollection = {
      type: "FeatureCollection",
      features: allFields.map((field) => {
        const cults = cultivationsByField.get(field.b_id) ?? []
        const isGrassland = cults.some((c) => c.b_lu_croprotation === "grass")
        const isBufferstrip = Boolean(field.b_bufferstrip)

        return {
          type: "Feature" as const,
          properties: {
            b_id: field.b_id,
            b_name: field.b_name,
            b_area: Math.round((field.b_area ?? 0) * 10) / 10,
            isGrassland,
            isBufferstrip,
          },
          geometry: simplify(field.b_geometry as Geometry, {
            tolerance: 0.00001,
            highQuality: true,
          }),
        }
      }),
    }

    // Format grazings with serialized dates
    const serializedGrazings = grazings.map((g) => ({
      l_id_grazing: g.l_id_grazing,
      l_id_herd: g.l_id_herd,
      l_herd_name: g.l_herd_name ?? "Koppel",
      b_id: g.b_id,
      b_name: g.b_name,
      l_grazing_start: toIsoDate(new Date(g.l_grazing_start)),
      l_grazing_end: g.l_grazing_end ? toIsoDate(new Date(g.l_grazing_end)) : null,
      l_grazing_hours: g.l_grazing_hours,
      l_grazing_geometry_zone: g.l_grazing_geometry_zone ?? null,
    }))

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      farmOptions,
      matrix,
      openGrazings: matrix.openGrazings,
      fieldsGeoJSON: featureCollection,
      grazings: serializedGrazings,
      harvestsByField: harvestsByFieldData,
      herdCensusMap,
      farmWritePermission,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

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
    const intent = String(formData.get("intent") ?? "")

    if (intent === "add_grazing") {
      const b_id = String(formData.get("b_id") ?? "")
      const l_id_herd = String(formData.get("l_id_herd") ?? "")
      const l_grazing_start = new Date(String(formData.get("l_grazing_start")))
      const endVal = formData.get("l_grazing_end")
      const l_grazing_end = endVal ? new Date(String(endVal)) : undefined
      const hoursVal = formData.get("l_grazing_hours")
      const l_grazing_hours = hoursVal ? parseFloat(String(hoursVal)) : undefined

      await addGrazing(fdm, session.principal_id, l_id_herd, l_grazing_start, {
        b_id: b_id || undefined,
        l_grazing_end,
        l_grazing_hours,
      })

      return dataWithSuccess({}, { message: "Beweiding vastgelegd." })
    }

    if (intent === "update_grazing") {
      const l_id_grazing = String(formData.get("l_id_grazing") ?? "")
      const endVal = formData.get("l_grazing_end")
      const hoursVal = formData.get("l_grazing_hours")

      await updateGrazing(fdm, session.principal_id, l_id_grazing, {
        l_grazing_end: endVal ? new Date(String(endVal)) : undefined,
        l_grazing_hours: hoursVal ? parseFloat(String(hoursVal)) : undefined,
      })

      return dataWithSuccess({}, { message: "Beweidingsregistratie bijgewerkt." })
    }

    throw data("Ongeldige actie", { status: 400 })
  } catch (error) {
    return handleActionError(error)
  }
}

export default function TodayMapPage() {
  const {
    b_id_farm,
    calendar,
    farmOptions,
    matrix,
    openGrazings,
    fieldsGeoJSON,
    grazings,
    harvestsByField,
    herdCensusMap,
    farmWritePermission,
  } = useLoaderData<typeof loader>()

  // "Today" is only known on the client; the selected day is an offset from it
  const today = useToday()
  const [dayOffset, setDayOffset] = useState(0)
  const [quickEntryFieldId, setQuickEntryFieldId] = useState<string | undefined>(undefined)
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false)

  const currentDate = today ? addDays(today, dayOffset) : undefined
  const dateStr = currentDate ? format(currentDate, "yyyy-MM-dd") : ""
  const displayDate = currentDate
    ? format(currentDate, "EEEE d MMMM yyyy", { locale: nl })
    : "Vandaag"

  const handlePrevDay = () => setDayOffset((offset) => offset - 1)
  const handleNextDay = () => setDayOffset((offset) => offset + 1)
  const handleToday = () => setDayOffset(0)

  const handleFieldCardClick = (b_id: string) => {
    setQuickEntryFieldId(b_id)
    setIsQuickEntryOpen(true)
  }

  // Zones grazed on the selected day, drawn on top of the field colour
  const todayZones = useMemo(
    () =>
      grazings.flatMap((g) => {
        const end = g.l_grazing_end ?? g.l_grazing_start
        return g.l_grazing_geometry_zone && dateStr >= g.l_grazing_start && dateStr <= end
          ? [g.l_grazing_geometry_zone]
          : []
      }),
    [grazings, dateStr],
  )

  // Derive dynamic map GeoJSON with exact daily status, colors, and badge labels
  const dynamicGeoJSON: FeatureCollection = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: fieldsGeoJSON.features.map((feature) => {
        const b_id = feature.properties?.b_id as string
        const isGrassland = feature.properties?.isGrassland as boolean
        const isBufferstrip = feature.properties?.isBufferstrip as boolean

        // 1. Non-grassland or bufferstrip -> Disabled / Greyed out (no label rendered on map)
        if (isBufferstrip || !isGrassland) {
          return {
            ...feature,
            properties: {
              ...feature.properties,
              status: "disabled",
              labelText: null,
              herdName: null,
              hours: null,
              restDays: null,
            },
          }
        }

        // 2. Active grazing today on this field
        const activeGrazing = grazings.find((g) => {
          if (g.b_id !== b_id) return false
          const start = g.l_grazing_start
          const end = g.l_grazing_end ?? start
          return dateStr >= start && dateStr <= end
        })

        if (activeGrazing) {
          const count = herdCensusMap[activeGrazing.l_id_herd]
          const countLabel = count ? `${count} ${count === 1 ? "dier" : "dieren"}` : null
          const labelText = countLabel
            ? `${activeGrazing.l_herd_name} (${countLabel})`
            : activeGrazing.l_herd_name

          return {
            ...feature,
            properties: {
              ...feature.properties,
              status: "weiden_today",
              labelText,
              herdName: activeGrazing.l_herd_name,
              animalCount: count ?? null,
              hours: activeGrazing.l_grazing_hours ?? null,
              restDays: null,
            },
          }
        }

        // 3. Active mowing / harvest today on this field
        const fieldHarvests = harvestsByField[b_id] ?? []
        const activeHarvest = fieldHarvests.find((h) => h.harvestDate === dateStr)

        if (activeHarvest) {
          const labelText = activeHarvest.yield
            ? `${Math.round(activeHarvest.yield)} kg ds/ha`
            : "Gemaaid"

          return {
            ...feature,
            properties: {
              ...feature.properties,
              status: "maaien_today",
              labelText,
              herdName: null,
              hours: null,
              restDays: null,
            },
          }
        }

        // 4. Inactive today -> Find last previous use (grazing or mowing) on or before dateStr
        const pastGrazings = grazings
          .filter((g) => g.b_id === b_id && g.l_grazing_start < dateStr)
          .map((g) => ({
            type: "weiden" as const,
            date: g.l_grazing_end ?? g.l_grazing_start,
          }))

        const pastHarvests = fieldHarvests
          .filter((h) => h.harvestDate < dateStr)
          .map((h) => ({
            type: "maaien" as const,
            date: h.harvestDate,
          }))

        const allPastEvents = [...pastGrazings, ...pastHarvests].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )

        if (allPastEvents.length > 0) {
          const lastEvent = allPastEvents[0]
          const diffDays = Math.max(
            0,
            differenceInDays(new Date(dateStr), new Date(lastEvent.date)),
          )

          const status = lastEvent.type === "weiden" ? "last_weiden" : "last_maaien"
          const labelText = `${diffDays}d rust`

          return {
            ...feature,
            properties: {
              ...feature.properties,
              status,
              labelText,
              herdName: null,
              hours: null,
              restDays: diffDays,
            },
          }
        }

        // 5. No prior event this season on this grassland parcel
        return {
          ...feature,
          properties: {
            ...feature.properties,
            status: "unused",
            labelText: "Nog niet gebruikt",
            herdName: null,
            hours: null,
            restDays: null,
          },
        }
      }),
    }
  }, [fieldsGeoJSON, grazings, harvestsByField, herdCensusMap, dateStr])

  return (
    <SidebarInset className="relative flex h-[calc(100vh-theme(spacing.16))] flex-col overflow-hidden">
      <Header
        action={{
          to: `/farm/${b_id_farm}/${calendar}/grazing`,
          label: "Terug naar Beweidingskalender",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbLink render={<NavLink to={`/farm/${b_id_farm}/${calendar}/grazing`} />}>
          Beweiding
        </BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbItem>Vandaag op de kaart</BreadcrumbItem>
      </Header>

      <main className="relative h-full w-full flex-1 overflow-hidden">
        {/* Full Section Interactive Map */}
        <TodayGrazingMap
          fieldsGeoJSON={dynamicGeoJSON}
          zones={todayZones}
          height="100%"
          onFieldClick={handleFieldCardClick}
        />

        {/* Floating Top Control Bar Overlay */}
        <div className="pointer-events-none absolute top-4 right-4 left-4 z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="bg-background/90 pointer-events-auto flex items-center gap-3 rounded-xl border p-2 px-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handlePrevDay}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Vorige dag</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs font-semibold"
                onClick={handleToday}
              >
                <span key={dateStr || "today"}>{displayDate}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handleNextDay}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Volgende dag</span>
              </Button>
            </div>
          </div>

          {farmWritePermission && (
            <div className="bg-background/90 pointer-events-auto rounded-xl border p-1 shadow-lg backdrop-blur-md">
              <Button
                size="sm"
                onClick={() => {
                  setQuickEntryFieldId(undefined)
                  setIsQuickEntryOpen(true)
                }}
                className="gap-1.5 text-xs font-medium"
              >
                <LogOut className="h-4 w-4" />
                Koeien naar buiten / binnen
              </Button>
            </div>
          )}
        </div>

        {/* Floating Bottom Legend Overlay */}
        <div className="pointer-events-auto absolute right-4 bottom-6 z-10">
          <div className="bg-background/90 max-w-xs space-y-2 rounded-xl border p-3 text-xs shadow-lg backdrop-blur-md">
            <p className="text-foreground text-[11px] font-semibold tracking-wider uppercase">
              Legenda perceelstatus
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500 ring-1 ring-emerald-700" />
                <span>Vandaag beweid</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-amber-500 ring-1 ring-amber-700" />
                <span>Vandaag gemaaid</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-emerald-300" />
                <span>Laatst beweid</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-amber-300" />
                <span>Laatst gemaaid</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800" />
                <span>Nog niet gebruikt</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
                <span>Bufferstrook / overig</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Quick Entry Dialog */}
      <QuickEntrySheet
        open={isQuickEntryOpen}
        onOpenChange={setIsQuickEntryOpen}
        b_id_farm={b_id_farm}
        calendar={calendar}
        herds={matrix.herds}
        fields={matrix.fields}
        openGrazings={openGrazings}
        initialFieldId={quickEntryFieldId}
        canWrite={farmWritePermission}
      />
    </SidebarInset>
  )
}
