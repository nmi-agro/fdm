import { DndContext, type DragEndEvent, MouseSensor, useDraggable, useSensor } from "@dnd-kit/core"
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers"
import { HarvestableAnalysis, HarvestParameters } from "@nmi-agro/fdm-core"
import { addDays, addMonths, format, getDaysInMonth } from "date-fns"
import { nl } from "date-fns/locale"
import { LandPlot, TestTube2, Wheat } from "lucide-react"
import {
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { NavLink, useFetcher, useNavigate } from "react-router"
import type {
  AddEventContext,
  AddEventSheetRequest,
} from "~/components/blocks/timeline/add-event-types"
import { EVENT_TYPE_COLOR } from "~/components/blocks/timeline/timeline-colors"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { FertilizerIcon } from "~/components/custom/fertilizer-icon"
import {
  computeGanttSubRowCount,
  GanttContext,
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
  useGanttScrollX,
} from "~/components/kibo-ui/gantt"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { endMonth, startMonth } from "~/lib/calendar"
import { getFertilizerCategoryFromRvoCode } from "../fertilizer/utils"

// The years the Gantt renders/scrolls through must never exceed what the app's "Calendar" year
// picker actually supports (~/lib/calendar) — otherwise the timeline could show a year (e.g.
// one past the real current year) that isn't a selectable calendar year anywhere else in the app.
const TIMELINE_START_YEAR = startMonth.getFullYear()
const TIMELINE_END_YEAR = endMonth.getFullYear()
// Where to end cultivations with no end date visually.
const TIMELINE_END_DATE = new Date(TIMELINE_END_YEAR, 11, 31, 23, 59, 59)

/**
 * Inverse of kibo-ui's internal (unexported) `getDateByMousePosition`: given a horizontal offset
 * (px, relative to the timeline's start date, i.e. already excluding the sidebar and current
 * scroll position — see `RowClickCatcher`), returns the date at that offset. Reimplemented here
 * rather than modifying `~/components/kibo-ui/gantt` (a shared, vendored component) since the
 * zoom is always fixed at 100 in this view.
 *
 * @param offsetX X offset from the left edge of the RowClickCatcher.
 * @returns the Date at that offset.
 */
function getDateFromOffsetX(offsetX: number, range: Range): Date {
  const timelineStartDate = new Date(TIMELINE_START_YEAR, 0, 1)
  const columnWidth = range === "monthly" ? 150 : range === "quarterly" ? 100 : 50
  const offset = Math.floor(offsetX / columnWidth)
  const month =
    range === "daily" ? addDays(timelineStartDate, offset) : addMonths(timelineStartDate, offset)
  const daysInMonth = range === "daily" ? 1 : getDaysInMonth(month)
  const pixelsPerDay = Math.round(columnWidth / daysInMonth)
  const dayOffset = Math.floor((offsetX % columnWidth) / pixelsPerDay)
  return addDays(month, dayOffset)
}

/**
 * Finds the cultivation covering `date` on this field, preferring the tightest-fitting one (same
 * "narrowest span wins" rule used to attach fertilizer/harvest/soil events to a bar in
 * `buildFieldFeatures`) — needed so an empty-space click or the "Oogst" quick-add option can
 * resolve which cultivation the date falls into.
 *
 * @param cultivations:
 */
export function findActiveCultivationForDate(
  cultivations: TimelineCultivation[],
  date: Date,
  openCultivationEndAt: Date,
): TimelineCultivation | undefined {
  let best: TimelineCultivation | undefined
  let bestSpan = Number.POSITIVE_INFINITY
  for (const cultivation of cultivations) {
    if (!cultivation.b_lu_start) continue
    const endAt = cultivation.b_lu_end ?? openCultivationEndAt
    if (date < cultivation.b_lu_start || date > endAt) continue
    const span = endAt.getTime() - cultivation.b_lu_start.getTime()
    if (span < bestSpan) {
      best = cultivation
      bestSpan = span
    }
  }
  return best
}

/**
 * Invisible, full-row click target rendered *behind* a field's `GanttFeatureRow` (i.e. before it
 * in DOM order — see the "positioned elements painted in DOM order" rule) so cultivation
 * bars/event icons, painted after, still win hit-testing over their own area, while the rest of
 * the row's empty space hits this instead. Shows a "+" cursor and, on click, resolves the date
 * under the cursor and reports it upward to open the add-event Command menu.
 */
function RowClickCatcher({ onPick }: { onPick: (date: Date) => void }) {
  const gantt = useContext(GanttContext)
  const [scrollX] = useGanttScrollX()
  // `GanttFeatureListGroup`/`GanttFeatureRow` have no real box width of their own — every bar
  // inside is `position: absolute`, so none of them contribute to their ancestor's (otherwise
  // `w-max`) intrinsic width. That left a plain `w-full`/`w-max` overlay only as wide as
  // whatever tiny box those ancestors collapse to, so most of a row's empty space fell straight
  // through to the real full-width element behind it: `GanttColumn`'s striped background grid
  // (sized from the header's real, non-absolutely-positioned columns). Measure the gantt's own
  // scrollable content width directly instead, so this overlay always spans the full row.
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const scrollElement = gantt.ref?.current
    if (!scrollElement) return

    const updateWidth = () => setWidth(Math.max(0, scrollElement.scrollWidth - gantt.sidebarWidth))

    updateWidth()
    // Re-measure on resize and whenever content changes (e.g. more years get appended while
    // scrolling near an edge, extending `scrollWidth`).
    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(scrollElement)
    const mutationObserver = new MutationObserver(updateWidth)
    mutationObserver.observe(scrollElement, { childList: true, subtree: true })

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [gantt.ref, gantt.sidebarWidth])

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const ganttRect = gantt.ref?.current?.getBoundingClientRect()
    const x = event.clientX - (ganttRect?.left ?? 0) + scrollX - gantt.sidebarWidth
    onPick(getDateFromOffsetX(x, gantt.range))
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mirrors kibo-ui's own GanttColumn
    <div
      className="absolute inset-y-0 left-0 min-h-full cursor-copy"
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        handleClick(e)
      }}
      style={{ width }}
    />
  )
}

