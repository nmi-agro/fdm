import { differenceInDays, differenceInMonths, format } from "date-fns"
import { nl } from "date-fns/locale"
import { TestTube2, Wheat } from "lucide-react"
import { useEffect, useRef } from "react"
import { NavLink, useNavigate } from "react-router"
import { FertilizerIcon } from "~/components/blocks/gerrit/fertilizer-icon"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import {
  type GanttFeature,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttFeatureRow,
  GanttHeader,
  GanttProvider,
  type GanttStatus,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttToday,
  type Range,
} from "~/components/kibo-ui/gantt"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

export type TimelineFertilizerApplication = {
  p_app_id: string
  p_id: string
  p_name_nl: string | null
  p_app_amount_display: number | null
  p_app_amount_unit: string | null
  p_app_date: Date
}

export type TimelineHarvest = {
  b_id_harvesting: string
  b_lu: string
  b_lu_name: string | null
  b_lu_harvest_date: Date | null
  /** Pre-filtered/labeled by the server loader to only the parameters fillable for this crop's harvest category. */
  parameters: { label: string; value: number }[]
}

export type TimelineSoilAnalysis = {
  a_id: string
  b_id_sampling: string
  b_sampling_date: Date | null
  a_source: string | null
}

export type TimelineCultivation = {
  b_lu: string
  b_lu_name: string | null
  b_lu_croprotation: string | null
  b_lu_start: Date | null
  b_lu_end: Date | null
}

export type TimelineField = {
  b_id: string
  b_name: string
  b_area: number
  b_bufferstrip: boolean
  cultivations: TimelineCultivation[]
  fertilizerApplications: TimelineFertilizerApplication[]
  harvests: TimelineHarvest[]
  soilAnalyses: TimelineSoilAnalysis[]
}

export type TimelineFilters = {
  showBufferStrips: boolean
  showCultivations: boolean
  showFertilizers: boolean
  showHarvests: boolean
  showSoilSamplings: boolean
}

type PointEventKind = "cultivation" | "fertilizer" | "harvest" | "soil"

/** A fertilizer/harvest/soil event overlaid on top of the cultivation bar it falls within. */
type AttachedEvent = {
  id: string
  kind: "fertilizer" | "harvest" | "soil"
  percent: number
  label: string
  detail: string
  href: string
  p_type?: "manure" | "mineral" | "compost" | null
}

type TimelineFeature = GanttFeature & {
  kind: PointEventKind
  href?: string
  detail: string
  p_type?: "manure" | "mineral" | "compost" | null
  events?: AttachedEvent[]
}

const cultivationStatus = (b_lu_croprotation: string | null): GanttStatus => ({
  id: b_lu_croprotation ?? "other",
  name: b_lu_croprotation ?? "Overig",
  color: getCultivationColor(b_lu_croprotation ?? undefined),
})

const fertilizerStatus: GanttStatus = { id: "fertilizer", name: "Bemesting", color: "#ea580c" }
const harvestStatus: GanttStatus = { id: "harvest", name: "Oogst", color: "#eab308" }
const soilStatus: GanttStatus = { id: "soil", name: "Bodemmonster", color: "#2563eb" }

const formatNl = (date: Date) => format(date, "d MMM yyyy", { locale: nl })

