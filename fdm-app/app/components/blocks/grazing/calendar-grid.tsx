import { cn } from "cn"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { AlertTriangle, Info, Plus } from "lucide-react"
import { memo, useImperativeHandle, useMemo, useRef, useState } from "react"
import { NavLink } from "react-router"
import type { FertilizerKind } from "~/components/blocks/fertilizer/utils"
import type { AddEventSheetRequest } from "~/components/blocks/timeline/add-event-types"
import type {
  GrazingCalendarCell,
  GrazingCalendarFieldRow,
  GrazingCalendarMatrix,
} from "~/lib/grazing-calendar.server"
import { FERTILIZER_CATEGORY_SOLID_CLASSES } from "~/components/custom/fertilizer-badge"
import { Button } from "~/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useToday } from "~/hooks/use-today"
import {
  formatRestAlert,
  GRAZING_SEASON_LABEL,
  GRAZING_USE_COLORS,
  MIXED_USE_BACKGROUND,
  PLANNED_GRAZING_BACKGROUND,
  type RestAlert,
} from "~/lib/grazing-status"
import { GrazingPopover, type GrazingPopoverProps } from "./grazing-popover"

const HERD_COLORS = [
  "bg-emerald-600 text-white dark:bg-emerald-500",
  "bg-blue-600 text-white dark:bg-blue-500",
  "bg-amber-600 text-white dark:bg-amber-500",
  "bg-purple-600 text-white dark:bg-purple-500",
  "bg-rose-600 text-white dark:bg-rose-500",
  "bg-cyan-600 text-white dark:bg-cyan-500",
]

/** Days a Page Up or Page Down moves in the calendar. */
const PAGE_DAYS = 7

const formatLongDay = (day: string) =>
  format(new Date(`${day}T12:00:00`), "EEEE d MMMM", { locale: nl })

const formatHa = (value: number) => value.toLocaleString("nl-NL", { maximumFractionDigits: 2 })

/** A position in the calendar: the index of the field row and of the day column. */
interface GridPosition {
  row: number
  col: number
}

export interface CalendarGridProps {
  matrix: GrazingCalendarMatrix
  b_id_farm: string
  calendar: string
  canWrite?: boolean
  /** Opens the form to add, change or remove a mowing or fertilizer application. */
  onSheetRequest?: (request: AddEventSheetRequest) => void
  /** Buttons for the toolbar, next to the herds: other views and adding. */
  actions?: React.ReactNode
}

/**
 * Every day of the grazing season per grassland field, in narrow columns that scroll sideways on a
 * smaller screen.
 *
 * - A left click on an empty day adds a grazing on that day; dragging over several days adds a
 *   longer period. A click on a day with a grazing, mowing or fertilizer application opens it.
 * - A right click on a day offers to add a grazing, a mowing or a fertilizer application there.
 * - With the keyboard, the arrow keys move between days and fields, Enter or Space opens the day,
 *   and Shift with the left or right arrow selects several days for one grazing.
 */