export type TimelineFertilizerApplication = {
  p_app_id: string
  p_id: string
  p_name_nl: string | null
  p_app_amount_display: number | null
  p_app_amount_unit: string | null
  p_app_date: Date
  p_app_method: string | null
}

/** Fertilizer type/RVO-code lookup value, keyed by fertilizer `p_id` (see `fertilizerTypeById`). */
export type FertilizerTypeInfo = {
  p_type: "manure" | "mineral" | "compost" | null
  p_type_rvo?: string | null
}

export type TimelineHarvest = {
  b_id_harvesting: string
  b_lu: string
  b_lu_name: string | null
  b_lu_harvest_date: Date | null
  harvestableAnalysis: HarvestableAnalysis | null
  /** Pre-filtered/labeled by the server loader to only the parameters fillable for this crop's harvest category. */
  parameters: { id: HarvestParameters[number]; label: string; value: number }[]
}

export type TimelineSoilAnalysis = {
  a_id: string
  b_id_sampling: string
  b_sampling_date: Date | null
  a_source: string | null
}

export type TimelineCultivation = {
  b_lu: string
  b_lu_catalogue: string
  b_lu_name: string | null
  b_lu_croprotation: string | null
  b_lu_start: Date | null
  b_lu_end: Date | null
  b_lu_harvestable: "none" | "once" | "multiple"
  b_lu_harvestcat: string | null
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
  date: Date
  p_type?: "manure" | "mineral" | "compost" | null
  p_type_rvo?: string | null
  entityId?: string
}

type TimelineFeature = GanttFeature & {
  kind: PointEventKind
  href?: string
  detail: string
  p_type?: "manure" | "mineral" | "compost" | null
  p_type_rvo?: string | null
  events?: AttachedEvent[]
  /** Field/cultivation this feature belongs to — only set on `kind: "cultivation"` bars, used to
   *  drive the right-click quick-add ContextMenu. */
  b_id?: string
  b_lu?: string
  b_lu_harvestable?: "none" | "once" | "multiple"
  entityId?: string
}

/** Identifies exactly which record a delete/edit action targets. */
type EditableEntity =
  | { kind: "cultivation"; b_id: string; b_lu: string }
  | { kind: "fertilizer"; b_id: string; p_app_id: string }
  | { kind: "harvest"; b_id: string; b_lu: string; b_id_harvesting: string }

/** Bundles everything the drag/popover/delete affordances need, threaded down to
 *  `FeatureContent`/`EventOverlay` (both plain, prop-driven components rendered by
 *  `GanttFeatureRow`, so they can't close over `TimelineGanttView`'s own state). */
type TimelineEditing = {
  canModify: boolean
  onSheetRequest?: (request: AddEventSheetRequest) => void
  onEditHarvest: (b_id: string, b_lu: string, b_id_harvesting: string) => void
  requestDelete: (entity: EditableEntity, label: string) => void
  hoveredEntityId: string | null
  setHoveredEntityId: (id: string | null) => void
  submitCultivationMove: (
    b_id: string,
    b_lu: string,
    b_lu_start: Date,
    b_lu_end: Date | null,
  ) => void
  submitFertilizerDate: (p_app_id: string, p_app_date: Date) => void
  submitHarvestDate: (b_id_harvesting: string, b_lu_harvest_date: Date) => void
}

