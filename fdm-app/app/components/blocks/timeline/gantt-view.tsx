import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { LandPlot, TestTube2, Wheat } from "lucide-react"
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import { NavLink, useNavigate } from "react-router"
import { EVENT_TYPE_COLOR } from "~/components/blocks/timeline/timeline-colors"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { FertilizerIcon } from "~/components/custom/fertilizer-icon"
import {
  computeGanttSubRowCount,
  type GanttFeature,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttFeatureRow,
  getGanttDateOffset,
  GanttHeader,
  GanttProvider,
  type GanttStatus,
  GanttSidebar,
  GanttSidebarGroup,
  GanttTimeline,
  GanttToday,
  type Range,
} from "~/components/kibo-ui/gantt"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { endMonth, startMonth } from "~/lib/calendar"

// The years the Gantt renders/scrolls through must never exceed what the app's "Calendar" year
// picker actually supports (`~/lib/calendar`) — otherwise the timeline could show a year (e.g.
// one past the real current year) that isn't a selectable calendar year anywhere else in the app.
const TIMELINE_START_YEAR = startMonth.getFullYear()
const TIMELINE_END_YEAR = endMonth.getFullYear()

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
  b_lu_harvestable: "none" | "once" | "multiple"
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
  /** Mobile-only: desktop's Gantt always shows the full range regardless of this flag. */
  showFutureEvents: boolean
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

const fertilizerStatus: GanttStatus = {
  id: "fertilizer",
  name: "Bemesting",
  color: EVENT_TYPE_COLOR.fertilizer,
}
const harvestStatus: GanttStatus = { id: "harvest", name: "Oogst", color: EVENT_TYPE_COLOR.harvest }
const soilStatus: GanttStatus = {
  id: "soil",
  name: "Bodemanalyse",
  color: EVENT_TYPE_COLOR.soil_sampling,
}

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
      // Cultivations without an end date are still ongoing — extend the bar all the way to the
      // edge of the rendered timeline (rather than stopping at the selected calendar year) so it
      // visually keeps going instead of implying it ended on Dec 31.
      const endAt = cultivation.b_lu_end ?? openCultivationEndAt
      const name = cultivation.b_lu_name ?? "Onbekend gewas"
      const color = cultivationStatus(cultivation.b_lu_croprotation).color
      cultivationFeatures.push({
        id: `cultivation-${cultivation.b_lu}`,
        name,
        startAt,
        endAt,
        status: cultivationStatus(cultivation.b_lu_croprotation),
        color: hexToRgba(color, 0.5),
        lane: field.b_id,
        kind: "cultivation",
        href: `/farm/${b_id_farm}/${calendar}/field/${field.b_id}/cultivation`,
        detail: `${name} — ${field.b_name}\n${formatNl(startAt)} – ${cultivation.b_lu_end ? formatNl(cultivation.b_lu_end) : "nu actief"}`,
        events: [],
      })
    }
  }

  const orphanFeatures: TimelineFeature[] = []

  // Prefer the *tightest-fitting* cultivation containing the date (smallest span), not just the
  // first one found. Open-ended cultivations (no b_lu_end — e.g. permanent grassland) are
  // extended all the way to `openCultivationEndAt` and can span many years, overlapping with a
  // genuinely distinct, narrower cultivation on the same field (e.g. an annual crop grown within
  // that same period). Picking an arbitrary/first match would attach the event to the wrong bar
  // and compute its position against the wrong (much larger) date range, visually placing it far
  // from its real date.
  const findCultivationFor = (date: Date): TimelineFeature | undefined => {
    let best: TimelineFeature | undefined
    let bestSpan = Number.POSITIVE_INFINITY
    for (const cultivation of cultivationFeatures) {
      if (date < cultivation.startAt || date > cultivation.endAt) continue
      const span = cultivation.endAt.getTime() - cultivation.startAt.getTime()
      if (span < bestSpan) {
        best = cultivation
        bestSpan = span
      }
    }
    return best
  }

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
      // Don't clamp events that fall exactly on the cultivation's start/end date (e.g. a
      // single-harvest crop like luzerne, where the harvest date IS the end date) — clamping
      // those to 4/96% would visually shift them away from the edge they actually belong on,
      // contradicting the exact date shown in the tooltip. Only pull interior events in from
      // the very edge so they don't render on top of the bar's rounded corners.
      const percent =
        date.getTime() === cultivation.endAt.getTime()
          ? 100
          : date.getTime() === cultivation.startAt.getTime()
            ? 0
            : Math.min(96, Math.max(4, rawPercent))
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
      const name = "Bodemanalyse"
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

  // Events attached to the same cultivation can legitimately share (or nearly share) a date —
  // e.g. two fertilizer applications a few days apart. Left as raw percentages, those render as
  // overlapping icons. Spread them out left-to-right (preserving chronological order) so every
  // icon stays individually clickable and legible.
  //
  // The gap is computed in absolute days, not as a percentage of the cultivation bar's span.
  // Percent-of-span breaks down once open-ended cultivations (e.g. permanent "blijvend"
  // grassland, extended all the way to `openCultivationEndAt`) can span many years: a 6%-of-span
  // nudge is a few days on a one-season bar, but months on a multi-year bar — which visibly
  // dragged events far from their real date once the timeline started loading a farm's entire
  // history at once instead of just the browsed year.
  const MIN_EVENT_GAP_DAYS = 4
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  for (const cultivation of cultivationFeatures) {
    if (!cultivation.events || cultivation.events.length < 2) continue
    const spanMs = cultivation.endAt.getTime() - cultivation.startAt.getTime()
    if (spanMs <= 0) continue
    cultivation.events.sort((a, b) => a.percent - b.percent)
    let previousOffsetMs = Number.NEGATIVE_INFINITY
    for (const event of cultivation.events) {
      const rawOffsetMs = (event.percent / 100) * spanMs
      const offsetMs = Math.max(rawOffsetMs, previousOffsetMs + MIN_EVENT_GAP_DAYS * MS_PER_DAY)
      event.percent = Math.min(100, (offsetMs / spanMs) * 100)
      previousOffsetMs = offsetMs
    }
  }

  return [...cultivationFeatures, ...orphanFeatures]
}