export function CalendarGrid({
  matrix,
  b_id_farm,
  calendar,
  canWrite = true,
  onSheetRequest,
  actions,
}: CalendarGridProps) {
  const [selectedKoppelId, setSelectedKoppelId] = useState(matrix.herds[0]?.l_id_herd ?? "")

  // Drag-to-paint state: the row of the field and the first and current day
  const [isDragging, setIsDragging] = useState(false)
  const [dragRow, setDragRow] = useState<number | null>(null)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)
  const dragField = dragRow !== null ? matrix.fields[dragRow] : undefined

  // The long date of each day, formatted once instead of in every cell on every render
  const dayLabels = useMemo(
    () => matrix.columns.map((column) => formatLongDay(column.dateStart)),
    [matrix.columns],
  )

  // The day that was right-clicked, for the context menu
  const [menuTarget, setMenuTarget] = useState<{
    field: GrazingCalendarFieldRow
    day: string
  } | null>(null)

  // "Today" is only known on the client; empty until then
  const todayDate = useToday()
  const todayKey = todayDate ? format(todayDate, "yyyy-MM-dd") : ""
  const todayIndex = matrix.columns.findIndex((column) => column.dateStart === todayKey)

  // Keyboard: the one day that is in the tab order, and the first day of a Shift-selection
  const tableRef = useRef<HTMLTableElement>(null)
  // The scrolling box of the calendar, and the one tooltip that follows the day under the pointer
  const scrollRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<CalendarDayTooltipHandle>(null)
  const [focusedCell, setFocusedCell] = useState<GridPosition | null>(null)
  const [keyboardAnchor, setKeyboardAnchor] = useState<GridPosition | null>(null)
  const activeCell = focusedCell ?? { row: 0, col: Math.max(0, todayIndex) }

  // Popover state
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverField, setPopoverField] = useState<{
    b_id: string
    b_name: string
    b_area: number
  } | null>(null)
  const [popoverStartDate, setPopoverStartDate] = useState<string | undefined>(undefined)
  const [popoverEndDate, setPopoverEndDate] = useState<string | undefined>(undefined)
  const [popoverExistingGrazing, setPopoverExistingGrazing] =
    useState<GrazingPopoverProps["existingGrazing"]>(null)

  // Bumped on every open so the popover remounts and starts from the clicked day's values.
  const [popoverSession, setPopoverSession] = useState(0)

  /** Opens the grazing dialog for a new grazing on the field, from `start` up to `end`. */
  const openNewGrazing = (field: GrazingCalendarFieldRow, start: string, end: string) => {
    setPopoverSession((s) => s + 1)
    setPopoverField({ b_id: field.b_id, b_name: field.b_name, b_area: field.b_area })
    setPopoverExistingGrazing(null)
    setPopoverStartDate(start)
    setPopoverEndDate(end)
    setPopoverOpen(true)
  }

  const handleCellClick = (field: GrazingCalendarFieldRow, cell: GrazingCalendarCell) => {
    const grazing = cell.grazingEntries?.[0]
    if (grazing) {
      // Edit the grazing with its own dates, not those of the day that was clicked
      setPopoverSession((s) => s + 1)
      setPopoverField({ b_id: field.b_id, b_name: field.b_name, b_area: field.b_area })
      setPopoverExistingGrazing({
        l_id_grazing: grazing.l_id_grazing,
        l_id_herd: grazing.l_id_herd,
        l_grazing_start: grazing.l_grazing_start,
        l_grazing_end: grazing.l_grazing_end,
        l_grazing_hours: grazing.l_grazing_hours,
        l_grazing_area: grazing.l_grazing_area,
        l_grazing_geometry_zone: grazing.l_grazing_geometry_zone,
      })
      setPopoverStartDate(grazing.l_grazing_start)
      // A grazing that still runs has no end date, so saving it keeps it running
      setPopoverEndDate(grazing.l_grazing_end ?? undefined)
      setPopoverOpen(true)
      return
    }

    // A day with mowing or fertilizing opens that item to change or remove it
    const harvest = cell.harvestEntries?.[0]
    const fertilizer = cell.fertilizerEntries?.[0]
    if (onSheetRequest && canWrite && harvest) {
      onSheetRequest({
        type: "harvest-edit",
        context: { b_id: field.b_id, b_lu: harvest.b_lu, b_id_harvesting: harvest.b_id_harvesting },
      })
      return
    }
    if (onSheetRequest && canWrite && fertilizer) {
      onSheetRequest({
        type: "fertilizer-edit",
        context: { b_id: field.b_id, p_app_id: fertilizer.p_app_id },
      })
      return
    }

    if (canWrite) openNewGrazing(field, cell.dateStart, cell.dateEnd)
  }

  const handleMouseDown = (event: React.MouseEvent, row: number, col: number) => {
    // Only the left button paints; a right click opens the context menu
    if (!canWrite || event.button !== 0) return
    setIsDragging(true)
    setDragRow(row)
    setDragStart(col)
    setDragEnd(col)
  }

  const handleMouseUp = () => {
    // A drag over more than one day adds a grazing for that period; a single day is a click
    if (
      isDragging &&
      dragField &&
      dragStart !== null &&
      dragEnd !== null &&
      dragStart !== dragEnd
    ) {
      const startCell = dragField.cells[Math.min(dragStart, dragEnd)]
      const endCell = dragField.cells[Math.max(dragStart, dragEnd)]
      openNewGrazing(dragField, startCell.dateStart, endCell.dateEnd)
    }
    setIsDragging(false)
    setDragRow(null)
    setDragStart(null)
    setDragEnd(null)
  }

  /**
   * Shows the shared tooltip at a day: the date and what happened, the days of a drag or
   * Shift-selection, and what a click does.
   */
  const showDayTooltip = (target: HTMLElement) => {
    const [row, col] = (target.dataset.cell ?? "").split("-").map(Number)
    const field = matrix.fields[row]
    const cell = field?.cells[col]
    if (!field || !cell) return
    const anchorCol =
      isDragging && dragRow === row && dragStart !== null
        ? dragStart
        : keyboardAnchor?.row === row
          ? keyboardAnchor.col
          : null
    const firstCol = Math.min(anchorCol ?? col, col)
    const lastCol = Math.max(anchorCol ?? col, col)
    const details = dayCellTitle(cell)
    const action =
      cell.type === "empty" || anchorCol !== null
        ? canWrite
          ? "Klik om een beweiding toe te voegen"
          : null
        : "Klik om te openen"
    tooltipRef.current?.show(
      target,
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">
          {firstCol === lastCol
            ? dayLabels[col]
            : `${dayLabels[firstCol]} t/m ${dayLabels[lastCol]}`}
        </span>
        <span>{field.b_name}</span>
        {details && <span>{details}</span>}
        {action && <span className="opacity-80">{action}</span>}
      </span>,
    )
  }

  /** Moves the keyboard focus to a day, kept within the calendar. */
  const moveFocus = (row: number, col: number) => {
    const next = {
      row: Math.min(Math.max(row, 0), matrix.fields.length - 1),
      col: Math.min(Math.max(col, 0), matrix.columns.length - 1),
    }
    setFocusedCell(next)
    tableRef.current
      ?.querySelector<HTMLElement>(`[data-cell="${next.row}-${next.col}"]`)
      ?.focus({ preventScroll: false })
  }

  const handleGridKeyDown = (event: React.KeyboardEvent) => {
    const { row, col } = activeCell
    const field = matrix.fields[row]
    if (!field) return

    // Shift with left or right selects several days of one field; other keys end the selection
    const extend = event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")
    if (extend) {
      if (!canWrite) return
      event.preventDefault()
      if (!keyboardAnchor || keyboardAnchor.row !== row) setKeyboardAnchor({ row, col })
      moveFocus(row, col + (event.key === "ArrowRight" ? 1 : -1))
      return
    }

    const moves: Record<string, GridPosition> = {
      ArrowLeft: { row, col: col - 1 },
      ArrowRight: { row, col: col + 1 },
      ArrowUp: { row: row - 1, col },
      ArrowDown: { row: row + 1, col },
      Home: { row, col: 0 },
      End: { row, col: matrix.columns.length - 1 },
      PageUp: { row, col: col - PAGE_DAYS },
      PageDown: { row, col: col + PAGE_DAYS },
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      setKeyboardAnchor(null)
      moveFocus(move.row, move.col)
      return
    }

    if (event.key === "Escape" && keyboardAnchor) {
      event.preventDefault()
      setKeyboardAnchor(null)
      return
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (keyboardAnchor && keyboardAnchor.row === row && keyboardAnchor.col !== col) {
        const first = field.cells[Math.min(keyboardAnchor.col, col)]
        const last = field.cells[Math.max(keyboardAnchor.col, col)]
        setKeyboardAnchor(null)
        openNewGrazing(field, first.dateStart, last.dateEnd)
        return
      }
      setKeyboardAnchor(null)
      const cell = field.cells[col]
      if (cell) handleCellClick(field, cell)
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-4" onMouseUp={handleMouseUp}>
        {/* Toolbar: the herd to record for and the actions; below it the legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-medium">Koppels:</span>
            {matrix.herds.map((h) => (
              <button
                key={h.l_id_herd}
                type="button"
                aria-pressed={selectedKoppelId === h.l_id_herd}
                onClick={() => setSelectedKoppelId(h.l_id_herd)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 transition-all",
                  selectedKoppelId === h.l_id_herd
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted hover:bg-muted/80 text-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full",
                    HERD_COLORS[h.colorIndex % HERD_COLORS.length],
                  )}
                />
                <span>{h.l_herd_name}</span>
              </button>
            ))}
          </div>
          {actions}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-4 border-b pb-3 text-xs">
          <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <LegendItem label="Weiden">
              <span
                className="inline-block h-3.5 w-4 rounded-xs"
                style={{ backgroundColor: GRAZING_USE_COLORS.weiden }}
              />
            </LegendItem>
            <LegendItem label="Gepland">
              <span
                className="inline-block h-3.5 w-4 rounded-xs"
                style={{ background: PLANNED_GRAZING_BACKGROUND }}
              />
            </LegendItem>
            <LegendItem label="Maaien">
              <span
                className="inline-block h-3.5 w-4 rounded-xs"
                style={{ backgroundColor: GRAZING_USE_COLORS.maaien }}
              />
            </LegendItem>
            <LegendItem label="Dierlijke mest">
              <FertilizerDot kind="manure" />
            </LegendItem>
            <LegendItem label="Kunstmest">
              <FertilizerDot kind="mineral" />
            </LegendItem>
            <li>
              {/* How the calendar works, out of the way until asked for */}
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-foreground h-7 gap-1.5 text-xs"
                    />
                  }
                >
                  <Info aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Uitleg</span>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 space-y-2 text-xs">
                  <p>
                    Elke dag van {GRAZING_SEASON_LABEL}. Klik op een lege dag om een beweiding toe
                    te voegen, sleep over meerdere dagen voor een langere periode, of klik met de
                    rechtermuisknop voor maaien en bemesten.
                  </p>
                  <p>
                    Met het toetsenbord loop je met de pijltjestoetsen door de dagen en percelen,
                    open je een dag met Enter en kies je meerdere dagen met Shift en pijl links of
                    rechts.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => moveFocus(activeCell.row, activeCell.col)}
                  >
                    <span>
                      {todayIndex >= 0 ? "ga naar vandaag in de kalender" : "ga naar de kalender"}
                    </span>
                  </Button>
                </PopoverContent>
              </Popover>
            </li>
          </ul>
        </div>

        <p className="text-muted-foreground text-xs sm:hidden">
          De kalender is het best te gebruiken op een groter scherm. Hier schuif je opzij door de
          dagen, of voeg je beweiding toe met de knop Beweiding toevoegen.
        </p>

        {/* For keyboard users: appears on Tab and jumps straight into the calendar */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="sr-only text-xs focus-visible:not-sr-only"
          onClick={() => moveFocus(activeCell.row, activeCell.col)}
        >
          <span>{todayIndex >= 0 ? "ga naar vandaag in de kalender" : "ga naar de kalender"}</span>
        </Button>

        {/* Calendar: one narrow column per day; the context menu belongs to the right-clicked day */}
        <ContextMenu>
          <ContextMenuTrigger
            // A right click outside a day (a name or the header) has no day to add to
            onContextMenuCapture={() => setMenuTarget(null)}
            render={
              <div
                ref={scrollRef}
                className="bg-card relative overflow-x-auto rounded-xl border shadow-xs"
              />
            }
          >
            <table
              ref={tableRef}
              className="w-full border-collapse text-left text-xs"
              role="grid"
              aria-label="Beweidingskalender"
              // The days have no handlers of their own: the table handles their events, so a
              // row only re-renders when its own selection or focus changes
              onKeyDown={handleGridKeyDown}
              onMouseDown={(event) => {
                const day = dayFromEvent(event)
                if (day) handleMouseDown(event, day.row, day.col)
              }}
              onMouseOver={(event) => {
                const day = dayFromEvent(event)
                if (!day) return
                if (isDragging) setDragEnd(day.col)
                showDayTooltip(day.target)
              }}
              onClick={(event) => {
                const day = dayFromEvent(event)
                if (!day) return
                const field = matrix.fields[day.row]
                const cell = field?.cells[day.col]
                if (field && cell) handleCellClick(field, cell)
              }}
              onFocus={(event) => {
                const day = dayFromEvent(event)
                if (!day) return
                setFocusedCell({ row: day.row, col: day.col })
                showDayTooltip(day.target)
              }}
              onContextMenu={(event) => {
                const day = dayFromEvent(event)
                if (!day) return
                const field = matrix.fields[day.row]
                const cell = field?.cells[day.col]
                if (field && cell) setMenuTarget({ field, day: cell.dateStart })
              }}
              onMouseLeave={() => tooltipRef.current?.hide()}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) tooltipRef.current?.hide()
              }}
            >
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b font-medium">
                  <th className="bg-muted text-foreground sticky left-0 z-20 min-w-44 p-3">
                    Perceel
                  </th>
                  <th className="text-foreground w-16 p-3 text-right">ha</th>
                  {matrix.columns.map((column) => (
                    <th
                      key={column.key}
                      className={cn(
                        "relative h-9 w-1.5 min-w-1.5 p-0 text-xs font-normal",
                        column.groupStart &&
                          "border-l-border text-foreground border-l font-semibold",
                        column.dateStart === todayKey && "bg-primary/30",
                      )}
                    >
                      {/* The month name on the 1st overflows into the next days, which have none */}
                      <span className="absolute top-1/2 left-1 -translate-y-1/2 whitespace-nowrap">
                        {column.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-border/60 divide-y">
                {/* Grazed fields first, then the largest fields first (sorted by the loader) */}
                {matrix.fields.map((field, rowIndex) => {
                  // Only the row with the drag, the Shift-selection or the keyboard focus gets
                  // values here; every other row keeps its props and is skipped
                  const selection =
                    isDragging && dragRow === rowIndex && dragStart !== null && dragEnd !== null
                      ? { from: Math.min(dragStart, dragEnd), to: Math.max(dragStart, dragEnd) }
                      : keyboardAnchor?.row === rowIndex && activeCell.row === rowIndex
                        ? {
                            from: Math.min(keyboardAnchor.col, activeCell.col),
                            to: Math.max(keyboardAnchor.col, activeCell.col),
                          }
                        : null
                  return (
                    <CalendarRow
                      key={field.b_id}
                      field={field}
                      rowIndex={rowIndex}
                      columns={matrix.columns}
                      dayLabels={dayLabels}
                      selectionFrom={selection?.from ?? null}
                      selectionTo={selection?.to ?? null}
                      activeCol={activeCell.row === rowIndex ? activeCell.col : null}
                    />
                  )
                })}
              </tbody>
            </table>
            <CalendarDayTooltip ref={tooltipRef} containerRef={scrollRef} />
          </ContextMenuTrigger>
          <ContextMenuContent>
            {menuTarget ? (
              <ContextMenuGroup>
                <ContextMenuLabel>
                  {menuTarget.field.b_name} · {formatLongDay(menuTarget.day)}
                </ContextMenuLabel>
                <ContextMenuItem
                  disabled={!canWrite}
                  onClick={() => openNewGrazing(menuTarget.field, menuTarget.day, menuTarget.day)}
                >
                  <Plus />
                  Beweiding toevoegen
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={!canWrite || !onSheetRequest}
                  onClick={() =>
                    onSheetRequest?.({
                      type: "harvest",
                      context: {
                        b_id: menuTarget.field.b_id,
                        date: new Date(`${menuTarget.day}T12:00:00`),
                      },
                    })
                  }
                >
                  Maaisnede toevoegen
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={!canWrite || !onSheetRequest}
                  onClick={() =>
                    onSheetRequest?.({
                      type: "fertilizer",
                      context: {
                        b_id: menuTarget.field.b_id,
                        date: new Date(`${menuTarget.day}T12:00:00`),
                      },
                    })
                  }
                >
                  Bemesting toevoegen
                </ContextMenuItem>
              </ContextMenuGroup>
            ) : (
              <ContextMenuGroup>
                <ContextMenuLabel>Klik op een dag van een perceel</ContextMenuLabel>
              </ContextMenuGroup>
            )}
          </ContextMenuContent>
        </ContextMenu>

        {/* Season summary */}
        <div className="bg-card space-y-2 rounded-xl border p-4 shadow-xs">
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm">
            <div className="flex gap-1">
              <dt className="text-muted-foreground">Weidedagen:</dt>
              <dd className="text-foreground font-semibold tabular-nums">
                {matrix.summary.weidedagen.toLocaleString("nl-NL")}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted-foreground">Gemiddeld per weidedag:</dt>
              <dd className="text-foreground font-semibold tabular-nums">
                {matrix.summary.averageHours.toLocaleString("nl-NL")} uur
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted-foreground">Weidemelk 120 × 6:</dt>
              <dd className="text-foreground font-semibold tabular-nums">
                {matrix.summary.weidemelkDays >= 120
                  ? `${matrix.summary.weidemelkDays} van 120 dagen, gehaald`
                  : `${matrix.summary.weidemelkDays} van 120 dagen`}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted-foreground">Beweidingsplatform:</dt>
              <dd className="text-foreground font-semibold tabular-nums">
                {formatHa(matrix.summary.platformArea)} ha
                {matrix.summary.platformGvePerHa !== null && (
                  <span className="text-muted-foreground ml-1 font-normal">
                    · {matrix.summary.platformGvePerHa.toLocaleString("nl-NL")} GVE/ha op het
                    platform
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <RestAlertNotice
            alerts={matrix.summary.alerts}
            insightsHref={`/farm/${b_id_farm}/${calendar}/livestock/grazing/insights`}
          />
        </div>
      </div>

      <GrazingPopover
        key={popoverSession}
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        b_id_farm={b_id_farm}
        calendar={calendar}
        field={popoverField}
        initialHerdId={selectedKoppelId}
        initialStartDate={popoverStartDate}
        initialEndDate={popoverEndDate}
        existingGrazing={popoverExistingGrazing}
        herds={matrix.herds}
        canWrite={canWrite}
      />
    </TooltipProvider>
  )
}

/**
 * A one-line notice for the fields used again before the rest guideline: the first field, how many
 * more, and a link to the Kengetallen page that explains the guideline.
 */
export function RestAlertNotice({
  alerts,
  insightsHref,
}: {
  alerts: RestAlert[]
  insightsHref: string
}) {
  if (alerts.length === 0) return null
  const more = alerts.length - 1
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-900">
      <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-700" />
      <p className="font-medium">
        {formatRestAlert(alerts[0])}
        {more > 0 && ` En ${more} ${more === 1 ? "ander perceel" : "andere percelen"}.`}
      </p>
      <NavLink to={insightsHref} className="underline underline-offset-2">
        Bekijk de rustperiodes
      </NavLink>
    </div>
  )
}

/** The day an event in the calendar happened on: its cell and its row and column. */
function dayFromEvent(
  event: React.SyntheticEvent,
): (GridPosition & { target: HTMLElement }) | null {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-cell]")
  if (!target) return null
  const [row, col] = (target.dataset.cell ?? "").split("-").map(Number)
  return { row, col, target }
}

/**
 * A field in the calendar: its name, area and one cell per day. Memoized, because a calendar has
 * thousands of days: a drag or a key press only re-renders the row whose selection or focus
 * changes. The events of the days are handled by the table.
 */
const CalendarRow = memo(function CalendarRow({
  field,
  rowIndex,
  columns,
  dayLabels,
  selectionFrom,
  selectionTo,
  activeCol,
}: {
  field: GrazingCalendarFieldRow
  rowIndex: number
  columns: GrazingCalendarMatrix["columns"]
  /** The long date of each column. */
  dayLabels: string[]
  /** The first and last day of the drag or Shift-selection on this field, if any. */
  selectionFrom: number | null
  selectionTo: number | null
  /** The day with the keyboard focus on this field, if any. */
  activeCol: number | null
}) {
  return (
    <tr className="hover:bg-muted/20">
      <th
        scope="row"
        className="bg-card sticky left-0 z-10 border-r px-3 py-2 text-left font-medium"
      >
        <div className="max-w-40 truncate">{field.b_name}</div>
        {field.recentRestDays !== null && (
          <div className="text-muted-foreground text-xs font-normal">
            {field.recentRestDays === 1 ? "1 dag rust" : `${field.recentRestDays} dagen rust`}
          </div>
        )}
      </th>
      <td className="text-muted-foreground border-r px-2 py-2 text-right tabular-nums">
        {formatHa(field.b_area)}
      </td>

      {field.cells.map((cell, index) => {
        const isSelected =
          selectionFrom !== null &&
          selectionTo !== null &&
          index >= selectionFrom &&
          index <= selectionTo

        return (
          <td
            key={cell.key}
            data-cell={`${rowIndex}-${index}`}
            tabIndex={activeCol === index ? 0 : -1}
            className={cn(
              "relative h-8 w-1.5 min-w-1.5 cursor-pointer bg-clip-content p-0 py-0.5 transition-colors select-none",
              // A clear ring around the day that has the keyboard focus
              "focus-visible:ring-foreground focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none",
              cell.type === "empty" && "hover:bg-muted/60",
              isSelected && "bg-primary/30",
              columns[index]?.groupStart && "border-l-border border-l",
            )}
            style={dayCellStyle(cell)}
            role="gridcell"
            aria-selected={isSelected || undefined}
            aria-label={`${field.b_name}, ${dayLabels[index]}: ${dayCellDescription(cell)}`}
          >
            {cell.fertilizerEntries && (
              <FertilizerDot
                kind={cell.fertilizerEntries[0].p_type}
                className="absolute top-1 left-1/2 size-1.5 -translate-x-1/2"
              />
            )}
          </td>
        )
      })}
    </tr>
  )
})

/** Shows or hides the tooltip of the calendar at a day. */
interface CalendarDayTooltipHandle {
  show: (target: HTMLElement, content: React.ReactNode) => void
  hide: () => void
}

/**
 * The one tooltip of the calendar. A tooltip per day would add thousands of components, so an
 * invisible anchor moves to the day under the pointer or the keyboard focus, and the tooltip
 * opens there. Its state lives here, so moving it does not re-render the calendar.
 */
function CalendarDayTooltip({
  ref,
  containerRef,
}: {
  ref: React.Ref<CalendarDayTooltipHandle>
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [tip, setTip] = useState<{
    left: number
    top: number
    width: number
    height: number
    content: React.ReactNode
  } | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      show(target, content) {
        const container = containerRef.current
        if (!container) return
        const box = container.getBoundingClientRect()
        const rect = target.getBoundingClientRect()
        setTip({
          left: rect.left - box.left + container.scrollLeft,
          top: rect.top - box.top + container.scrollTop,
          width: rect.width,
          height: rect.height,
          content,
        })
      },
      hide() {
        setTip(null)
      },
    }),
    [containerRef],
  )

  return (
    // A new tooltip for every day: the positioner places itself when it opens, and does not follow
    // an anchor that moves. Without the entrance animation it simply jumps along.
    <Tooltip key={tip ? `${tip.left}-${tip.top}` : "hidden"} open={tip !== null}>
      <TooltipTrigger
        render={
          <span
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={
              tip
                ? { left: tip.left, top: tip.top, width: tip.width, height: tip.height }
                : { display: "none" }
            }
          />
        }
      />
      <TooltipContent className="data-open:animate-none data-[state=delayed-open]:animate-none">
        {tip?.content}
      </TooltipContent>
    </Tooltip>
  )
}