function entityLabel(entity: EditableEntity): string {
  if (entity.kind === "cultivation") return "dit gewas"
  if (entity.kind === "fertilizer") return "deze bemesting"
  return "deze oogst"
}

/** The Bewerken/Verwijderen actions shown in every event's click Popover — kept out of
 *  `EventOverlay`/`FeatureContent` themselves since both the attached-icon and orphan-pill and
 *  cultivation-bar cases need the exact same footer. */
function EventActionsPopoverFooter({
  editing,
  entity,
  onEdit,
}: {
  editing: TimelineEditing
  entity: EditableEntity
  onEdit?: () => void
}) {
  if (!editing.canModify) return null
  return (
    <div className="mt-2 flex justify-end gap-2">
      {onEdit && (
        <Button onClick={onEdit} size="sm" variant="outline">
          Bewerken
        </Button>
      )}
      <Button
        onClick={() => editing.requestDelete(entity, entityLabel(entity))}
        size="sm"
        variant="destructive"
      >
        Verwijderen
      </Button>
    </div>
  )
}

/**
 * Distinguishes a single click (open the summary/actions Popover) from a double click (skip the
 * Popover and go straight to the edit Sheet) on the same element, since browsers always fire a
 * "click" before "dblclick" — without this debounce, a double click would flash the Popover open
 * for an instant before the edit Sheet replaced it.
 */
function useClickVsDoubleClick(onClick: () => void, onDoubleClick: () => void) {
  const pendingClick = useRef<number>(undefined)
  return {
    onClick: () => {
      if (pendingClick.current) window.clearTimeout(pendingClick.current)
      pendingClick.current = window.setTimeout(() => {
        pendingClick.current = undefined
        onClick()
      }, 220)
    },
    onDoubleClick: () => {
      if (pendingClick.current) {
        window.clearTimeout(pendingClick.current)
        pendingClick.current = undefined
      }
      onDoubleClick()
    },
  }
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
  fertilizerTypeById: Map<string, FertilizerTypeInfo>,
  b_id_farm: string,
  calendar: string,
  openCultivationEndAt: Date,
): { cultivationFeatures: TimelineFeature[]; pointFeatures: TimelineFeature[] } {
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
        b_id: field.b_id,
        b_lu: cultivation.b_lu,
        b_lu_harvestable: cultivation.b_lu_harvestable,
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
      const fertilizerInfo = fertilizerTypeById.get(app.p_id)
      const p_type = fertilizerInfo?.p_type ?? null
      const p_type_rvo = fertilizerInfo?.p_type_rvo ?? null
      const name = app.p_name_nl ?? "Bemesting"
      const amountText =
        app.p_app_amount_display != null && app.p_app_amount_unit
          ? `${app.p_app_amount_display} ${app.p_app_amount_unit}`
          : null
      const href = `/farm/${b_id_farm}/${calendar}/field/${field.b_id}/fertilizer`
      const detail = `Bemesting: ${name}${amountText ? ` — ${amountText}` : ""}\n${field.b_name} · ${formatNl(app.p_app_date)}`
      attachOrPush(
        app.p_app_date,
        {
          id: `fertilizer-${app.p_app_id}`,
          kind: "fertilizer",
          label: name,
          detail,
          href,
          date: app.p_app_date,
          entityId: app.p_app_id,
          p_type,
          p_type_rvo,
        },
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
          b_id: field.b_id,
          entityId: app.p_app_id,
          p_type,
          p_type_rvo,
          resizable: false,
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
        {
          id: `harvest-${harvest.b_id_harvesting}`,
          kind: "harvest",
          label: name,
          detail,
          href,
          date: harvest.b_lu_harvest_date,
          entityId: harvest.b_id_harvesting,
        },
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
          b_id: field.b_id,
          b_lu: harvest.b_lu,
          entityId: harvest.b_id_harvesting,
          resizable: false,
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
        {
          id: `soil-${analysis.a_id}`,
          kind: "soil",
          label: name,
          detail,
          href,
          date: analysis.b_sampling_date,
        },
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
          draggable: false,
          resizable: false,
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

  return { cultivationFeatures, pointFeatures: orphanFeatures }
}

function EventIcon({
  kind,
  p_type_rvo,
}: {
  kind: AttachedEvent["kind"]
  p_type?: string | null
  p_type_rvo?: string | null
}) {
  if (kind === "fertilizer")
    return <FertilizerIcon p_type={getFertilizerCategoryFromRvoCode(p_type_rvo)} />
  if (kind === "harvest")
    return <Wheat className="size-3 shrink-0" style={{ color: EVENT_TYPE_COLOR.harvest }} />
  return <TestTube2 className="size-3 shrink-0" style={{ color: EVENT_TYPE_COLOR.soil_sampling }} />
}

/**
 * Draggable inner icon for an attached fertilizer/harvest event. Split out from `EventOverlay` so
 * `useDraggable` (which must live inside a `DndContext`) only wraps the icon itself — the
 * surrounding `DndContext`/Popover/Tooltip stay in the parent.
 */
function DraggableEventIcon({
  event,
  onActivate,
}: {
  event: AttachedEvent
  onActivate: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `event-${event.id}`,
  })
  const clickHandlers = useClickVsDoubleClick(onActivate, onActivate)

  return (
    <button
      className="bg-background/90 ring-border/50 absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full p-0.5 shadow-sm ring-1 active:cursor-grabbing"
      onClick={(domEvent) => {
        domEvent.stopPropagation()
        clickHandlers.onClick()
      }}
      onDoubleClick={(domEvent) => {
        domEvent.stopPropagation()
        clickHandlers.onDoubleClick()
      }}
      ref={setNodeRef}
      style={{
        left: `${event.percent}%`,
        opacity: isDragging ? 0.5 : 1,
        transform: transform
          ? `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px))`
          : undefined,
      }}
      type="button"
      {...attributes}
      {...listeners}
    >
      <EventIcon kind={event.kind} p_type={event.p_type} p_type_rvo={event.p_type_rvo} />
    </button>
  )
}