/** Converts a "#rrggbb" hex color to an rgba() string with the given alpha, for a translucent tint. */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "")
  const bigint = Number.parseInt(clean, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function formatHarvestDetails(harvest: TimelineHarvest): string {
  return harvest.parameters.map(({ label, value }) => `${label}: ${value}`).join("\n")
}

/**
 * Builds the Gantt features for a single field: cultivation periods as duration bars, with
 * fertilizer/harvest/soil events that fall within a cultivation's date range overlaid directly
 * on top of that bar (as small icons at the corresponding date offset). Events that don't fall
 * within any visible cultivation's range (e.g. no cultivation loaded for that period) fall back
 * to standalone single-day "pill" features so no data is silently dropped.
 */
function buildFieldFeatures(
  field: TimelineField,
  filters: TimelineFilters,
  fertilizerTypeById: Map<string, "manure" | "mineral" | "compost" | null>,
  b_id_farm: string,
  calendar: string,
  openCultivationEndAt: Date,
): TimelineFeature[] {
  const cultivationFeatures: TimelineFeature[] = []

  if (filters.showCultivations) {
    for (const cultivation of field.cultivations) {
      if (!cultivation.b_lu_start) continue
      const startAt = cultivation.b_lu_start
      // Cultivations without an end date are still active. Extend the bar to the end of the
      // selected calendar year (rather than to "today") so it doesn't visually stop midway
      // through the year when browsing a past year, and still shows the rest of the year when
      // browsing the current year.
      const endAt = cultivation.b_lu_end ?? openCultivationEndAt
      const name = cultivation.b_lu_name ?? "Onbekend gewas"
      const color = cultivationStatus(cultivation.b_lu_croprotation).color
      cultivationFeatures.push({
        id: `cultivation-${cultivation.b_lu}`,
        name,
        startAt,
        endAt,
        status: cultivationStatus(cultivation.b_lu_croprotation),
        color: hexToRgba(color, 0.35),
        lane: field.b_id,
        kind: "cultivation",
        href: `/farm/${b_id_farm}/${calendar}/field/${field.b_id}/cultivation`,
        detail: `${name} — ${field.b_name}\n${formatNl(startAt)} – ${cultivation.b_lu_end ? formatNl(cultivation.b_lu_end) : "nu actief"}`,
        events: [],
      })
    }
  }

  const orphanFeatures: TimelineFeature[] = []

  const findCultivationFor = (date: Date): TimelineFeature | undefined =>
    cultivationFeatures.find((c) => date >= c.startAt && date <= c.endAt)

  const attachOrPush = (
    date: Date,
    event: Omit<AttachedEvent, "percent">,
    orphan: Omit<TimelineFeature, "detail"> & { detail: string },
  ) => {
    const cultivation = findCultivationFor(date)
    if (cultivation) {
      const span = cultivation.endAt.getTime() - cultivation.startAt.getTime()
      const rawPercent =
        span > 0 ? ((date.getTime() - cultivation.startAt.getTime()) / span) * 100 : 50
      const percent = Math.min(96, Math.max(4, rawPercent))
      cultivation.events?.push({ ...event, percent })
    } else {
      orphanFeatures.push(orphan)
    }
  }

  if (filters.showFertilizers) {
    for (const app of field.fertilizerApplications) {
      const p_type = fertilizerTypeById.get(app.p_id) ?? null
      const name = app.p_name_nl ?? "Bemesting"
      const amountText =
        app.p_app_amount_display != null && app.p_app_amount_unit
          ? `${app.p_app_amount_display} ${app.p_app_amount_unit}`
          : null
      const href = `/farm/${b_id_farm}/${calendar}/field/${field.b_id}/fertilizer`
      const detail = `Bemesting: ${name}${amountText ? ` — ${amountText}` : ""}\n${field.b_name} · ${formatNl(app.p_app_date)}`
      attachOrPush(
        app.p_app_date,
        { id: `fertilizer-${app.p_app_id}`, kind: "fertilizer", label: name, detail, href, p_type },
        {
          id: `fertilizer-${app.p_app_id}`,
          name,
          startAt: app.p_app_date,
          endAt: app.p_app_date,
          status: fertilizerStatus,
          lane: field.b_id,
          kind: "fertilizer",
          href,
          detail,
          p_type,
        },
      )
    }
  }

  if (filters.showHarvests) {
    for (const harvest of field.harvests) {
      if (!harvest.b_lu_harvest_date) continue
      const name = harvest.b_lu_name ? `Oogst ${harvest.b_lu_name}` : "Oogst"
      const href = `/farm/${b_id_farm}/${calendar}/field/${field.b_id}/cultivation`
      const parameterDetails = formatHarvestDetails(harvest)
      const detail = `${name}\n${field.b_name} · ${formatNl(harvest.b_lu_harvest_date)}${
        parameterDetails ? `\n${parameterDetails}` : ""
      }`
      attachOrPush(
        harvest.b_lu_harvest_date,
        { id: `harvest-${harvest.b_id_harvesting}`, kind: "harvest", label: name, detail, href },
        {
          id: `harvest-${harvest.b_id_harvesting}`,
          name,
          startAt: harvest.b_lu_harvest_date,
          endAt: harvest.b_lu_harvest_date,
          status: harvestStatus,
          lane: field.b_id,
          kind: "harvest",
          href,
          detail,
        },
      )
    }
  }

  if (filters.showSoilSamplings) {
    for (const analysis of field.soilAnalyses) {
      if (!analysis.b_sampling_date) continue
      const name = "Bodemmonster"
      const href = `/farm/${b_id_farm}/${calendar}/field/${field.b_id}/soil`
      const detail = `${name}${analysis.a_source ? ` — ${analysis.a_source}` : ""}\n${field.b_name} · ${formatNl(analysis.b_sampling_date)}`
      attachOrPush(
        analysis.b_sampling_date,
        { id: `soil-${analysis.a_id}`, kind: "soil", label: name, detail, href },
        {
          id: `soil-${analysis.a_id}`,
          name,
          startAt: analysis.b_sampling_date,
          endAt: analysis.b_sampling_date,
          status: soilStatus,
          lane: field.b_id,
          kind: "soil",
          href,
          detail,
        },
      )
    }
  }

  return [...cultivationFeatures, ...orphanFeatures]
}

function EventIcon({ kind, p_type }: { kind: AttachedEvent["kind"]; p_type?: string | null }) {
  if (kind === "fertilizer") return <FertilizerIcon p_type={p_type ?? "other"} />
  if (kind === "harvest") return <Wheat className="size-3 shrink-0 text-yellow-600" />
  return <TestTube2 className="size-3 shrink-0 text-blue-600" />
}

function EventOverlay({ event }: { event: AttachedEvent }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          className="bg-background/90 ring-border/50 absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full p-0.5 shadow-sm ring-1"
          onClick={(event_) => event_.stopPropagation()}
          style={{ left: `${event.percent}%` }}
          to={event.href}
        >
          <EventIcon kind={event.kind} p_type={event.p_type} />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line">{event.detail}</TooltipContent>
    </Tooltip>
  )
}