/** An entry of the calendar legend: a swatch and its label. */
function LegendItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="flex">
        {children}
      </span>
      <span>{label}</span>
    </li>
  )
}

/** A dot in the colour of the fertilizer badge of a kind: brown for manure, blue for mineral. */
function FertilizerDot({ kind, className }: { kind: FertilizerKind; className?: string }) {
  // The badge background is the first class of its solid style
  const background = (
    FERTILIZER_CATEGORY_SOLID_CLASSES[kind] ?? FERTILIZER_CATEGORY_SOLID_CLASSES.other
  ).split(" ")[0]
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full ring-1 ring-white",
        background,
        className,
      )}
    />
  )
}

/**
 * The background of a day: grazing, planned grazing, mowing, or both; nothing when unused. Only
 * the colour and image are set, so a cell's `background-clip` still applies.
 */
function dayCellStyle(cell: GrazingCalendarCell): React.CSSProperties | undefined {
  if (cell.type === "weiden") {
    return cell.isPlanned
      ? { backgroundImage: PLANNED_GRAZING_BACKGROUND }
      : { backgroundColor: GRAZING_USE_COLORS.weiden }
  }
  if (cell.type === "maaien") return { backgroundColor: GRAZING_USE_COLORS.maaien }
  if (cell.type === "mixed") return { backgroundImage: MIXED_USE_BACKGROUND }
  return undefined
}