function EventIcon({ kind, p_type }: { kind: AttachedEvent["kind"]; p_type?: string | null }) {
  if (kind === "fertilizer") return <FertilizerIcon p_type={p_type ?? "other"} />
  if (kind === "harvest")
    return <Wheat className="size-3 shrink-0" style={{ color: EVENT_TYPE_COLOR.harvest }} />
  return <TestTube2 className="size-3 shrink-0" style={{ color: EVENT_TYPE_COLOR.soil_sampling }} />
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

  // The earliest overlaid event (if any) bounds how much horizontal room the crop-name label
  // can safely claim before it would run under that icon.
  const firstEventPercent = useMemo(
    () =>
      feature.events && feature.events.length > 0
        ? Math.min(...feature.events.map((event) => event.percent))
        : null,
    [feature.events],
  )

  if (feature.kind === "cultivation") {
    return (
      <div className="relative h-full min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute inset-0 flex cursor-pointer items-start"
              onClick={() => void navigate(feature.href ?? "#")}
              onKeyDown={(event) => {
                if (event.key === "Enter") void navigate(feature.href ?? "#")
              }}
              role="button"
              tabIndex={0}
            >
              {/* Clipped to end just before the first event icon (rather than always spanning
                  the full bar) so at high field-count density the label never renders under an
                  icon — see the density note on `ROW_HEIGHT_PX`. `max()` floors it at 0 instead
                  of going negative when an event sits right at (or near) the bar's start. */}
              <p
                className="truncate px-1.5 pt-0.5 text-xs"
                style={
                  firstEventPercent !== null
                    ? { maxWidth: `max(0px, calc(${firstEventPercent}% - 14px))` }
                    : undefined
                }
              >
                {feature.name}
              </p>
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
 * Horizontal scroll offset (px) for a given date within the Gantt's rendered timeline, which
 * starts at `TIMELINE_START_YEAR` (see `createInitialTimelineData`/the `startYear` prop below).
 * Reuses Kibo UI's own `getGanttDateOffset` (the exact function that positions feature bars) so
 * the scroll target lines up precisely with where that date actually renders, at day precision.
 */
function computeScrollOffset(target: Date, range: Range): number {
  const timelineStartDate = new Date(TIMELINE_START_YEAR, 0, 1)
  const columnWidth = range === "monthly" ? 150 : range === "quarterly" ? 100 : 50
  return Math.max(
    0,
    getGanttDateOffset(target, timelineStartDate, { columnWidth, range, zoom: 100 }),
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

    const offset = computeScrollOffset(new Date(calendarYear, 0, 1), range)

    // Run after Kibo's own mount effect (which centers on today) has applied.
    const timeout = window.setTimeout(() => {
      scrollElement.scrollLeft = offset
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [containerRef, calendarYear, range])
}

// Each field now occupies exactly one row per bar/sub-row (no separate row reserved for the
// field name — see GanttSidebarGroup/GanttFeatureListGroup, which overlay the name instead of
// stacking it above the content) so farms with 100+ fields show far more of them at once.
const ROW_HEIGHT_PX = 32
const GROUP_GAP_PX = 8 // Tailwind's `space-y-2`, used both in GanttSidebar and GanttFeatureList
const GANTT_HEADER_HEIGHT_PX = 60

export type TimelineGanttViewHandle = {
  /** Scrolls the timeline horizontally so today's date is in view. */
  scrollToToday: () => void
  /** Scrolls the timeline horizontally so the given calendar year is in view, centered. */
  scrollToYear: (year: number) => void
}

export const TimelineGanttView = forwardRef<
  TimelineGanttViewHandle,
  {
    fields: TimelineField[]
    filters: TimelineFilters
    /** Optional: enables the "reset filters" action in the all-hidden empty state. */
    onFiltersChange?: (filters: TimelineFilters) => void
    fertilizerTypeById: Map<string, "manure" | "mineral" | "compost" | null>
    b_id_farm: string
    calendar: string
    calendarYear: number
    range: Range
  }
>(function TimelineGanttView(
  {
    fields,
    filters,
    onFiltersChange,
    fertilizerTypeById,
    b_id_farm,
    calendar,
    calendarYear,
    range,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  useScrollToCalendarYear(containerRef, calendarYear, range)

  const scrollToCenteredOffset = useMemo(
    () => (offset: number) => {
      const scrollElement = containerRef.current?.querySelector<HTMLDivElement>(".gantt")
      if (!scrollElement) return
      const sidebarElement = scrollElement.querySelector<HTMLDivElement>(
        '[data-roadmap-ui="gantt-sidebar"]',
      )
      const sidebarWidth = sidebarElement?.getBoundingClientRect().width ?? 0
      // The sidebar is sticky and always covers the left edge of the viewport, so center the
      // target within the visible timeline area to its right, not the full scroll viewport.
      const visibleTimelineWidth = scrollElement.clientWidth - sidebarWidth
      const left = Math.max(0, offset - visibleTimelineWidth / 2)
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      scrollElement.scrollTo({ left, behavior: prefersReducedMotion ? "auto" : "smooth" })
    },
    [],
  )

  useImperativeHandle(
    ref,
    () => ({
      scrollToToday: () => scrollToCenteredOffset(computeScrollOffset(new Date(), range)),
      // Center on mid-year (rather than Jan 1) so the jump lands with months of context visible
      // on both sides, instead of the target date sitting at the very left of what's in view.
      scrollToYear: (year: number) =>
        scrollToCenteredOffset(computeScrollOffset(new Date(year, 6, 1), range)),
    }),
    [range, scrollToCenteredOffset],
  )

  const visibleFields = fields
    .filter((field) => filters.showBufferStrips || !field.b_bufferstrip)
    .sort((a, b) => b.b_area - a.b_area || a.b_name.localeCompare(b.b_name, "nl"))

  if (fields.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LandPlot />
          </EmptyMedia>
          <EmptyTitle>Nog geen percelen om te tonen</EmptyTitle>
          <EmptyDescription>
            Er zijn nog geen percelen met gewassen, bemestingen, oogsten of bodemanalyses gevonden
            op je bedrijf.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (visibleFields.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LandPlot />
          </EmptyMedia>
          <EmptyTitle>Geen percelen zichtbaar met deze filters</EmptyTitle>
          <EmptyDescription>
            Alle percelen van dit bedrijf zijn bufferstroken en die zijn nu verborgen.
          </EmptyDescription>
        </EmptyHeader>
        {onFiltersChange && (
          <EmptyContent>
            <Button
              onClick={() => onFiltersChange({ ...filters, showBufferStrips: true })}
              variant="outline"
            >
              Toon bufferstroken
            </Button>
          </EmptyContent>
        )}
      </Empty>
    )
  }

  // Cap open-ended cultivations at the rendered timeline's right edge (the last calendar year the
  // app supports), not the browsed year's Dec 31, so they visually keep going instead of
  // appearing to stop.
  const openCultivationEndAt = new Date(TIMELINE_END_YEAR, 11, 31, 23, 59, 59)

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
    return { field, features, maxSubRows: computeGanttSubRowCount(features) }
  })

  // Kibo UI's `GanttTimeline` uses `overflow-clip` combined with a percentage (`h-full`) height,
  // which — inside this nested sidebar/timeline grid layout — resolves to the height of the
  // *initially visible* viewport instead of stretching to fit all field rows. That silently
  // clips any bars/markers (including the "today" line) beyond roughly the first screenful,
  // even though the sidebar (which sizes itself from real content) keeps scrolling correctly.
  // Fix: give it an explicit pixel height computed from the actual content, overriding `h-full`.
  const totalTimelineHeight =
    GANTT_HEADER_HEIGHT_PX +
    fieldsWithFeatures.reduce((sum, { maxSubRows }) => sum + maxSubRows * ROW_HEIGHT_PX, 0) +
    Math.max(0, fieldsWithFeatures.length - 1) * GROUP_GAP_PX

  return (
    <TooltipProvider delayDuration={150}>
      <div ref={containerRef}>
        <GanttProvider
          className="h-[calc(100vh-16rem)] rounded-lg border"
          endYear={TIMELINE_END_YEAR}
          range={range}
          rowHeight={ROW_HEIGHT_PX}
          startYear={TIMELINE_START_YEAR}
          zoom={100}
        >
          <GanttSidebar>
            {fieldsWithFeatures.map(({ field, maxSubRows }) => (
              <GanttSidebarGroup
                key={field.b_id}
                name={
                  <>
                    <span className="text-foreground truncate text-xs font-semibold">
                      {field.b_name}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {field.b_area} ha
                    </span>
                  </>
                }
              >
                {/* No per-cultivation listing here (a field's cultivations, fertilizer
                    applications, etc. are all visible directly on the bar/icons and their
                    tooltips) — this is purely blank filler reserving the same height as the
                    corresponding timeline row(s), so the two panes stay vertically aligned even
                    when a field's bar needs extra sub-rows for overlapping features. */}
                <div style={{ height: maxSubRows * ROW_HEIGHT_PX }} />
              </GanttSidebarGroup>
            ))}
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
})