function FeatureContent({ feature }: { feature: TimelineFeature }) {
  const navigate = useNavigate()

  if (feature.kind === "cultivation") {
    return (
      <div className="relative flex h-full min-w-0 flex-1 items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute inset-0 flex cursor-pointer items-center"
              onClick={() => void navigate(feature.href ?? "#")}
              onKeyDown={(event) => {
                if (event.key === "Enter") void navigate(feature.href ?? "#")
              }}
              role="button"
              tabIndex={0}
            >
              <p className="flex-1 truncate px-1.5 text-xs">{feature.name}</p>
            </div>
          </TooltipTrigger>
          <TooltipContent className="whitespace-pre-line">{feature.detail}</TooltipContent>
        </Tooltip>
        {/* Rendered as siblings (not nested inside the label's Tooltip trigger above) so
            hovering an event icon only opens its own tooltip, not the cultivation bar's. */}
        {feature.events?.map((event) => (
          <EventOverlay event={event} key={event.id} />
        ))}
      </div>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          className="flex h-full min-w-0 flex-1 items-center justify-center"
          to={feature.href ?? "#"}
        >
          <EventIcon kind={feature.kind} p_type={feature.p_type} />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line">{feature.detail}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Scrolls the Gantt viewport so the start of the selected calendar year is visible on mount
 * (and whenever the year or zoom range changes), instead of Kibo UI's default of always
 * centering on the real-world "today".
 */
function useScrollToCalendarYear(
  containerRef: React.RefObject<HTMLDivElement | null>,
  calendarYear: number,
  range: Range,
) {
  useEffect(() => {
    const scrollElement = containerRef.current?.querySelector<HTMLDivElement>(".gantt")
    if (!scrollElement) return

    // Kibo UI's GanttProvider always initializes its timeline data around the real current
    // date (see `createInitialTimelineData`), spanning [currentYear - 1, currentYear + 1].
    const timelineStartDate = new Date(new Date().getFullYear() - 1, 0, 1)
    const target = new Date(calendarYear, 0, 1)
    const columnWidth = range === "monthly" ? 150 : range === "quarterly" ? 100 : 50
    const diff =
      range === "daily"
        ? differenceInDays(target, timelineStartDate)
        : differenceInMonths(target, timelineStartDate)
    const offset = Math.max(0, columnWidth * diff)

    // Run after Kibo's own mount effect (which centers on today) has applied.
    const timeout = window.setTimeout(() => {
      scrollElement.scrollLeft = offset
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [containerRef, calendarYear, range])
}

/**
 * Replicates Kibo UI's internal `GanttFeatureRow` overlap-stacking algorithm so we can compute,
 * ahead of render, exactly how many sub-rows a field's features will occupy — needed to size
 * `GanttTimeline` explicitly (see below).
 */
function computeMaxSubRows(features: TimelineFeature[]): number {
  const sorted = [...features].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  const subRowEndTimes: number[] = []
  for (const feature of sorted) {
    let subRow = 0
    while (subRow < subRowEndTimes.length && subRowEndTimes[subRow] > feature.startAt.getTime()) {
      subRow++
    }
    if (subRow === subRowEndTimes.length) {
      subRowEndTimes.push(feature.endAt.getTime())
    } else {
      subRowEndTimes[subRow] = feature.endAt.getTime()
    }
  }
  return Math.max(1, subRowEndTimes.length)
}

const ROW_HEIGHT_PX = 36
const GROUP_GAP_PX = 16 // Tailwind's `space-y-4`, used both in GanttSidebar and GanttFeatureList

export function TimelineGanttView({
  fields,
  filters,
  fertilizerTypeById,
  b_id_farm,
  calendar,
  calendarYear,
  range,
}: {
  fields: TimelineField[]
  filters: TimelineFilters
  fertilizerTypeById: Map<string, "manure" | "mineral" | "compost" | null>
  b_id_farm: string
  calendar: string
  calendarYear: number
  range: Range
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  useScrollToCalendarYear(containerRef, calendarYear, range)

  const visibleFields = fields
    .filter((field) => filters.showBufferStrips || !field.b_bufferstrip)
    .sort((a, b) => b.b_area - a.b_area || a.b_name.localeCompare(b.b_name, "nl"))

  const openCultivationEndAt = new Date(calendarYear, 11, 31, 23, 59, 59)

  // Precompute each field's features once (reused for the timeline row) and its resulting
  // sub-row count, so we can give `GanttTimeline` an explicit total height below.
  const fieldsWithFeatures = visibleFields.map((field) => {
    const features = buildFieldFeatures(
      field,
      filters,
      fertilizerTypeById,
      b_id_farm,
      calendar,
      openCultivationEndAt,
    )
    return { field, features, maxSubRows: computeMaxSubRows(features) }
  })

  // Kibo UI's `GanttTimeline` uses `overflow-clip` combined with a percentage (`h-full`) height,
  // which — inside this nested sidebar/timeline grid layout — resolves to the height of the
  // *initially visible* viewport instead of stretching to fit all field rows. That silently
  // clips any bars/markers (including the "today" line) beyond roughly the first screenful,
  // even though the sidebar (which sizes itself from real content) keeps scrolling correctly.
  // Fix: give it an explicit pixel height computed from the actual content, overriding `h-full`.
  const totalTimelineHeight =
    fieldsWithFeatures.reduce(
      (sum, { maxSubRows }) => sum + ROW_HEIGHT_PX + maxSubRows * ROW_HEIGHT_PX,
      0,
    ) + Math.max(0, fieldsWithFeatures.length - 1) * GROUP_GAP_PX

  return (
    <TooltipProvider delayDuration={150}>
      <div ref={containerRef}>
        <GanttProvider className="h-[calc(100vh-16rem)] rounded-lg border" range={range} zoom={100}>
          <GanttSidebar>
            {visibleFields.map((field) => {
              const cultivationFeatures = buildFieldFeatures(
                field,
                {
                  ...filters,
                  showFertilizers: false,
                  showHarvests: false,
                  showSoilSamplings: false,
                },
                fertilizerTypeById,
                b_id_farm,
                calendar,
                openCultivationEndAt,
              )
              return (
                <GanttSidebarGroup key={field.b_id} name={`${field.b_name} (${field.b_area} ha)`}>
                  {cultivationFeatures.length === 0 ? (
                    <p className="text-muted-foreground p-2.5 text-xs">Geen gewassen</p>
                  ) : (
                    cultivationFeatures.map((feature) => (
                      <GanttSidebarItem feature={feature} key={feature.id} />
                    ))
                  )}
                </GanttSidebarGroup>
              )
            })}
          </GanttSidebar>
          <GanttTimeline style={{ height: totalTimelineHeight }}>
            <GanttHeader />
            <GanttFeatureList>
              {fieldsWithFeatures.map(({ field, features }) => (
                <GanttFeatureListGroup key={field.b_id}>
                  <GanttFeatureRow features={features}>
                    {(feature) => <FeatureContent feature={feature as TimelineFeature} />}
                  </GanttFeatureRow>
                </GanttFeatureListGroup>
              ))}
            </GanttFeatureList>
            <GanttToday />
          </GanttTimeline>
        </GanttProvider>
      </div>
    </TooltipProvider>
  )
}