/** What happened on a day, for the tooltip: the herds, the mowing and the fertilizers. */
function dayCellTitle(cell: GrazingCalendarCell): string {
  return [
    ...(cell.grazingEntries ?? []).map(
      (g) =>
        `${g.isPlanned ? "Gepland: " : ""}${g.l_herd_name}${
          g.l_grazing_hours ? `, ${g.l_grazing_hours.toLocaleString("nl-NL")} uur` : ""
        }`,
    ),
    ...(cell.harvestEntries ?? []).map(() => "Maaien"),
    ...(cell.fertilizerEntries ?? []).map(
      (f) =>
        `${f.p_name_nl ?? "Bemesting"}${
          f.p_app_amount_display != null
            ? ` ${f.p_app_amount_display.toLocaleString("nl-NL")} ${f.p_app_amount_unit}`
            : ""
        }`,
    ),
  ].join(", ")
}

/** What happened on a day in words, for screen readers. */
function dayCellDescription(cell: GrazingCalendarCell): string {
  const use =
    cell.type === "weiden"
      ? cell.isPlanned
        ? "beweiding gepland"
        : "beweid"
      : cell.type === "maaien"
        ? "gemaaid"
        : cell.type === "mixed"
          ? "beweid en gemaaid"
          : "niet gebruikt"
  const details = dayCellTitle(cell)
  return details ? `${use} (${details})` : use
}

/**
 * A day of the season: a narrow coloured bar for grazing (striped when planned), mowing, or both,
 * with a dot in the badge colour of a fertilizer application. The title lists what happened that
 * day.
 */
export function GrazingDayCell({ cell }: { cell: GrazingCalendarCell }) {
  const details = dayCellTitle(cell)
  const bar = (
    <div
      className={cn("relative h-7 w-full", cell.type === "empty" && "hover:bg-muted/60")}
      style={dayCellStyle(cell)}
    >
      <span className="sr-only">{dayCellDescription(cell)}</span>
      {cell.fertilizerEntries && (
        <FertilizerDot
          kind={cell.fertilizerEntries[0].p_type}
          className="absolute top-0.5 left-1/2 size-1.5 -translate-x-1/2"
        />
      )}
    </div>
  )
  // An empty day has nothing to tell; a used day names the date and what happened
  if (!details) return bar
  return (
    <Tooltip>
      <TooltipTrigger render={bar} />
      <TooltipContent>
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{formatLongDay(cell.dateStart)}</span>
          <span>{details}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
