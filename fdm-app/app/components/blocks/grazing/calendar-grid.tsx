import { cn } from "cn"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { AlertTriangle, Plus, Shovel, Wheat } from "lucide-react"
import { useState } from "react"
import type { FertilizerKind } from "~/components/blocks/fertilizer/utils"
import type { AddEventSheetRequest } from "~/components/blocks/timeline/add-event-types"
import type {
  GrazingCalendarCell,
  GrazingCalendarFieldRow,
  GrazingCalendarMatrix,
} from "~/lib/grazing-calendar.server"
import { FERTILIZER_CATEGORY_SOLID_CLASSES } from "~/components/custom/fertilizer-badge"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import { TooltipProvider } from "~/components/ui/tooltip"
import { useToday } from "~/hooks/use-today"
import { GrazingPopover, type GrazingPopoverProps } from "./grazing-popover"

/**
 * Colours of the calendar: light green for grazing, dark green for mowing. Fertilizer applications
 * take the colour of their fertilizer badge (see `FertilizerDot`).
 */
const GRAZING_FILL = "bg-green-300"
const PLANNED_GRAZING_FILL =
  "bg-[repeating-linear-gradient(45deg,rgba(134,239,172,0.35),rgba(134,239,172,0.35)_2px,rgba(134,239,172,1)_2px,rgba(134,239,172,1)_4px)]"
const MOWING_FILL = "bg-green-800"

const HERD_COLORS = [
  "bg-emerald-600 text-white dark:bg-emerald-500",
  "bg-blue-600 text-white dark:bg-blue-500",
  "bg-amber-600 text-white dark:bg-amber-500",
  "bg-purple-600 text-white dark:bg-purple-500",
  "bg-rose-600 text-white dark:bg-rose-500",
  "bg-cyan-600 text-white dark:bg-cyan-500",
]

const formatLongDay = (day: string) =>
  format(new Date(`${day}T12:00:00`), "EEEE d MMMM", { locale: nl })

export interface CalendarGridProps {
  matrix: GrazingCalendarMatrix
  b_id_farm: string
  calendar: string
  canWrite?: boolean
  /** Opens the form to add, change or remove a mowing or fertilizer application. */
  onSheetRequest?: (request: AddEventSheetRequest) => void
}

/**
 * Every day of the grazing season per grassland field, in narrow columns that scroll sideways on a
 * smaller screen.
 *
 * - A left click on an empty day adds a grazing on that day; dragging over several days adds a
 *   longer period. A click on a day with a grazing, mowing or fertilizer application opens it.
 * - A right click on a day offers to add a grazing, a mowing or a fertilizer application there.
 */
