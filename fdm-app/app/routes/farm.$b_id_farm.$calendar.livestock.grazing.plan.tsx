import type { MultiPolygon, Polygon } from "geojson"
import {
  calculateGrazingAllocationArea,
  GRAZING_HOURS_PER_KG_DM_MIN,
  GRAZING_SYSTEMS,
  GROWTH_DURING_GRAZING_KG_DM_HA_DAY,
  type GrazingSystemKey,
  INSCHAREN_DRY_MATTER_TARGET_KG_HA,
  NNW_DAY_AND_NIGHT_HOURS,
  NNW_PLOT_AREA_HA_PER_COW,
  NNW_TOTAL_ROUGHAGE_INTAKE_KG_DM,
} from "@nmi-agro/fdm-calculator/browser"
import {
  addGrazings,
  checkPermission,
  getCensusForFarm,
  getCultivationsForFarm,
  getFarm,
  getFarms,
  getFields,
  getGrazingCalendarForFarm,
  getHerdsForFarm,
} from "@nmi-agro/fdm-core"
import { cn } from "cn"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { AlertTriangle, CheckCircle2, Info, Save } from "lucide-react"
import { lazy, Suspense, useMemo, useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useFetcher,
  useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import type { PlanPreviewZone } from "~/components/blocks/grazing/plan-preview-map"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Badge } from "~/components/ui/badge"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { SidebarInset } from "~/components/ui/sidebar"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { useKeyedState } from "~/hooks/use-keyed-state"
import { useToday } from "~/hooks/use-today"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { type Area, areaHa, cutEqualPlots, cutStrip, toMultiPolygon } from "~/lib/grazing-strip"
import { grazingZoneSchema } from "~/lib/grazing-zone"

/** How the generator sizes the grazed part of a field for a strip system. */
type PartialMode = "percentage" | "strips"

const PlanPreviewMap = lazy(() => import("~/components/blocks/grazing/plan-preview-map"))

const STRIP_DIRECTIONS = [
  { value: "0", label: "Naar het noorden" },
  { value: "90", label: "Naar het oosten" },
  { value: "180", label: "Naar het zuiden" },
  { value: "270", label: "Naar het westen" },
]

export const handle: HelpHandle = { help: "beweidingsplan" }

