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
  getHerdsForFarmInPeriod,
} from "@nmi-agro/fdm-core"
import { cn } from "cn"
import { eachDayOfInterval, format } from "date-fns"
import { nl } from "date-fns/locale"
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Save } from "lucide-react"
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
import z from "zod"
import type { PlanPreviewZone } from "~/components/blocks/grazing/plan-preview-map"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { PageContainer } from "~/components/custom/page-container"
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
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
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
import { getCalendar, getTimeframe, getTimeframeForYears } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { formText } from "~/lib/form"
import { formatHa } from "~/lib/format"
import { censusDateForYear, farmTodayKey } from "~/lib/grazing-dates"
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
    const calendar = getCalendar(params)
    const calendarYear = parseInt(calendar, 10) || new Date().getFullYear()

    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)

    const planYear = getTimeframeForYears(calendarYear, calendarYear)
    const [farm, farms, herds, allFields, cultivationsByField, existingGrazings, census] =
      await Promise.all([
        getFarm(fdm, session.principal_id, b_id_farm),
        getFarms(fdm, session.principal_id),
        // Every herd that ran during the plan year (in the Netherlands), also one that started or
        // ended during it; the planner keeps its periods within the herd's own period
        // (a timeframe of whole years always has a start and an end)
        getHerdsForFarmInPeriod(fdm, session.principal_id, b_id_farm, {
          start: planYear.start!,
          end: planYear.end!,
        }),
        getFields(fdm, session.principal_id, b_id_farm, timeframe),
        getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getGrazingCalendarForFarm(fdm, session.principal_id, b_id_farm, timeframe),
        getCensusForFarm(fdm, session.principal_id, b_id_farm, censusDateForYear(calendarYear)),
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
        b_area: f.b_area ?? 0,
        // Needed to cut grazing strips from the field
        b_geometry: f.b_geometry ?? null,
        // The days the field has a grass cultivation (Dutch calendar days, the end included), so
        // the plan skips the days before it was sown or after it was ploughed
        grassPeriods: (cultivationsByField.get(f.b_id) ?? [])
          .filter((c) => c.b_lu_croprotation === "grass")
          .map((c) => ({
            start: c.b_lu_start ? farmTodayKey(new Date(c.b_lu_start)) : null,
            end: c.b_lu_end ? farmTodayKey(new Date(c.b_lu_end)) : null,
          })),
      }))

    // The first day a herd can graze (as fdm-core compares it, the UTC day of its start) and,
    // for an ended herd, the first day it can no longer graze: a grazing must end before the end
    // of the herd, and a grazing day is stored at midnight UTC
    const utcDayKey = (date: Date) => date.toISOString().slice(0, 10)
    const herdEndKey = (end: Date) => {
      const lastDay = utcDayKey(new Date(end.getTime() - 1))
      return new Date(Date.parse(`${lastDay}T00:00:00.000Z`) + 86_400_000)
        .toISOString()
        .slice(0, 10)
    }

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      calendarYear,
      farmOptions,
      herds: herds.map((h) => ({
        l_id_herd: h.l_id_herd,
        l_herd_name: h.l_herd_name ?? "Koppel",
        l_id_category: h.l_id_category,
        l_lsu: h.l_lsu ?? 1.0,
        count: censusMap.get(h.l_id_herd) ?? 0,
        l_start: h.l_start ? utcDayKey(new Date(h.l_start)) : null,
        l_end: h.l_end ? herdEndKey(new Date(h.l_end)) : null,
      })),
      grasslandFields,
      existingGrazings: existingGrazings.map((g) => ({
        l_id_herd: g.l_id_herd,
        b_id: g.b_id,
        l_grazing_start: new Date(g.l_grazing_start).toISOString(),
        l_grazing_end: g.l_grazing_end ? new Date(g.l_grazing_end).toISOString() : null,
        l_grazing_hours: g.l_grazing_hours ?? null,
      })),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** A day of the plan as `YYYY-MM-DD`, and a real calendar day (not 30 February). */
const planDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, "Ongeldige datum")

/** A period of the plan as the planner sends it; every period is on a field. */
const planRowsSchema = z.array(
  z.object({
    l_id_herd: z.string().min(1),
    b_id: z.string().min(1),
    l_grazing_start: planDateSchema,
    l_grazing_end: planDateSchema,
    l_grazing_hours: z.number().positive(),
    l_grazing_area: z.number().positive().optional(),
    l_grazing_geometry_zone: grazingZoneSchema.nullish(),
  }),
)