export function CalendarGrid({
  matrix,
  b_id_farm,
  calendar,
  canWrite = true,
  onSheetRequest,
}: CalendarGridProps) {
  const [selectedKoppelId, setSelectedKoppelId] = useState(matrix.herds[0]?.l_id_herd ?? "")

  // Drag-to-paint state
  const [isDragging, setIsDragging] = useState(false)
  const [dragField, setDragField] = useState<GrazingCalendarFieldRow | null>(null)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)

  // The day that was right-clicked, for the context menu
  const [menuTarget, setMenuTarget] = useState<{
    field: GrazingCalendarFieldRow
    day: string
  } | null>(null)

  // "Today" is only known on the client; empty until then
  const todayDate = useToday()
  const todayKey = todayDate ? format(todayDate, "yyyy-MM-dd") : ""

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

  const handleMouseDown = (
    event: React.MouseEvent,
    field: GrazingCalendarFieldRow,
    index: number,
  ) => {
    // Only the left button paints; a right click opens the context menu
    if (!canWrite || event.button !== 0) return
    setIsDragging(true)
    setDragField(field)
    setDragStart(index)
    setDragEnd(index)
  }

  const handleMouseEnter = (index: number) => {
    if (isDragging && dragField) {
      setDragEnd(index)
    }
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
    setDragField(null)
    setDragStart(null)
    setDragEnd(null)
  }

  return (
    <TooltipProvider>
      <div className="space-y-4" onMouseUp={handleMouseUp}>
        {/* Top toolbar: herds and legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-medium">Koppels:</span>
            {matrix.herds.map((h) => (
              <button
                key={h.l_id_herd}
                type="button"
                onClick={() => setSelectedKoppelId(h.l_id_herd)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 transition-all",
                  selectedKoppelId === h.l_id_herd
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted hover:bg-muted/80 text-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full",
                    HERD_COLORS[h.colorIndex % HERD_COLORS.length],
                  )}
                />
                <span>{h.l_herd_name}</span>
              </button>
            ))}
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className={cn("inline-block h-3.5 w-4 rounded-xs", GRAZING_FILL)} />
              <span>Weiden</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn("inline-block h-3.5 w-4 rounded-xs", MOWING_FILL)} />
              <span>Maaien</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FertilizerDot kind="manure" />
              <span>Dierlijke mest</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FertilizerDot kind="mineral" />
              <span>Kunstmest</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn("inline-block h-3.5 w-4 rounded-xs", PLANNED_GRAZING_FILL)} />
              <span>Gepland</span>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          Elke dag van 1 maart tot en met 31 oktober. Klik op een lege dag om een beweiding toe te
          voegen, of klik met de rechtermuisknop voor maaien en bemesten.
        </p>

        {/* Calendar: one narrow column per day; the context menu belongs to the right-clicked day */}
        <ContextMenu>
          <ContextMenuTrigger
            // A right click outside a day (a name or the header) has no day to add to
            onContextMenuCapture={() => setMenuTarget(null)}
            render={
              <div className="bg-card relative overflow-x-auto rounded-xl border shadow-xs" />
            }
          >
            <table className="w-full border-collapse text-left text-xs" role="grid">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b font-medium">
                  <th className="bg-muted/90 sticky left-0 z-20 min-w-44 p-3 backdrop-blur-xs">
                    Perceel
                  </th>
                  <th className="w-16 p-3 text-right">ha</th>
                  {matrix.columns.map((column) => (
                    <th
                      key={column.key}
                      className={cn(
                        "relative h-9 w-1.5 min-w-1.5 p-0 text-[10px] font-normal",
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
                {matrix.fields.map((field) => (
                  <tr key={field.b_id} className="hover:bg-muted/20">
                    <td className="bg-card/95 sticky left-0 z-10 border-r px-3 py-2 font-medium backdrop-blur-xs">
                      <div className="max-w-40 truncate">{field.b_name}</div>
                      {field.recentRestDays !== null && (
                        <div className="text-muted-foreground text-[10px]">
                          ░ {field.recentRestDays}d rust
                        </div>
                      )}
                    </td>
                    <td className="text-muted-foreground border-r px-2 py-2 text-right">
                      {field.b_area}
                    </td>

                    {field.cells.map((cell, index) => {
                      const isSelected =
                        isDragging &&
                        dragField?.b_id === field.b_id &&
                        dragStart !== null &&
                        dragEnd !== null &&
                        index >= Math.min(dragStart, dragEnd) &&
                        index <= Math.max(dragStart, dragEnd)

                      return (
                        <td
                          key={cell.key}
                          className={cn(
                            "relative w-1.5 min-w-1.5 cursor-pointer p-0 py-0.5 transition-colors select-none",
                            isSelected && "bg-primary/30",
                            matrix.columns[index]?.groupStart && "border-l-border border-l",
                          )}
                          onMouseDown={(event) => handleMouseDown(event, field, index)}
                          onMouseEnter={() => handleMouseEnter(index)}
                          onClick={() => handleCellClick(field, cell)}
                          onContextMenu={() => setMenuTarget({ field, day: cell.dateStart })}
                          role="gridcell"
                          aria-label={`${field.b_name}, ${formatLongDay(cell.dateStart)}, ${cell.type}`}
                        >
                          <GrazingDayCell cell={cell} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <Wheat />
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
                  <Shovel />
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

        {/* Season Summary Strip */}
        <div className="bg-card space-y-2 rounded-xl border p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-muted-foreground">Weidedagen: </span>
                <strong className="text-foreground font-semibold">
                  {matrix.summary.weidedagen} ●
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Weide-uren/dag: </span>
                <strong className="text-foreground font-semibold">
                  {matrix.summary.averageHours} ●
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Weidemelk 120×6: </span>
                <strong className="text-foreground font-semibold">
                  {matrix.summary.weidemelkDays}/120 dgn{" "}
                  {matrix.summary.weidemelkDays >= 120 ? "✓" : ""}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Beweidingsplatform: </span>
                <strong className="text-foreground font-semibold">
                  {matrix.summary.platformArea} ha
                </strong>
                {matrix.summary.platformGvePerHa !== null && (
                  <span className="text-muted-foreground ml-1">
                    · {matrix.summary.platformGvePerHa} GVE/ha
                  </span>
                )}
              </div>
            </div>
          </div>

          {matrix.summary.alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="font-medium">{matrix.summary.alerts[0].message}</p>
            </div>
          )}
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
 * A day of the season: a narrow coloured bar for grazing (light green, striped when planned) or
 * mowing (dark green), with a dot in the badge colour of a fertilizer application. The title lists
 * what happened that day.
 */
export function GrazingDayCell({ cell }: { cell: GrazingCalendarCell }) {
  const title = [
    ...(cell.grazingEntries ?? []).map(
      (g) =>
        `${g.isPlanned ? "Gepland: " : ""}${g.l_herd_name}${
          g.l_grazing_hours ? `, ${g.l_grazing_hours} uur` : ""
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

  return (
    <div
      title={title || undefined}
      className={cn(
        "relative h-7 w-full",
        cell.type === "empty" && "hover:bg-muted/60",
        cell.type === "weiden" && (cell.isPlanned ? PLANNED_GRAZING_FILL : GRAZING_FILL),
        cell.type === "maaien" && MOWING_FILL,
        cell.type === "mixed" && "bg-gradient-to-b from-green-300 to-green-800",
      )}
    >
      {cell.fertilizerEntries && (
        <FertilizerDot
          kind={cell.fertilizerEntries[0].p_type}
          className="absolute top-0.5 left-1/2 size-1.5 -translate-x-1/2"
        />
      )}
    </div>
  )
}