/**
 * A fertilizer/harvest icon overlaid on top of the cultivation bar it belongs to (its date falls
 * within that cultivation's period).
 */
function EventOverlay({
  b_id,
  b_lu,
  b_id_harvesting,
  cultivationEndAt,
  cultivationStartAt,
  editing,
  event,
  range,
}: {
  b_id: string
  b_lu: string
  b_id_harvesting?: string
  cultivationEndAt: Date
  cultivationStartAt: Date
  editing: TimelineEditing
  event: AttachedEvent
  range: Range
}) {
  const gantt = useContext(GanttContext)
  const [scrollX] = useGanttScrollX()
  const [open, setOpen] = useState(false)
  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 4 } })

  if (event.kind === "soil" || !editing.canModify || !event.entityId) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            className="bg-background/90 ring-border/50 absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full p-0.5 shadow-sm ring-1"
            onClick={(event_) => event_.stopPropagation()}
            style={{ left: `${event.percent}%` }}
            to={event.href}
          >
            <EventIcon kind={event.kind} p_type={event.p_type} p_type_rvo={event.p_type_rvo} />
          </NavLink>
        </TooltipTrigger>
        <TooltipContent className="whitespace-pre-line">{event.detail}</TooltipContent>
      </Tooltip>
    )
  }

  const entityId = event.entityId
  const entity: EditableEntity =
    event.kind === "fertilizer"
      ? { b_id, kind: "fertilizer", p_app_id: entityId }
      : { kind: "harvest", b_id, b_id_harvesting: entityId, b_lu }

  const handleEdit = () => {
    setOpen(false)
    if (event.kind === "fertilizer") {
      editing.onSheetRequest?.({
        type: "fertilizer-edit",
        context: { b_id, b_lu, date: event.date, p_app_id: entityId },
      })
    }
    if (event.kind === "harvest") {
      if (b_id_harvesting) {
        editing.onSheetRequest?.({
          type: "harvest-edit",
          context: { b_id, b_lu, b_id_harvesting },
        })
      }
    }
  }

  const handleDragEnd = (dragEvent: DragEndEvent) => {
    const ganttRect = gantt.ref?.current?.getBoundingClientRect()
    const translated = dragEvent.active.rect.current.translated
    if (!ganttRect || !translated) return
    const centerX = translated.left + translated.width / 2
    const x = centerX - ganttRect.left + scrollX - gantt.sidebarWidth
    const rawDate = getDateFromOffsetX(x, range)
    const clamped =
      rawDate < cultivationStartAt
        ? cultivationStartAt
        : rawDate > cultivationEndAt
          ? cultivationEndAt
          : rawDate
    if (event.kind === "fertilizer") {
      editing.submitFertilizerDate(entityId, clamped)
    } else {
      editing.submitHarvestDate(entityId, clamped)
    }
  }

  return (
    <DndContext
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={handleDragEnd}
      sensors={[mouseSensor]}
    >
      <Popover onOpenChange={setOpen} open={open}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <span
                onMouseEnter={() => editing.setHoveredEntityId(entityId)}
                onMouseLeave={() => editing.setHoveredEntityId(null)}
              >
                <DraggableEventIcon event={event} onActivate={() => setOpen(true)} />
              </span>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent className="whitespace-pre-line">{event.detail}</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-64 text-sm whitespace-pre-line">
          {event.detail}
          <EventActionsPopoverFooter editing={editing} entity={entity} onEdit={handleEdit} />
        </PopoverContent>
      </Popover>
    </DndContext>
  )
}