export const meta: MetaFunction = () => {
  return [
    { title: `Beweidingsplanner | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Maak een beweidingsplan voor je koppel volgens een graslandgebruikssysteem, zoals omweiden of Nieuw Nederlands Weiden.",
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
    const timeframe = getTimeframe(params)

    const [farm, farms, herds, allFields, cultivationsByField, existingGrazings, census] =
      await Promise.all([
        getFarm(fdm, session.principal_id, b_id_farm),
        getFarms(fdm, session.principal_id),
        getHerdsForFarm(fdm, session.principal_id, b_id_farm),
        getFields(fdm, session.principal_id, b_id_farm, timeframe),
        getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getGrazingCalendarForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getCensusForFarm(fdm, session.principal_id, b_id_farm),
      ])
    const censusMap = new Map(census.map((c) => [c.l_id_herd, c.count]))

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

    if (!farmWritePermission) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    const grasslandFields = allFields
      .filter((f) => {
        if (f.b_bufferstrip) return false
        const cults = cultivationsByField.get(f.b_id) ?? []
        return cults.some((c) => c.b_lu_croprotation === "grass")
      })
      .map((f) => ({
        b_id: f.b_id,
        b_name: f.b_name,
        b_area: f.b_area != null ? Math.round(f.b_area * 10) / 10 : 0,
        // Needed to cut grazing strips from the field
        b_geometry: f.b_geometry ?? null,
      }))

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      calendarYear,
      farmOptions,
      herds: herds.map((h) => ({
        l_id_herd: h.l_id_herd,
        l_herd_name: h.l_herd_name ?? "Koppel",
        l_id_category: h.l_id_category ?? "rvo_100",
        l_lsu: h.l_lsu ?? 1.0,
        count: censusMap.get(h.l_id_herd) ?? 0,
      })),
      grasslandFields,
      existingGrazings: existingGrazings.map((g) => ({
        l_id_herd: g.l_id_herd,
        b_id: g.b_id,
        l_grazing_start: new Date(g.l_grazing_start).toISOString(),
        l_grazing_end: g.l_grazing_end ? new Date(g.l_grazing_end).toISOString() : null,
      })),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = params.calendar ?? String(new Date().getFullYear())
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
    const rowsJson = String(formData.get("plan_rows") ?? "[]")
    const rows = JSON.parse(rowsJson) as Array<{
      l_id_herd: string
      b_id: string
      l_grazing_start: string
      l_grazing_end: string
      l_grazing_hours: number
      l_grazing_area?: number
      l_grazing_geometry_zone?: unknown
    }>

    if (rows.length === 0) {
      throw data("Geen perioden om vast te leggen.", { status: 400 })
    }

    await addGrazings(
      fdm,
      session.principal_id,
      rows.map((r) => ({
        l_id_herd: r.l_id_herd,
        b_id: r.b_id,
        l_grazing_start: new Date(r.l_grazing_start),
        l_grazing_end: new Date(r.l_grazing_end),
        l_grazing_hours: r.l_grazing_hours,
        l_grazing_area: r.l_grazing_area,
        l_grazing_geometry_zone: r.l_grazing_geometry_zone
          ? (grazingZoneSchema.parse(r.l_grazing_geometry_zone) as Polygon | MultiPolygon)
          : null,
      })),
    )

    const firstStart = format(new Date(rows[0].l_grazing_start), "dd-MM")
    const lastEnd = format(new Date(rows[rows.length - 1].l_grazing_end), "dd-MM")

    return redirectWithSuccess(
      `/farm/${b_id_farm}/${calendar}/livestock/grazing`,
      `Beweidingsplan vastgelegd: ${rows.length} perioden van ${firstStart} t/m ${lastEnd}.`,
    )
  } catch (error) {
    return handleActionError(error)
  }
}

/** A day of the plan, e.g. "3 mei". */
const formatPlanDay = (day: string) => format(new Date(`${day}T12:00:00`), "d MMM", { locale: nl })

/** An area in hectares with a decimal comma, e.g. "2,43". */
const formatPlanHa = (value: number) => value.toLocaleString("nl-NL", { maximumFractionDigits: 2 })

export default function GrazingPlanAssistent() {
  const {
    b_id_farm,
    calendar,
    calendarYear,
    farmOptions,
    herds,
    grasslandFields,
    existingGrazings,
  } = useLoaderData<typeof loader>()
  const fetcher = useFetcher()

  // "Today" is only known on the client; empty until then
  const today = useToday()
  const todayStr = today ? format(today, "yyyy-MM-dd") : ""
  // The plan runs from 1 May to 15 October, or from today while the season in this calendar year
  // is underway. Once that season is over, the plan keeps the whole season and points to the next
  // year, rather than proposing a rotation in winter.
  const seasonStart = `${calendarYear}-05-01`
  const seasonEnd = `${calendarYear}-10-15`
  const todayInYear = todayStr.startsWith(`${calendarYear}-`) ? todayStr : ""
  const seasonOver = todayInYear > seasonEnd
  // Whether the plan records past grazing, planned grazing or both (the current year)
  const todayYear = todayStr ? Number(todayStr.slice(0, 4)) : calendarYear
  const planTiming =
    calendarYear < todayYear ? "past" : calendarYear > todayYear ? "future" : "current"
  const defaultSeasonStart = todayInYear > seasonStart && !seasonOver ? todayInYear : seasonStart
  const defaultSeasonEnd = seasonEnd

  // Step 1: Systeem
  const [systemKey, setSystemKey] = useState<GrazingSystemKey>("omweiden")

  // Step 2: Parameters
  const [selectedHerdId, setSelectedHerdId] = useState(herds[0]?.l_id_herd ?? "")
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(
    grasslandFields.map((f) => f.b_id),
  )
  // Follows the default start until the user picks a date, also once "today" becomes known
  const [startDate, setStartDate] = useKeyedState(defaultSeasonStart, (day) => day)
  const [pickedEndDate, setEndDate] = useKeyedState(defaultSeasonEnd, (day) => day)
  // The end never lies before the start
  const endDate = pickedEndDate !== "" && pickedEndDate < startDate ? startDate : pickedEndDate
  const [hoursPerDay, setHoursPerDay] = useState(8)
  const [periodDays, setPeriodDays] = useState(4)
  const [partialPercentage, setPartialPercentage] = useState<number>(50)
  const [partialMode, setPartialMode] = useState<PartialMode>("percentage")
  const [stripDirection, setStripDirection] = useState("90")
  // Nieuw Nederlands Weiden: at least 1 grazing hour per kg DM, so the hours cap the grass intake.
  // The intake follows the grazing hours until the user enters one.
  const [grassIntakeOverride, setGrassIntakeOverride] = useState<number | null>(null)
  const grassIntake =
    grassIntakeOverride ??
    Math.min(NNW_TOTAL_ROUGHAGE_INTAKE_KG_DM, hoursPerDay / GRAZING_HOURS_PER_KG_DM_MIN)
  const [grassOffer, setGrassOffer] = useState<number>(INSCHAREN_DRY_MATTER_TARGET_KG_HA)

  const selectedSystem = GRAZING_SYSTEMS[systemKey]
  const selectedHerdCount = herds.find((h) => h.l_id_herd === selectedHerdId)?.count ?? 0
  // Strip size from the herd's grass demand over one period
  const stripAllocation =
    selectedHerdCount > 0 && grassIntake > 0 && grassOffer > 0 && periodDays > 0
      ? calculateGrazingAllocationArea({
          animals: selectedHerdCount,
          grassIntakeKgDmPerAnimalPerDay: grassIntake,
          availableGrassKgDmPerHa: grassOffer,
          days: periodDays,
        })
      : null
  const useStrips = selectedSystem.grazingType === "partial" && partialMode === "strips"

  // Nieuw Nederlands Weiden: the chosen fields are divided into plots of equal size, and the herd
  // gets a new plot every day, or every half day when it grazes day and night
  const isNnw = systemKey === "nieuw_nederlands_weiden"
  const defaultPlotArea =
    selectedHerdCount > 0
      ? Math.max(0.1, Math.round(selectedHerdCount * NNW_PLOT_AREA_HA_PER_COW * 10) / 10)
      : Math.round(120 * NNW_PLOT_AREA_HA_PER_COW * 10) / 10
  // Follows the herd until the user enters a plot size
  const [plotArea, setPlotArea] = useKeyedState(String(defaultPlotArea), (value) => Number(value))
  const plotsPerDay = hoursPerDay > NNW_DAY_AND_NIGHT_HOURS ? 2 : 1

  const handleSystemSelect = (key: GrazingSystemKey) => {
    setSystemKey(key)
    const sys = GRAZING_SYSTEMS[key]
    if (sys.defaultPeriodDays > 0) setPeriodDays(sys.defaultPeriodDays)
    if (sys.defaultHoursPerDay > 0) setHoursPerDay(sys.defaultHoursPerDay)
  }

  const toggleField = (b_id: string) => {
    setSelectedFieldIds((prev) =>
      prev.includes(b_id) ? prev.filter((id) => id !== b_id) : [...prev, b_id],
    )
  }

  // Step 3: Generation and Collision Detection
  const { generatedRows, collisions } = useMemo(() => {
    if (!selectedSystem.requiresGrazingRecords) {
      return { generatedRows: [], collisions: [] }
    }

    const fieldsToUse = grasslandFields.filter((f) => selectedFieldIds.includes(f.b_id))
    if (fieldsToUse.length === 0 || !selectedHerdId) {
      return { generatedRows: [], collisions: [] }
    }

    const rows: Array<{
      l_id_herd: string
      b_id: string
      fieldName: string
      fieldArea: number
      l_grazing_start: string
      l_grazing_end: string
      l_grazing_hours: number
      l_grazing_area?: number
      l_grazing_geometry_zone?: MultiPolygon
      /** Area of the strip (ha), for the preview. */
      zoneArea?: number
    }> = []
    // Strips already cut per field; a new strip connects to them until the field is used up
    const occupiedByField = new Map<string, Area[]>()

    const skippedCollisions: Array<{
      fieldName: string
      startDate: string
      endDate: string
      reason: string
    }> = []

    const overlapsExisting = (b_id: string, from: Date, to: Date) =>
      existingGrazings.some((g) => {
        if (g.l_id_herd !== selectedHerdId) return false
        if (g.b_id && g.b_id !== b_id) return false
        const gStart = new Date(g.l_grazing_start)
        const gEnd = g.l_grazing_end ? new Date(g.l_grazing_end) : gStart
        return from <= gEnd && to >= gStart
      })

    if (isNnw) {
      // The chosen fields divided into plots of equal size, in a fixed order over the platform.
      // A field without an outline is one plot.
      const plots = fieldsToUse.flatMap((f) => {
        const cut = f.b_geometry
          ? cutEqualPlots({
              field: f.b_geometry as Area,
              plotAreaHa: plotArea,
              bearing: Number(stripDirection),
            })
          : []
        return cut.length > 0
          ? cut.map((plot) => ({ field: f, plot: plot as Area | null }))
          : [{ field: f, plot: null }]
      })
      const hoursPerPlot = hoursPerDay / plotsPerDay
      let plotIndex = 0
      for (
        const day = new Date(startDate);
        format(day, "yyyy-MM-dd") <= endDate;
        day.setDate(day.getDate() + 1)
      ) {
        const dayStr = format(day, "yyyy-MM-dd")
        // One new plot a day, or one in the morning and one in the evening. A herd is on a field
        // only once a day, so the plots of a day on the same field form one grazing.
        const dayPlots: Array<{
          field: (typeof plots)[number]["field"]
          plots: Area[]
          uses: number
        }> = []
        for (let k = 0; k < plotsPerDay; k++) {
          const { field: f, plot } = plots[plotIndex % plots.length]
          plotIndex++
          const last = dayPlots.at(-1)
          if (last && last.field.b_id === f.b_id) {
            last.uses++
            if (plot && !last.plots.includes(plot)) last.plots.push(plot)
          } else {
            dayPlots.push({ field: f, plots: plot ? [plot] : [], uses: 1 })
          }
        }
        for (const { field: f, plots: fieldPlots, uses } of dayPlots) {
          if (overlapsExisting(f.b_id, day, day)) {
            skippedCollisions.push({
              fieldName: f.b_name,
              startDate: dayStr,
              endDate: dayStr,
              reason: "Overlapt met bestaande registratie",
            })
            continue
          }
          // The plots of the day on this field as one zone
          const zone: MultiPolygon | undefined =
            fieldPlots.length > 0
              ? {
                  type: "MultiPolygon",
                  coordinates: fieldPlots.flatMap((plot) => toMultiPolygon(plot).coordinates),
                }
              : undefined
          rows.push({
            l_id_herd: selectedHerdId,
            b_id: f.b_id,
            fieldName: f.b_name,
            fieldArea: f.b_area,
            l_grazing_start: dayStr,
            l_grazing_end: dayStr,
            l_grazing_hours: hoursPerPlot * uses,
            l_grazing_geometry_zone: zone,
            zoneArea: zone
              ? Number(fieldPlots.reduce((sum, plot) => sum + areaHa(plot), 0).toFixed(2))
              : undefined,
          })
        }
      }
      return { generatedRows: rows, collisions: skippedCollisions }
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    let currentStart = new Date(start)
    let fieldIndex = 0

    while (currentStart < end) {
      const currentEnd = new Date(currentStart)
      currentEnd.setDate(currentEnd.getDate() + periodDays - 1)
      if (currentEnd > end) {
        currentEnd.setTime(end.getTime())
      }

      const activeField = fieldsToUse[fieldIndex % fieldsToUse.length]
      const sStr = format(currentStart, "yyyy-MM-dd")
      const eStr = format(currentEnd, "yyyy-MM-dd")

      // Check for collision with existing records for this herd & field
      if (overlapsExisting(activeField.b_id, currentStart, currentEnd)) {
        skippedCollisions.push({
          fieldName: activeField.b_name,
          startDate: sStr,
          endDate: eStr,
          reason: "Overlapt met bestaande registratie",
        })
      } else {
        let strip: Area | null = null
        if (useStrips && stripAllocation && activeField.b_geometry) {
          const field = activeField.b_geometry as Area
          const cut = (occupied: Area[]) =>
            cutStrip({
              field,
              occupied,
              targetAreaHa: stripAllocation.areaHa,
              bearing: Number(stripDirection),
            })
          const occupied = occupiedByField.get(activeField.b_id) ?? []
          strip = cut(occupied)
          if (strip) {
            occupiedByField.set(activeField.b_id, [...occupied, strip])
          } else {
            // The field is used up: start again at the back of the field
            strip = cut([])
            occupiedByField.set(activeField.b_id, strip ? [strip] : [])
          }
        }

        const partialArea =
          selectedSystem.grazingType === "partial" && !strip
            ? Number(((activeField.b_area * partialPercentage) / 100).toFixed(1))
            : undefined

        rows.push({
          l_id_herd: selectedHerdId,
          b_id: activeField.b_id,
          fieldName: activeField.b_name,
          fieldArea: activeField.b_area,
          l_grazing_start: sStr,
          l_grazing_end: eStr,
          l_grazing_hours: hoursPerDay,
          l_grazing_area: partialArea,
          l_grazing_geometry_zone: strip ? toMultiPolygon(strip) : undefined,
          zoneArea: strip ? Number(areaHa(strip).toFixed(2)) : undefined,
        })
      }

      // Advance
      currentStart = new Date(currentEnd)
      currentStart.setDate(currentStart.getDate() + 1)
      fieldIndex++
    }

    return { generatedRows: rows, collisions: skippedCollisions }
  }, [
    selectedSystem,
    grasslandFields,
    selectedFieldIds,
    selectedHerdId,
    startDate,
    endDate,
    periodDays,
    hoursPerDay,
    partialPercentage,
    existingGrazings,
    useStrips,
    stripAllocation,
    stripDirection,
    isNnw,
    plotArea,
    plotsPerDay,
  ])

  // The planned strips or plots for the map preview, each drawn once although the plan returns to
  // them, and the strip of every plan row
  const { previewZones, rowZoneIds } = useMemo(() => {
    const idByGeometry = new Map<string, string>()
    const zones: PlanPreviewZone[] = []
    const ids = generatedRows.map((row) => {
      const zone = row.l_grazing_geometry_zone
      if (!zone) return null
      const key = JSON.stringify(zone.coordinates)
      let id = idByGeometry.get(key)
      if (!id) {
        id = `zone-${idByGeometry.size}`
        idByGeometry.set(key, id)
        zones.push({ id, geometry: zone })
      }
      return id
    })
    return { previewZones: zones, rowZoneIds: ids }
  }, [generatedRows])
  const previewFields = useMemo(
    () =>
      grasslandFields
        .filter((f) => selectedFieldIds.includes(f.b_id) && f.b_geometry)
        .map((f) => f.b_geometry as Area),
    [grasslandFields, selectedFieldIds],
  )
  // The strip under the pointer, in the table or on the map
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null)

  // Grazing days: with Nieuw Nederlands Weiden every day has its own plot(s)
  const totalWeidedagen = isNnw
    ? new Set(generatedRows.map((row) => row.l_grazing_start)).size
    : generatedRows.length * periodDays

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${b_id_farm}/${calendar}/livestock/grazing`,
          label: "Terug naar Beweidingskalender",
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
        <BreadcrumbSeparator className="hidden xl:block" />
        <BreadcrumbItem className="hidden xl:block">
          <BreadcrumbLink
            render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/grazing`} />}
          >
            Beweidingskalender
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>Beweidingsplanner</BreadcrumbItem>
      </Header>

      <main>
        <FarmTitle
          title="Beweidingsplanner"
          description="Genereer een rotatieschema voor de percelen die je wilt beweiden, passend bij je koppel en het gekozen graslandgebruikssysteem."
          help="beweidingsplan"
        />

        <FarmContent>
          <div className="max-w-4xl space-y-8">
            {/* Step 1: System Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1 · Welk systeem wil je toepassen?</CardTitle>
                <CardDescription className="text-xs">
                  Gebaseerd op de richtlijnen van het Handboek Melkveehouderij (§3.10) en Nieuw
                  Nederlands Weiden.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(Object.keys(GRAZING_SYSTEMS) as GrazingSystemKey[]).map((key) => {
                    const sys = GRAZING_SYSTEMS[key]
                    const isSelected = systemKey === key
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSystemSelect(key)}
                        className={cn(
                          "cursor-pointer rounded-xl border p-4 text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary/5 ring-primary/20 shadow-xs ring-2"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{sys.name}</span>
                          {isSelected && (
                            <CheckCircle2 aria-hidden="true" className="text-primary h-4 w-4" />
                          )}
                        </div>
                        <p
                          className={cn(
                            "mt-1.5 text-xs text-pretty",
                            isSelected ? "text-foreground/80" : "text-muted-foreground",
                          )}
                        >
                          {sys.description}
                        </p>
                      </button>
                    )
                  })}
                </div>

                {!selectedSystem.requiresGrazingRecords && (
                  <div className="mt-4 space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                    <p className="font-semibold">Let op bij {selectedSystem.name}:</p>
                    <p>
                      Bij dit systeem is er geen weidegang. In de stikstofgebruiksnorm telt al je
                      grasland mee als <strong>geheel maaien</strong>, wat leidt tot een hogere
                      stikstofgebruiksruimte. Er worden geen weidedagen vastgelegd.
                    </p>
                    <NavLink
                      to={`/farm/${b_id_farm}/${calendar}/norms`}
                      className="text-primary mt-1 inline-block font-medium underline"
                    >
                      Bekijk de gebruiksruimte →
                    </NavLink>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedSystem.requiresGrazingRecords && (
              <>
                {/* Step 2: Parameters */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">2 · Wat neem je mee in het plan?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <FieldGroup>
                      {/* The herd and the period share a row only when both dates fit in full */}
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="plan-herd">Koppel</FieldLabel>
                          <Select
                            value={selectedHerdId}
                            items={herds.map((h) => ({ value: h.l_id_herd, label: h.l_herd_name }))}
                            onValueChange={(v) => {
                              if (v !== null) setSelectedHerdId(v)
                            }}
                          >
                            <SelectTrigger id="plan-herd">
                              <SelectValue placeholder="Kies koppel" />
                            </SelectTrigger>
                            <SelectContent>
                              {herds.map((h) => (
                                <SelectItem key={h.l_id_herd} value={h.l_id_herd}>
                                  {h.l_herd_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-2">
                          <DatePicker
                            label="Periode vanaf"
                            field={{
                              name: "plan_start",
                              value: startDate,
                              onChange: (val) =>
                                setStartDate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                              onBlur: () => {},
                              ref: () => {},
                            }}
                            fieldState={{
                              invalid: false,
                              isTouched: false,
                              isDirty: false,
                              isValidating: false,
                            }}
                            required
                          />
                          <DatePicker
                            label="t/m"
                            field={{
                              name: "plan_end",
                              value: endDate,
                              onChange: (val) =>
                                setEndDate(val ? format(new Date(val), "yyyy-MM-dd") : ""),
                              onBlur: () => {},
                              ref: () => {},
                            }}
                            fieldState={{
                              invalid: false,
                              isTouched: false,
                              isDirty: false,
                              isValidating: false,
                            }}
                            required
                          />
                        </div>
                      </div>

                      {seasonOver && (
                        <p className="text-muted-foreground text-xs">
                          Het weideseizoen van {calendarYear} is voorbij. Het plan laat daarom het
                          hele seizoen zien; maak een plan voor volgend jaar in{" "}
                          <NavLink
                            to={`/farm/${b_id_farm}/${calendarYear + 1}/livestock/grazing/plan`}
                            className="text-foreground underline underline-offset-2"
                          >
                            {calendarYear + 1}
                          </NavLink>
                          .
                        </p>
                      )}

                      <Field>
                        <FieldLabel>Percelen om te beweiden in dit plan</FieldLabel>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {grasslandFields.map((field) => {
                            const isChecked = selectedFieldIds.includes(field.b_id)
                            return (
                              <div
                                key={field.b_id}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleField(field.b_id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    toggleField(field.b_id)
                                  }
                                }}
                                className={cn(
                                  "flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-xs transition-colors",
                                  isChecked
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border hover:bg-muted/30",
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Checkbox checked={isChecked} tabIndex={-1} />
                                  <span className="font-medium">{field.b_name}</span>
                                </div>
                                <span className="text-muted-foreground tabular-nums">
                                  {field.b_area.toLocaleString("nl-NL", {
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  ha
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </Field>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="plan-hours">Uren weidegang per dag</FieldLabel>
                          <Input
                            id="plan-hours"
                            type="number"
                            min="1"
                            max="24"
                            value={hoursPerDay}
                            onChange={(e) => setHoursPerDay(parseInt(e.target.value || "8", 10))}
                          />
                        </Field>

                        {!isNnw && (
                          <Field>
                            <FieldLabel htmlFor="plan-days">
                              Wissel van perceel elke (dagen)
                            </FieldLabel>
                            <Input
                              id="plan-days"
                              type="number"
                              min="1"
                              max="60"
                              value={periodDays}
                              onChange={(e) => setPeriodDays(parseInt(e.target.value || "4", 10))}
                            />
                          </Field>
                        )}
                      </div>

                      {isNnw && (
                        <Field className="bg-muted/20 space-y-3 rounded-lg border p-3.5">
                          <FieldLabel>Percelen van gelijke grootte</FieldLabel>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field>
                              <FieldLabel htmlFor="plan-plot-area" className="text-xs">
                                Perceelsgrootte (ha)
                              </FieldLabel>
                              <Input
                                id="plan-plot-area"
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={plotArea}
                                onChange={(e) => setPlotArea(parseFloat(e.target.value || "0"))}
                                className="h-8 text-xs"
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor="plan-plot-direction" className="text-xs">
                                Richting
                              </FieldLabel>
                              <Select
                                value={stripDirection}
                                items={STRIP_DIRECTIONS}
                                onValueChange={(v) => {
                                  if (v !== null) setStripDirection(v)
                                }}
                              >
                                <SelectTrigger id="plan-plot-direction" className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STRIP_DIRECTIONS.map((d) => (
                                    <SelectItem key={d.value} value={d.value}>
                                      {d.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {clientConfig.name} deelt de gekozen percelen op in percelen van
                            ongeveer deze grootte, alle even groot binnen een perceel. De koppel
                            krijgt elke dag een nieuw perceel
                            {plotsPerDay === 2
                              ? `; bij dag en nacht weiden (meer dan ${NNW_DAY_AND_NIGHT_HOURS} uur) 's ochtends en 's avonds een nieuw perceel, elk met de helft van de uren. Liggen ze op hetzelfde perceel, dan worden ze samen één beweiding, omdat een koppel maar één keer per dag op een perceel kan staan`
                              : ""}
                            . De standaard is 2,5 ha per 120 koeien, zoals in de voorbeelden van
                            Nieuw Nederlands Weiden, omgerekend naar deze koppel.
                          </p>
                        </Field>
                      )}

                      {selectedSystem.grazingType === "partial" && (
                        <Field className="bg-muted/20 space-y-3 rounded-lg border p-3.5">
                          <FieldLabel>
                            Oppervlakte per weidebeurt ({selectedSystem.name})
                          </FieldLabel>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={partialMode === "strips" ? "default" : "outline"}
                              aria-pressed={partialMode === "strips"}
                              onClick={() => setPartialMode("strips")}
                              className="h-8 text-xs"
                            >
                              Stroken op de kaart
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={partialMode === "percentage" ? "default" : "outline"}
                              aria-pressed={partialMode === "percentage"}
                              onClick={() => setPartialMode("percentage")}
                              className="h-8 text-xs"
                            >
                              Percentage, zonder kaart
                            </Button>
                          </div>

                          {partialMode === "strips" && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <Field>
                                  <FieldLabel htmlFor="plan-strip-direction" className="text-xs">
                                    Richting
                                  </FieldLabel>
                                  <Select
                                    value={stripDirection}
                                    items={STRIP_DIRECTIONS}
                                    onValueChange={(v) => {
                                      if (v !== null) setStripDirection(v)
                                    }}
                                  >
                                    <SelectTrigger
                                      id="plan-strip-direction"
                                      className="h-8 text-xs"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STRIP_DIRECTIONS.map((d) => (
                                        <SelectItem key={d.value} value={d.value}>
                                          {d.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor="plan-grass-intake" className="text-xs">
                                    Grasopname (kg ds/dier/dag)
                                  </FieldLabel>
                                  <Input
                                    id="plan-grass-intake"
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={grassIntake}
                                    onChange={(e) =>
                                      setGrassIntakeOverride(parseFloat(e.target.value || "0"))
                                    }
                                    className="h-8 text-xs"
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor="plan-grass-offer" className="text-xs">
                                    Grasaanbod (kg ds/ha)
                                  </FieldLabel>
                                  <Input
                                    id="plan-grass-offer"
                                    type="number"
                                    min="100"
                                    step="100"
                                    value={grassOffer}
                                    onChange={(e) =>
                                      setGrassOffer(parseFloat(e.target.value || "0"))
                                    }
                                    className="h-8 text-xs"
                                  />
                                </Field>
                              </div>
                              <p className="text-muted-foreground text-xs">
                                {stripAllocation ? (
                                  <span key="allocation">
                                    Strook van{" "}
                                    <strong className="text-foreground">
                                      {stripAllocation.areaHa.toLocaleString("nl-NL")} ha
                                    </strong>{" "}
                                    per weidebeurt: {selectedHerdCount} dieren × {grassIntake} kg ds
                                    × {periodDays} {periodDays === 1 ? "dag" : "dagen"} ÷{" "}
                                    {stripAllocation.grassOnOfferKgDmPerHa.toLocaleString("nl-NL")}{" "}
                                    kg ds/ha ({grassOffer} bij inscharen +{" "}
                                    {GROWTH_DURING_GRAZING_KG_DM_HA_DAY} bijgroei per weidedag).
                                    Elke strook sluit aan op de vorige; is het perceel rond, dan
                                    begint de koppel weer vooraan.
                                  </span>
                                ) : (
                                  <span key="no-animals">
                                    Deze koppel heeft geen dieren, dus de strookgrootte is niet te
                                    berekenen. Het percentage hieronder wordt gebruikt.
                                  </span>
                                )}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                Grasopname: maximaal 1 kg ds per weide-uur (Nieuw Nederlands Weiden:
                                minimaal 1 weide-uur per kg ds). Grasaanbod: 1.700 kg ds/ha bij
                                inscharen plus {GROWTH_DURING_GRAZING_KG_DM_HA_DAY} kg ds/ha
                                bijgroei per weidedag (Handboek Melkveehouderij). Pas de waarden aan
                                voor je eigen bedrijf. Percelen zonder perceelsgrens krijgen het
                                percentage.
                              </p>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2">
                            {[50, 33, 25].map((pct) => (
                              <Button
                                key={pct}
                                type="button"
                                variant={partialPercentage === pct ? "default" : "outline"}
                                size="sm"
                                aria-pressed={partialPercentage === pct}
                                onClick={() => setPartialPercentage(pct)}
                                className="h-8 text-xs"
                              >
                                {pct === 50
                                  ? "1/2 blok (50%)"
                                  : pct === 33
                                    ? "1/3 blok (33%)"
                                    : "1/4 blok (25%)"}
                              </Button>
                            ))}
                            <div className="ml-2 flex items-center gap-1.5">
                              <Input
                                type="number"
                                min="5"
                                max="95"
                                value={partialPercentage}
                                onChange={(e) =>
                                  setPartialPercentage(
                                    Math.min(95, Math.max(5, parseInt(e.target.value || "50", 10))),
                                  )
                                }
                                className="h-8 w-20 text-xs"
                                aria-label="Deel van het perceel in procent"
                              />
                              <span className="text-muted-foreground text-xs">% van perceel</span>
                            </div>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            Bij {selectedSystem.name} weidt de koppel steeds op een deel van het
                            perceel.{" "}
                            {partialMode === "percentage"
                              ? `${clientConfig.name} schat de oppervlakte per weidebeurt op ${partialPercentage}% van de perceelsgrootte, zonder plek op de kaart.`
                              : `Zonder strook (geen perceelsgrens of geen dieren) gebruikt ${clientConfig.name} ${partialPercentage}% van de perceelsgrootte.`}
                          </p>
                        </Field>
                      )}
                    </FieldGroup>

                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Info className="text-primary h-3.5 w-3.5 shrink-0" />
                      {/* Keyed, so a translated text is replaced instead of patched */}
                      <span key={planTiming}>
                        {planTiming === "past"
                          ? `${calendarYear} ligt achter je: de perioden worden vastgelegd als beweiding die al heeft plaatsgevonden.`
                          : planTiming === "future"
                            ? "Alle perioden worden vastgelegd als geplande beweiding."
                            : "Perioden die na vandaag beginnen, worden vastgelegd als geplande beweiding; eerdere perioden als beweiding die al heeft plaatsgevonden."}
                      </span>
                    </p>
                  </CardContent>
                </Card>

                {/* Step 3: Plan Review Table */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">3 · Controleer het plan</CardTitle>
                        <CardDescription className="text-xs">
                          {generatedRows.length} perioden · ± {totalWeidedagen} weidedagen
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{selectedSystem.name}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {collisions.length > 0 && (
                      <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          {collisions.length}{" "}
                          {collisions.length === 1 ? "periode overlapt" : "perioden overlappen"} met
                          bestaande registraties en worden overgeslagen:
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">
                          {collisions.slice(0, 3).map((c, i) => (
                            <li key={i}>
                              {c.fieldName} (
                              {c.startDate === c.endDate
                                ? formatPlanDay(c.startDate)
                                : `${formatPlanDay(c.startDate)} – ${formatPlanDay(c.endDate)}`}
                              )
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* On a large screen the map sits next to the plan, so a row and its strip
                        are visible together */}
                    <div
                      className={cn(
                        "grid gap-4",
                        previewZones.length > 0 && "lg:grid-cols-2 lg:items-start",
                      )}
                    >
                      {previewZones.length > 0 && (
                        <div className="overflow-hidden rounded-lg border lg:order-2">
                          <Suspense fallback={<Skeleton className="h-[380px] w-full" />}>
                            <PlanPreviewMap
                              fields={previewFields}
                              zones={previewZones}
                              highlightedZoneId={hoveredZoneId}
                              onZoneHover={setHoveredZoneId}
                              height="380px"
                            />
                          </Suspense>
                        </div>
                      )}

                      <div className="max-h-64 overflow-y-auto rounded-lg border lg:max-h-[380px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-32">Periode</TableHead>
                              <TableHead>Perceel & Oppervlak</TableHead>
                              <TableHead className="text-right">Uren/dag</TableHead>
                              <TableHead>Gebruik</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {generatedRows.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="text-muted-foreground py-6 text-center"
                                >
                                  Geen perioden gegenereerd. Selecteer minimaal 1 perceel.
                                </TableCell>
                              </TableRow>
                            ) : (
                              generatedRows.map((row, idx) => (
                                <TableRow
                                  key={idx}
                                  // Highlights the strip of this row on the map, and the rows of the
                                  // strip under the pointer on the map
                                  onMouseEnter={() => setHoveredZoneId(rowZoneIds[idx])}
                                  onMouseLeave={() => setHoveredZoneId(null)}
                                  className={cn(
                                    rowZoneIds[idx] !== null &&
                                      rowZoneIds[idx] === hoveredZoneId &&
                                      "bg-green-100",
                                  )}
                                >
                                  <TableCell className="text-xs tabular-nums">
                                    {row.l_grazing_start === row.l_grazing_end
                                      ? formatPlanDay(row.l_grazing_start)
                                      : `${formatPlanDay(row.l_grazing_start)} – ${formatPlanDay(row.l_grazing_end)}`}
                                  </TableCell>
                                  <TableCell className="text-xs font-medium">
                                    {row.fieldName}{" "}
                                    <span className="text-muted-foreground font-normal tabular-nums">
                                      (
                                      {row.zoneArea !== undefined
                                        ? // A part never shows as larger than its rounded field
                                          `${formatPlanHa(Math.min(row.zoneArea, row.fieldArea))} ha van ${formatPlanHa(row.fieldArea)} ha`
                                        : row.l_grazing_area
                                          ? `${formatPlanHa(row.l_grazing_area)} ha van ${formatPlanHa(row.fieldArea)} ha`
                                          : `${formatPlanHa(row.fieldArea)} ha`}
                                      )
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right text-xs tabular-nums">
                                    {row.l_grazing_hours.toLocaleString("nl-NL")} uur
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {row.l_grazing_geometry_zone
                                      ? isNnw
                                        ? "Perceel op de kaart"
                                        : "Strook op de kaart"
                                      : row.l_grazing_area
                                        ? `Deelperceel (${partialPercentage}%, zonder kaart)`
                                        : "Volledig"}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Info className="text-primary h-3.5 w-3.5 shrink-0" />
                      Rustperiodes zijn gebaseerd op een vaste richtlijn, niet op de werkelijke
                      grasgroei.
                    </p>
                  </CardContent>
                  {/* On a phone both buttons span the width, the confirm button on top (as in the
                      dialog footers) */}
                  <CardFooter className="flex flex-col-reverse items-stretch gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      variant="outline"
                      nativeButton={false}
                      render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/grazing`} />}
                    >
                      Annuleren
                    </Button>

                    <fetcher.Form method="post">
                      <input type="hidden" name="plan_rows" value={JSON.stringify(generatedRows)} />
                      <Button
                        type="submit"
                        disabled={generatedRows.length === 0 || fetcher.state !== "idle"}
                        className="w-full gap-1.5 sm:w-auto"
                      >
                        <Save aria-hidden="true" className="h-4 w-4" />
                        Plan bevestigen en vastleggen ({generatedRows.length})
                      </Button>
                    </fetcher.Form>
                  </CardFooter>
                </Card>
              </>
            )}
          </div>
        </FarmContent>
      </main>
    </SidebarInset>
  )
}