/**
 * Reads the planned periods from the submitted JSON.
 *
 * @param value - The JSON text of the periods.
 * @returns The periods.
 * @throws A 400 response when the text is not a valid list of periods.
 */
function parsePlanRows(value: string): z.infer<typeof planRowsSchema> {
  try {
    return planRowsSchema.parse(JSON.parse(value))
  } catch {
    throw data("Ongeldig beweidingsplan", { status: 400 })
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = getCalendar(params)
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
    const rows = parsePlanRows(formText(formData, "plan_rows", "[]"))

    if (rows.length === 0) {
      throw data("Geen perioden om vast te leggen.", { status: 400 })
    }
    // Like the preview: every period lies within the year of the page, so it shows on its
    // calendar after saving
    const calendarYear = Number.parseInt(calendar, 10) || new Date().getFullYear()
    const yearPrefix = `${calendarYear}-`
    if (
      rows.some(
        (r) =>
          !r.l_grazing_start.startsWith(yearPrefix) ||
          !r.l_grazing_end.startsWith(yearPrefix) ||
          r.l_grazing_end < r.l_grazing_start,
      )
    ) {
      throw data(`Kies perioden binnen ${calendarYear}.`, { status: 400 })
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
        l_grazing_geometry_zone: (r.l_grazing_geometry_zone ?? null) as
          | Polygon
          | MultiPolygon
          | null,
      })),
    )

    // The stored calendar days, read from their keys: the same days in any time zone
    const dayMonth = (day: string) => `${day.slice(8, 10)}-${day.slice(5, 7)}`
    const firstStart = dayMonth(rows[0].l_grazing_start)
    const lastEnd = dayMonth(rows[rows.length - 1].l_grazing_end)

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

const MS_PER_DAY = 86_400_000

/** The day `days` days after a `YYYY-MM-DD` day, counted on calendar days (no time zone). */
const shiftPlanDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + days * MS_PER_DAY).toISOString().slice(0, 10)

/** Most grazing hours of a herd on one day, as fdm-core allows them. */
const MAX_HOURS_PER_DAY = 24

/** Longest period on one field (days), as the period input allows. */
const MAX_PERIOD_DAYS = 60

/** Smallest plot size for Nieuw Nederlands Weiden (ha), as the plot size input allows. */
const MIN_PLOT_AREA_HA = 0.1

/** Whether a period date of the planner is a valid `YYYY-MM-DD` day. */
const isPlanDay = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(new Date(`${day}T12:00:00`).getTime())

/** The planner, started again for another farm or year, so no selection of the other one stays. */
export default function GrazingPlanPage() {
  const { b_id_farm, calendar } = useLoaderData<typeof loader>()
  return <GrazingPlanAssistent key={`${b_id_farm}#${calendar}`} />
}