/**
 * A rounded rectangle to display on the Gantt chart. It may contain the cultivation name, or an icon for fertilizer
 * applications and harvests. Right clicking a cultivation feature will bring a context menu, and onSheetRequest
 * will be called with information collected according to whether the user has chosen Add Harvest, Add Fertilizer,
 * or End Cultivation. Clicking a feature opens a summary Popover (Bewerken/Verwijderen when editable); double
 * clicking skips the Popover and opens the edit Sheet (or, for harvests, navigates straight to its own page).
 */
function FeatureContent({
  editing,
  feature,
  range,
}: {
  editing: TimelineEditing
  feature: TimelineFeature
  range: Range
}) {
  const gantt = useContext(GanttContext)
  const [scrollX] = useGanttScrollX()
  const rightClickDateRef = useRef<Date>(feature.startAt)
  const rightClickHarvestDateRef = useRef<Date>(feature.startAt)
  const [popoverOpen, setPopoverOpen] = useState(false)

  // The earliest overlaid event (if any) bounds how much horizontal room the crop-name label
  // can safely claim before it would run under that icon.
  const firstEventPercent = useMemo(
    () =>
      feature.events && feature.events.length > 0
        ? Math.min(...feature.events.map((event) => event.percent))
        : null,
    [feature.events],
  )

  const b_id = feature.b_id
  const b_lu = feature.b_lu
  const entityId = feature.entityId

  const entity: EditableEntity | null =
    feature.kind === "cultivation" && b_id && b_lu
      ? { kind: "cultivation", b_id, b_lu }
      : feature.kind === "fertilizer" && entityId && b_id
        ? { b_id, kind: "fertilizer", p_app_id: entityId }
        : feature.kind === "harvest" && entityId && b_id
          ? { b_id, b_id_harvesting: entityId, b_lu: b_lu ?? "", kind: "harvest" }
          : null

  const handleEdit = () => {
    setPopoverOpen(false)
    if (feature.kind === "cultivation" && b_id && b_lu) {
      editing.onSheetRequest?.({
        context: { b_id, b_lu, date: feature.startAt },
        type: "cultivation-edit",
      })
    } else if (feature.kind === "fertilizer" && b_id && entityId) {
      editing.onSheetRequest?.({
        context: { b_id, b_lu: b_lu ?? "", date: feature.startAt, p_app_id: entityId },
        type: "fertilizer-edit",
      })
    } else if (feature.kind === "harvest" && b_id && entityId) {
      editing.onSheetRequest?.({
        context: { b_id, b_lu: b_lu ?? "", date: feature.startAt, b_id_harvesting: entityId },
        type: "harvest-edit",
      })
    }
  }

  const clickHandlers = useClickVsDoubleClick(() => setPopoverOpen(true), handleEdit)

  if (feature.kind === "cultivation") {
    const canHarvest = feature.b_lu_harvestable !== "none"
    const allowHarvestPastEnd = feature.b_lu_harvestable === "once"

    const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
      const ganttRect = gantt.ref?.current?.getBoundingClientRect()
      const x = event.clientX - (ganttRect?.left ?? 0) + scrollX - gantt.sidebarWidth
      const date = getDateFromOffsetX(x, range)
      const clamped =
        date < feature.startAt
          ? feature.startAt
          : feature.endAt && date > feature.endAt
            ? feature.endAt
            : date
      rightClickDateRef.current = clamped
      rightClickHarvestDateRef.current = allowHarvestPastEnd
        ? date < feature.startAt
          ? feature.startAt
          : date > TIMELINE_END_DATE
            ? TIMELINE_END_DATE
            : date
        : clamped
    }

    const bar = (
      <div className="relative h-full min-w-0 flex-1">
        <Popover onOpenChange={setPopoverOpen} open={popoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <div
                  className="absolute inset-0 flex cursor-pointer items-start"
                  onClick={clickHandlers.onClick}
                  onDoubleClick={clickHandlers.onDoubleClick}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setPopoverOpen(true)
                  }}
                  role="button"
                  tabIndex={0}
                >
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
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="whitespace-pre-line">{feature.detail}</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-64 text-sm whitespace-pre-line">
            {feature.detail}
            {entity && (
              <EventActionsPopoverFooter editing={editing} entity={entity} onEdit={handleEdit} />
            )}
          </PopoverContent>
        </Popover>
        {/* Rendered as siblings (not nested inside the label's Popover trigger above) so
            hovering/clicking an event icon only opens its own tooltip/popover, not the
            cultivation bar's. */}
        {b_id &&
          b_lu &&
          feature.events?.map((event) => (
            <EventOverlay
              b_id={b_id}
              b_lu={b_lu}
              b_id_harvesting={event.entityId}
              cultivationEndAt={feature.endAt}
              cultivationStartAt={feature.startAt}
              editing={editing}
              event={event}
              key={event.id}
              range={range}
            />
          ))}
      </div>
    )

    if (!b_id || !b_lu) {
      return bar
    }

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
          {bar}
        </ContextMenuTrigger>
        <ContextMenuContent>
          {editing.onSheetRequest && (
            <>
              <ContextMenuItem
                onClick={() =>
                  editing.onSheetRequest?.({
                    context: { b_id, date: rightClickDateRef.current, b_lu },
                    type: "fertilizer",
                  })
                }
              >
                Bemesting toevoegen
              </ContextMenuItem>
              {canHarvest && (
                <ContextMenuItem
                  onClick={() =>
                    editing.onSheetRequest?.({
                      context: { b_id, date: rightClickHarvestDateRef.current, b_lu },
                      type: "harvest",
                    })
                  }
                >
                  Oogst registreren
                </ContextMenuItem>
              )}
              <ContextMenuItem
                onClick={() =>
                  editing.onSheetRequest?.({
                    context: { b_id, date: rightClickDateRef.current, b_lu },
                    type: "cultivation-end",
                  })
                }
              >
                Gewas beëindigen
              </ContextMenuItem>
            </>
          )}
          {editing.canModify && entity && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => editing.requestDelete(entity, entityLabel(entity))}
              >
                Verwijderen
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  // Orphan fertilizer/harvest point pill (no covering cultivation).
  if (feature.kind === "soil" || !editing.canModify || !entity) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            className="flex h-full min-w-0 flex-1 items-center justify-center"
            to={feature.href ?? "#"}
          >
            <EventIcon
              kind={feature.kind}
              p_type={feature.p_type}
              p_type_rvo={feature.p_type_rvo}
            />
          </NavLink>
        </TooltipTrigger>
        <TooltipContent className="whitespace-pre-line">{feature.detail}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Popover onOpenChange={setPopoverOpen} open={popoverOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              className="flex h-full min-w-0 flex-1 items-center justify-center"
              onClick={clickHandlers.onClick}
              onDoubleClick={clickHandlers.onDoubleClick}
              onMouseEnter={() => entityId && editing.setHoveredEntityId(entityId)}
              onMouseLeave={() => editing.setHoveredEntityId(null)}
              type="button"
            >
              <EventIcon
                kind={feature.kind}
                p_type={feature.p_type}
                p_type_rvo={feature.p_type_rvo}
              />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="whitespace-pre-line">{feature.detail}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-64 text-sm whitespace-pre-line">
        {feature.detail}
        <EventActionsPopoverFooter editing={editing} entity={entity} onEdit={handleEdit} />
      </PopoverContent>
    </Popover>
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

/** Type for the imperative handle used for scrolling the Gantt chart around, and to refresh the data displayed on it. */
export type TimelineGanttViewHandle = {
  /** Scrolls the timeline horizontally so today's date is in view. */
  scrollToToday: () => void
  /** Scrolls the timeline horizontally so the given calendar year is in view, centered. */
  scrollToYear: (year: number) => void
  /** Refreshes (remounts) the Gantt chart imperatively, since it won't react to data changes otherwise. */
  remount: () => void
}

export const TimelineGanttView = forwardRef<
  TimelineGanttViewHandle,
  {
    fields: TimelineField[]
    filters: TimelineFilters
    /** Optional: enables the "reset filters" action in the all-hidden empty state. */
    onFiltersChange?: (filters: TimelineFilters) => void
    fertilizerTypeById: Map<string, FertilizerTypeInfo>
    b_id_farm: string
    calendar: string
    calendarYear: number
    range: Range
    canModify: boolean
    onRequestAddEvent?: (context: AddEventContext) => void
    onSheetRequest?: (request: AddEventSheetRequest) => void
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
    canModify,
    onRequestAddEvent,
    onSheetRequest,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const fetcher = useFetcher()
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

  const currentGanntChartData = useRef(fields)
  const [ganttChartId, setGanttChartId] = useState(0)

  // Create a new id representing the current fields data in order to remount the Gantt chart.
  // This is needed since the Gantt chart feature start and end dates aren't controllable.
  const remountPreservingScroll = useMemo(
    () => () => {
      setGanttChartId((id) => id + 1)
      const originalScrollElement = containerRef.current?.querySelector<HTMLDivElement>(".gantt")
      const originalScrollOffset = originalScrollElement?.scrollLeft ?? NaN
      setTimeout(() => {
        // Scroll back to last offset once the component remounts.
        // The layout of the new chart will be at least similar to beforehand so scrolling to the
        // same offset is good enough.
        const scrollElement = containerRef.current?.querySelector<HTMLDivElement>(".gantt")
        if (scrollElement) {
          if (!Number.isNaN(originalScrollOffset)) {
            scrollElement.scrollTo({ left: originalScrollOffset })
          } else {
            scrollToCenteredOffset(computeScrollOffset(new Date(), range))
          }
        }
      }, 100)
    },
    [range, scrollToCenteredOffset],
  )

  useImperativeHandle(
    ref,
    () => ({
      scrollToToday: () => scrollToCenteredOffset(computeScrollOffset(new Date(), range)),
      // Center on mid-year (rather than Jan 1) so the jump lands with months of context visible
      // on both sides, instead of the target date sitting at the very left of what's in view.
      scrollToYear: (year: number) =>
        scrollToCenteredOffset(computeScrollOffset(new Date(year, 6, 1), range)),
      remount: remountPreservingScroll,
    }),
    [range, scrollToCenteredOffset, remountPreservingScroll],
  )

  // Remount the Gantt chart when the data changes.
  useEffect(() => {
    if (currentGanntChartData.current === fields) return
    currentGanntChartData.current = fields
    remountPreservingScroll()
  }, [fields, remountPreservingScroll])

  const [pendingDelete, setPendingDelete] = useState<{
    entity: EditableEntity
    label: string
  } | null>(null)
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null)

  const submitCultivationMove = (
    b_id: string,
    b_lu: string,
    b_lu_start: Date,
    b_lu_end: Date | null,
  ) => {
    const cultivation = fields.flatMap((field) => field.cultivations).find((c) => c.b_lu === b_lu)
    if (!cultivation) return
    const formData = new FormData()
    formData.set("intent", "update_cultivation")
    formData.set("b_id", b_id)
    formData.set("b_lu", b_lu)
    formData.set("b_lu_catalogue", cultivation.b_lu_catalogue)
    formData.set("b_lu_start", b_lu_start.toISOString())
    if (b_lu_end) formData.set("b_lu_end", b_lu_end.toISOString())
    void fetcher.submit(formData, { method: "POST" })
  }

  const submitFertilizerDate = (p_app_id: string, p_app_date: Date) => {
    const formData = new FormData()
    formData.set("intent", "update_fertilizer_date")
    formData.set("p_app_id", p_app_id)
    formData.set("p_app_date", p_app_date.toISOString())
    void fetcher.submit(formData, { method: "POST" })
  }

  const submitHarvestDate = (b_id_harvesting: string, b_lu_harvest_date: Date) => {
    const formData = new FormData()
    formData.set("intent", "update_harvest_date")
    formData.set("b_id_harvesting", b_id_harvesting)
    formData.set("b_lu_harvest_date", b_lu_harvest_date.toISOString())
    void fetcher.submit(formData, { method: "POST" })
  }

  const onEditHarvest = (b_id: string, b_lu: string, b_id_harvesting: string) => {
    void navigate(
      `/farm/${b_id_farm}/${calendar}/field/${b_id}/cultivation/${b_lu}/harvest/${b_id_harvesting}`,
    )
  }

  const requestDelete = (entity: EditableEntity, label: string) =>
    setPendingDelete({ entity, label })

  const confirmDelete = () => {
    if (!pendingDelete) return
    const { entity } = pendingDelete
    if (entity.kind === "cultivation") {
      const formData = new FormData()
      formData.set("intent", "remove_cultivation")
      formData.set("b_lu", entity.b_lu)
      void fetcher.submit(formData, { method: "POST" })
    } else if (entity.kind === "harvest") {
      const formData = new FormData()
      formData.set("intent", "remove_harvest")
      formData.set("b_id_harvesting", entity.b_id_harvesting)
      void fetcher.submit(formData, { method: "POST" })
    } else {
      const formData = new FormData()
      formData.set("p_app_id", entity.p_app_id)
      void fetcher.submit(formData, {
        action: `/farm/${b_id_farm}/${calendar}/field/${entity.b_id}/fertilizer`,
        method: "DELETE",
      })
    }
    setPendingDelete(null)
  }

  // Allow deleting fertilizer applications and harvests by hovering over their badge and pressing Delete or Backspace.
  useEffect(() => {
    if (!canModify) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!hoveredEntityId) return
      if (event.key !== "Delete" && event.key !== "Backspace") return
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, [contenteditable='true']")) return
      for (const field of fields) {
        const fertilizer = field.fertilizerApplications.find((f) => f.p_app_id === hoveredEntityId)
        if (fertilizer) {
          requestDelete(
            { b_id: field.b_id, kind: "fertilizer", p_app_id: fertilizer.p_app_id },
            "deze bemesting",
          )
          return
        }
        const harvest = field.harvests.find((h) => h.b_id_harvesting === hoveredEntityId)
        if (harvest) {
          requestDelete(
            {
              b_id: field.b_id,
              b_id_harvesting: harvest.b_id_harvesting,
              b_lu: harvest.b_lu,
              kind: "harvest",
            },
            "deze oogst",
          )
          return
        }
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [canModify, hoveredEntityId, fields])

  const editing: TimelineEditing = {
    canModify,
    hoveredEntityId,
    onEditHarvest,
    onSheetRequest,
    requestDelete,
    setHoveredEntityId,
    submitCultivationMove,
    submitFertilizerDate,
    submitHarvestDate,
  }

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

  const openCultivationEndAt = TIMELINE_END_DATE

  // Precompute each field's features once (reused for the timeline row) and its resulting
  // sub-row count, so we can give `GanttTimeline` an explicit total height below.
  const fieldsWithFeatures = visibleFields.map((field) => {
    const { cultivationFeatures, pointFeatures } = buildFieldFeatures(
      field,
      filters,
      fertilizerTypeById,
      b_id_farm,
      calendar,
      openCultivationEndAt,
    )
    const features = [...cultivationFeatures, ...pointFeatures]
    const maxSubRows = computeGanttSubRowCount(features)
    return { field, features, maxSubRows }
  })

  const handlePointMove = (id: string, startAt: Date) => {
    if (id.startsWith("fertilizer-")) {
      submitFertilizerDate(id.slice("fertilizer-".length), startAt)
    } else if (id.startsWith("harvest-")) {
      submitHarvestDate(id.slice("harvest-".length), startAt)
    }
  }

  const handleCultivationMove = (id: string, startAt: Date, endAt: Date | null) => {
    if (!id.startsWith("cultivation-")) return
    const b_lu = id.slice("cultivation-".length)
    const cultivation = fields.flatMap((field) => field.cultivations).find((c) => c.b_lu === b_lu)
    const field = fields.find((f) => f.cultivations.some((c) => c.b_lu === b_lu))
    if (!cultivation || !field) return
    const clampedStart =
      startAt < new Date(TIMELINE_START_YEAR, 0, 1) ? new Date(TIMELINE_START_YEAR, 0, 1) : startAt
    const clampedEnd = endAt && endAt > openCultivationEndAt ? openCultivationEndAt : endAt
    const wasOpenEnded = cultivation.b_lu_end === null
    const originalStart = cultivation.b_lu_start ?? clampedStart
    const deltaStartMs = clampedStart.getTime() - originalStart.getTime()
    const originalEnd = cultivation.b_lu_end ?? openCultivationEndAt
    const deltaEndMs = (clampedEnd ?? openCultivationEndAt).getTime() - originalEnd.getTime()
    const isWholeBarMove = Math.abs(deltaEndMs - deltaStartMs) < 24 * 60 * 60 * 1000
    const nextEnd = wasOpenEnded && isWholeBarMove ? null : clampedEnd
    submitCultivationMove(field.b_id, b_lu, clampedStart, nextEnd)
  }

  const handleFeatureMove = (id: string, startAt: Date, endAt: Date | null) => {
    if (id.startsWith("cultivation-")) {
      handleCultivationMove(id, startAt, endAt)
    } else {
      handlePointMove(id, startAt)
    }
  }

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
          key={ganttChartId}
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
              {fieldsWithFeatures.map(({ features, field }) => (
                <GanttFeatureListGroup key={field.b_id} className="relative">
                  {onRequestAddEvent ? (
                    <RowClickCatcher
                      onPick={(date) => onRequestAddEvent({ b_id: field.b_id, date })}
                    />
                  ) : null}
                  <GanttFeatureRow
                    features={features}
                    onMove={canModify ? handleFeatureMove : undefined}
                  >
                    {(feature) => (
                      <FeatureContent
                        editing={editing}
                        feature={feature as TimelineFeature}
                        range={range}
                      />
                    )}
                  </GanttFeatureRow>
                </GanttFeatureListGroup>
              ))}
            </GanttFeatureList>
            <GanttToday />
          </GanttTimeline>
        </GanttProvider>
      </div>
      <AlertDialog
        onOpenChange={(open) => !open && setPendingDelete(null)}
        open={pendingDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Weet je zeker dat je ${pendingDelete.label} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
})