function GrazingPlanAssistent() {
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
  // The chosen herd while it is still among the herds; a herd that disappeared after a reload
  // has to be chosen again
  const herdId = herds.some((h) => h.l_id_herd === selectedHerdId) ? selectedHerdId : ""
  const selectedHerd = herds.find((h) => h.l_id_herd === herdId)
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
  const selectedHerdCount = selectedHerd?.count ?? 0
  // Strip size from the herd's grass demand over one period
  const stripAllocation = useMemo(
    () =>
      selectedHerdCount > 0 && grassIntake > 0 && grassOffer > 0 && periodDays > 0
        ? calculateGrazingAllocationArea({
            animals: selectedHerdCount,
            grassIntakeKgDmPerAnimalPerDay: grassIntake,
            availableGrassKgDmPerHa: grassOffer,
            days: periodDays,
          })
        : null,
    [selectedHerdCount, grassIntake, grassOffer, periodDays],
  )
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

  // The typed values must be usable before a plan is generated: a period of 0 days would never
  // advance, a tiny plot size would cut a huge number of plots and an empty date has no days
  const periodDaysValid =
    Number.isInteger(periodDays) && periodDays >= 1 && periodDays <= MAX_PERIOD_DAYS
  const plotAreaValid = Number.isFinite(plotArea) && plotArea >= MIN_PLOT_AREA_HA
  const hoursValid =
    Number.isFinite(hoursPerDay) && hoursPerDay > 0 && hoursPerDay <= MAX_HOURS_PER_DAY
  // The plan stays within the calendar year, whose grazings are loaded to check against
  const datesInYear =
    startDate.startsWith(`${calendarYear}-`) && endDate.startsWith(`${calendarYear}-`)
  const datesValid = isPlanDay(startDate) && isPlanDay(endDate) && datesInYear

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

    if (!datesValid || !hoursValid || (isNnw ? !plotAreaValid : !periodDaysValid)) {
      return { generatedRows: [], collisions: [] }
    }

    const fieldsToUse = grasslandFields.filter((f) => selectedFieldIds.includes(f.b_id))
    if (fieldsToUse.length === 0 || !selectedHerd) {
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

    // What the herd already has on the days of the plan: the grazing hours per day, added up over
    // its grazings
    const bookedHours = new Map<string, number>()
    for (const g of existingGrazings) {
      if (g.l_id_herd !== herdId) continue
      const first = g.l_grazing_start.slice(0, 10)
      const last = g.l_grazing_end ? g.l_grazing_end.slice(0, 10) : first
      for (let day = first < startDate ? startDate : first; day <= last && day <= endDate;) {
        bookedHours.set(day, (bookedHours.get(day) ?? 0) + (g.l_grazing_hours ?? 0))
        day = shiftPlanDay(day, 1)
      }
    }
    // Whether the field has a grass cultivation on a day
    const isGrassOn = (field: (typeof fieldsToUse)[number], day: string) =>
      field.grassPeriods.some((p) => (!p.start || p.start <= day) && (!p.end || day <= p.end))
    // Why a period cannot be added, as fdm-core would refuse it, or null when it fits
    const conflictReason = (
      field: (typeof fieldsToUse)[number],
      from: string,
      to: string,
      hours: number,
    ): string | null => {
      for (let day = from; day <= to; day = shiftPlanDay(day, 1)) {
        if (selectedHerd.l_start && day < selectedHerd.l_start) {
          return "Koppel liep toen nog niet"
        }
        if (selectedHerd.l_end && day >= selectedHerd.l_end) {
          return "Koppel liep toen niet meer"
        }
        if (!isGrassOn(field, day)) return "Geen grasland in die periode"
        if ((bookedHours.get(day) ?? 0) + hours > MAX_HOURS_PER_DAY) {
          return "Meer dan 24 uur beweiden op een dag"
        }
      }
      return null
    }
    const book = (from: string, to: string, hours: number) => {
      for (let day = from; day <= to; day = shiftPlanDay(day, 1)) {
        bookedHours.set(day, (bookedHours.get(day) ?? 0) + hours)
      }
    }

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
      // Two sessions a day need two different plots; with one plot both would graze the same
      // land, which is not Nieuw Nederlands Weiden
      if (plots.length < plotsPerDay) {
        skippedCollisions.push({
          fieldName: fieldsToUse.map((f) => f.b_name).join(", "),
          startDate,
          endDate,
          reason:
            "Maar één perceel voor twee beweidingen per dag: kies kleinere percelen of meer graslandpercelen",
        })
        return { generatedRows: rows, collisions: skippedCollisions }
      }
      const hoursPerPlot = hoursPerDay / plotsPerDay
      let plotIndex = 0
      for (let dayStr = startDate; dayStr <= endDate; dayStr = shiftPlanDay(dayStr, 1)) {
        // One new plot a day, or one in the morning and one in the evening, each its own grazing
        // with its share of the hours, also when both lie on the same field
        for (let k = 0; k < plotsPerDay; k++) {
          const { field: f, plot } = plots[plotIndex % plots.length]
          plotIndex++
          const reason = conflictReason(f, dayStr, dayStr, hoursPerPlot)
          if (reason) {
            skippedCollisions.push({
              fieldName: f.b_name,
              startDate: dayStr,
              endDate: dayStr,
              reason,
            })
            continue
          }
          book(dayStr, dayStr, hoursPerPlot)
          rows.push({
            l_id_herd: herdId,
            b_id: f.b_id,
            fieldName: f.b_name,
            fieldArea: f.b_area,
            l_grazing_start: dayStr,
            l_grazing_end: dayStr,
            l_grazing_hours: hoursPerPlot,
            l_grazing_geometry_zone: plot ? toMultiPolygon(plot) : undefined,
            zoneArea: plot ? Number(areaHa(plot).toFixed(2)) : undefined,
          })
        }
      }
      return { generatedRows: rows, collisions: skippedCollisions }
    }

    // Periods of `periodDays` days up to and including the end date; the last one may be shorter
    let fieldIndex = 0
    for (let sStr = startDate; sStr <= endDate;) {
      const periodEnd = shiftPlanDay(sStr, periodDays - 1)
      const eStr = periodEnd > endDate ? endDate : periodEnd

      const activeField = fieldsToUse[fieldIndex % fieldsToUse.length]

      // Check that the herd's grazing on these days stays possible
      const reason = conflictReason(activeField, sStr, eStr, hoursPerDay)
      if (reason) {
        skippedCollisions.push({
          fieldName: activeField.b_name,
          startDate: sStr,
          endDate: eStr,
          reason,
        })
      } else {
        book(sStr, eStr, hoursPerDay)
        let strip: Area | null = null
        if (useStrips && stripAllocation && activeField.b_geometry) {
          const field = activeField.b_geometry as Area
          // A shorter last period gets a strip for its own number of days
          const days = Math.round((Date.parse(eStr) - Date.parse(sStr)) / MS_PER_DAY) + 1
          const targetAreaHa =
            days === periodDays
              ? stripAllocation.areaHa
              : calculateGrazingAllocationArea({
                  animals: selectedHerdCount,
                  grassIntakeKgDmPerAnimalPerDay: grassIntake,
                  availableGrassKgDmPerHa: grassOffer,
                  days,
                }).areaHa
          const cut = (occupied: Area[]) =>
            cutStrip({
              field,
              occupied,
              targetAreaHa,
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

        // Not rounded to whole tenths, so a small share of a small field stays above 0 ha; a
        // field without a known area gets no partial area
        const partialHa = (activeField.b_area * partialPercentage) / 100
        const partialArea =
          selectedSystem.grazingType === "partial" && !strip && partialHa > 0
            ? Number(partialHa.toFixed(4))
            : undefined

        rows.push({
          l_id_herd: herdId,
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
      sStr = shiftPlanDay(eStr, 1)
      fieldIndex++
    }

    return { generatedRows: rows, collisions: skippedCollisions }
  }, [
    selectedSystem,
    grasslandFields,
    selectedFieldIds,
    herdId,
    selectedHerd,
    startDate,
    endDate,
    periodDays,
    hoursPerDay,
    partialPercentage,
    existingGrazings,
    useStrips,
    stripAllocation,
    selectedHerdCount,
    grassIntake,
    grassOffer,
    stripDirection,
    isNnw,
    plotArea,
    plotsPerDay,
    datesValid,
    hoursValid,
    plotAreaValid,
    periodDaysValid,
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

  // Grazing days: the distinct days the plan covers, so a shorter last period and several plots on
  // one day (Nieuw Nederlands Weiden) are counted right
  const totalWeidedagen = useMemo(() => {
    const days = new Set<string>()
    for (const row of generatedRows) {
      for (const day of eachDayOfInterval({
        start: new Date(`${row.l_grazing_start}T12:00:00`),
        end: new Date(`${row.l_grazing_end}T12:00:00`),
      })) {
        days.add(format(day, "yyyy-MM-dd"))
      }
    }
    return days.size
  }, [generatedRows])

  return (
    <PageContainer>
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

      <div>
        <FarmTitle
          title="Beweidingsplanner"
          description="Genereer een rotatieschema voor de percelen die je wilt beweiden, passend bij je koppel en het gekozen graslandgebruikssysteem."
        />

        <FarmContent>
          {/* On a wide screen the choices (steps 1 and 2) sit left and the plan (step 3) right */}
          <div className="w-full space-y-8 2xl:grid 2xl:grid-cols-2 2xl:items-start 2xl:gap-8 2xl:space-y-0">
            <div className="space-y-8">
              {/* Step 1: System Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stap 1: Welk systeem wil je toepassen?</CardTitle>
                  <CardDescription className="text-xs">
                    Gebaseerd op de richtlijnen van het Handboek Melkveehouderij (§3.10) en Nieuw
                    Nederlands Weiden.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-2">
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
                            "cursor-pointer rounded-xl border p-4 text-left transition-colors",
                            isSelected ? "border-primary" : "border-border hover:bg-muted/40",
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
                        className="text-primary mt-1 inline-flex items-center gap-1 font-medium underline"
                      >
                        <span>Bekijk de gebruiksruimte</span>
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </NavLink>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedSystem.requiresGrazingRecords && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Stap 2: Wat neem je mee in het plan?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <FieldGroup>
                      {/* The herd and the period share a row only when both dates fit in full */}
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="plan-herd">Koppel</FieldLabel>
                          <Select
                            value={herdId}
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

                      {isPlanDay(startDate) && isPlanDay(endDate) && !datesInYear && (
                        <FieldError className="text-xs">
                          Kies een periode binnen {calendarYear}. Voor een ander jaar kies je dat
                          jaar in de kalender.
                        </FieldError>
                      )}

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
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-2">
                          {grasslandFields.map((field) => {
                            const isChecked = selectedFieldIds.includes(field.b_id)
                            return (
                              <label
                                key={field.b_id}
                                className={cn(
                                  "flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-xs transition-colors",
                                  isChecked
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border hover:bg-muted/30",
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => toggleField(field.b_id)}
                                  />
                                  <span className="font-medium">{field.b_name}</span>
                                </div>
                                <span className="text-muted-foreground tabular-nums">
                                  {field.b_area.toLocaleString("nl-NL", {
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  ha
                                </span>
                              </label>
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
                            step="any"
                            value={hoursPerDay}
                            onChange={(e) => setHoursPerDay(parseFloat(e.target.value || "8"))}
                            aria-invalid={!hoursValid}
                            aria-describedby={hoursValid ? undefined : "plan-hours-error"}
                          />
                          {!hoursValid && (
                            <FieldError id="plan-hours-error" className="text-xs">
                              Kies meer dan 0 en hoogstens 24 uur per dag.
                            </FieldError>
                          )}
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
                              max={MAX_PERIOD_DAYS}
                              value={periodDays}
                              onChange={(e) => setPeriodDays(parseInt(e.target.value || "4", 10))}
                              aria-invalid={!periodDaysValid}
                              aria-describedby={periodDaysValid ? undefined : "plan-days-error"}
                            />
                            {!periodDaysValid && (
                              <FieldError id="plan-days-error" className="text-xs">
                                Kies 1 tot en met {MAX_PERIOD_DAYS} dagen.
                              </FieldError>
                            )}
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
                                aria-invalid={!plotAreaValid}
                                aria-describedby={
                                  plotAreaValid ? undefined : "plan-plot-area-error"
                                }
                              />
                              {!plotAreaValid && (
                                <FieldError id="plan-plot-area-error" className="text-xs">
                                  Kies een perceelsgrootte van minstens 0,1 ha.
                                </FieldError>
                              )}
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
                              ? `; bij dag en nacht weiden (meer dan ${NNW_DAY_AND_NIGHT_HOURS} uur) 's ochtends en 's avonds een nieuw perceel, elk als eigen beweiding met de helft van de uren`
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
              )}
            </div>

            {selectedSystem.requiresGrazingRecords && (
              <Card className="2xl:sticky 2xl:top-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Stap 3: Controleer het plan</CardTitle>
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
                        {collisions.length === 1 ? "periode kan" : "perioden kunnen"} niet worden
                        vastgelegd en {collisions.length === 1 ? "wordt" : "worden"} overgeslagen:
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {collisions.slice(0, 3).map((c, i) => (
                          <li key={i}>
                            {c.fieldName} (
                            {c.startDate === c.endDate
                              ? formatPlanDay(c.startDate)
                              : `${formatPlanDay(c.startDate)} – ${formatPlanDay(c.endDate)}`}
                            ): {c.reason.toLowerCase()}
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
                      // In the half-width column of a wide screen, the map sits above the plan
                      previewZones.length > 0 && "lg:grid-cols-2 lg:items-start 2xl:grid-cols-1",
                    )}
                  >
                    {previewZones.length > 0 && (
                      <div className="h-[380px] overflow-hidden rounded-lg border lg:order-2 xl:h-[480px] 2xl:order-none 2xl:h-[320px]">
                        <Suspense fallback={<Skeleton className="h-full w-full" />}>
                          <PlanPreviewMap
                            fields={previewFields}
                            zones={previewZones}
                            highlightedZoneId={hoveredZoneId}
                            onZoneHover={setHoveredZoneId}
                            height="100%"
                          />
                        </Suspense>
                      </div>
                    )}

                    {/* The sticky card of a wide screen keeps its footer on a 1080 px screen */}
                    <div className="max-h-64 overflow-y-auto rounded-lg border lg:max-h-[380px] xl:max-h-[480px] 2xl:max-h-[360px]">
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
                                    "bg-muted/50",
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
                                        `${formatHa(Math.min(row.zoneArea, row.fieldArea))} ha van ${formatHa(row.fieldArea)} ha`
                                      : row.l_grazing_area
                                        ? `${formatHa(row.l_grazing_area)} ha van ${formatHa(row.fieldArea)} ha`
                                        : `${formatHa(row.fieldArea)} ha`}
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
                </CardContent>
                {/* On a phone both buttons span the width, the confirm button on top (as in the
                      dialog footers) */}
                <CardFooter className="flex flex-col-reverse items-stretch gap-2 border-t sm:flex-row sm:items-center sm:justify-between">
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
            )}
          </div>
        </FarmContent>
      </div>
    </PageContainer>
  )
}
