import { cn } from "cn"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { AlertTriangle, ChevronLeft, ChevronRight, Shovel, Wheat } from "lucide-react"
import { type MouseEvent, useState } from "react"
import { useSearchParams } from "react-router"
import type { AddEventSheetRequest } from "~/components/blocks/timeline/add-event-types"
import type {
  GrazingCalendarCell,
  GrazingCalendarFieldRow,
  GrazingCalendarMatrix,
  GrazingCalendarView,
} from "~/lib/grazing-calendar.server"
import { Button } from "~/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { TooltipProvider } from "~/components/ui/tooltip"
import { useToday } from "~/hooks/use-today"
import { GrazingPopover, type GrazingPopoverProps } from "./grazing-popover"

const HERD_COLORS = [
  "bg-emerald-600 text-white dark:bg-emerald-500",
  "bg-blue-600 text-white dark:bg-blue-500",
  "bg-amber-600 text-white dark:bg-amber-500",
  "bg-purple-600 text-white dark:bg-purple-500",
  "bg-rose-600 text-white dark:bg-rose-500",
  "bg-cyan-600 text-white dark:bg-cyan-500",
]

export interface CalendarGridProps {
  matrix: GrazingCalendarMatrix
  b_id_farm: string
  calendar: string
  canWrite?: boolean
  /** Opens the form of a mowing or fertilizer application in the week, to change or remove it. */
  onSheetRequest?: (request: AddEventSheetRequest) => void
}

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
  const [dragStartWeek, setDragStartWeek] = useState<number | null>(null)
  const [dragEndWeek, setDragEndWeek] = useState<number | null>(null)

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

  // Bumped on every open so the popover remounts and starts from the clicked cell's values.
  const [popoverSession, setPopoverSession] = useState(0)

  const handleCellClick = (field: GrazingCalendarFieldRow, cell: GrazingCalendarCell) => {
    setPopoverSession((s) => s + 1)
    setPopoverField({ b_id: field.b_id, b_name: field.b_name, b_area: field.b_area })

    if (cell.grazingEntries && cell.grazingEntries.length > 0) {
      // Edit the grazing with its own dates, not those of the week that was clicked
      const g = cell.grazingEntries[0]
      setPopoverExistingGrazing({
        l_id_grazing: g.l_id_grazing,
        l_id_herd: g.l_id_herd,
        l_grazing_start: g.l_grazing_start,
        l_grazing_end: g.l_grazing_end,
        l_grazing_hours: g.l_grazing_hours,
        l_grazing_area: g.l_grazing_area,
        l_grazing_geometry_zone: g.l_grazing_geometry_zone,
      })
      setPopoverStartDate(g.l_grazing_start)
      // A grazing that still runs has no end date, so saving it keeps it running
      setPopoverEndDate(g.l_grazing_end ?? undefined)
    } else {
      // A new grazing covers one day: today when it falls in the clicked week, otherwise the first
      // day of the week (or the clicked day). Dragging over several cells records a longer period.
      const day = todayKey >= cell.dateStart && todayKey <= cell.dateEnd ? todayKey : cell.dateStart
      setPopoverExistingGrazing(null)
      setPopoverStartDate(day)
      setPopoverEndDate(day)
    }

    setPopoverOpen(true)
  }

  const handleMouseDown = (field: GrazingCalendarFieldRow, weekIndex: number) => {
    if (!canWrite) return
    setIsDragging(true)
    setDragField(field)
    setDragStartWeek(weekIndex)
    setDragEndWeek(weekIndex)
  }

  const handleMouseEnter = (weekIndex: number) => {
    if (isDragging && dragField) {
      setDragEndWeek(weekIndex)
    }
  }

  const handleMouseUp = () => {
    if (isDragging && dragField && dragStartWeek !== null && dragEndWeek !== null) {
      const minW = Math.min(dragStartWeek, dragEndWeek)
      const maxW = Math.max(dragStartWeek, dragEndWeek)

      const startCell = dragField.cells[minW]
      const endCell = dragField.cells[maxW]

      setPopoverSession((s) => s + 1)
      setPopoverField({ b_id: dragField.b_id, b_name: dragField.b_name, b_area: dragField.b_area })
      setPopoverExistingGrazing(null)
      setPopoverStartDate(startCell.dateStart)
      setPopoverEndDate(endCell.dateEnd)
      setPopoverOpen(true)
    }
    setIsDragging(false)
    setDragField(null)
    setDragStartWeek(null)
    setDragEndWeek(null)
  }

  return (
    <TooltipProvider>
      <div className="space-y-4" onMouseUp={handleMouseUp}>
        {/* Top toolbar: Koppels legend + Use Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 text-xs">
          {/* Herds filter/legend */}
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

          {/* Usage symbols legend */}
          <div className="text-muted-foreground flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-4 rounded-xs border border-emerald-600/40 bg-emerald-500/30" />
              <span>Weiden</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-3.5 w-4 items-center justify-center rounded-xs border border-amber-600/40 bg-amber-500/30">
                <Wheat className="size-2.5 text-amber-800" aria-hidden="true" />
              </span>
              <span>Maaien</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shovel className="size-3.5 text-sky-700" aria-hidden="true" />
              <span>Bemesten</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-4 rounded-xs border border-dashed border-emerald-500/50 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(16,185,129,0.2)_2px,rgba(16,185,129,0.2)_4px)] opacity-70" />
              <span>Gepland</span>
            </div>
          </div>
        </div>

        <CalendarViewSwitch view={matrix.view} year={matrix.year} />

        {/* Matrix Table */}
        <div className="bg-card relative overflow-x-auto rounded-xl border shadow-xs">
          <table className="w-full border-collapse text-left text-xs" role="grid">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b font-medium">
                <th className="bg-muted/90 sticky left-0 z-20 min-w-44 p-3 backdrop-blur-xs">
                  Perceel
                </th>
                <th className="w-16 p-3 text-right">ha</th>
                {/* Week numbers, or the days of the shown month */}
                {matrix.columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "border-border/40 min-w-8 border-l p-1.5 text-center text-[11px] font-normal",
                      column.groupStart && "border-l-border text-foreground font-semibold",
                      column.dateStart <= todayKey && todayKey <= column.dateEnd && "bg-primary/10",
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-border/60 divide-y">
              {/* Fields sorted by number of grazing days, then by name */}
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

                  {field.cells.map((cell, wIdx) => {
                    const isSelected =
                      isDragging &&
                      dragField?.b_id === field.b_id &&
                      dragStartWeek !== null &&
                      dragEndWeek !== null &&
                      wIdx >= Math.min(dragStartWeek, dragEndWeek) &&
                      wIdx <= Math.max(dragStartWeek, dragEndWeek)

                    return (
                      <td
                        key={cell.key}
                        className={cn(
                          "border-border/40 relative cursor-pointer border-l p-0.5 text-center transition-colors select-none",
                          isSelected && "bg-primary/30",
                          matrix.columns[wIdx]?.groupStart && "border-l-border",
                        )}
                        onMouseDown={() => handleMouseDown(field, wIdx)}
                        onMouseEnter={() => handleMouseEnter(wIdx)}
                        onClick={() => handleCellClick(field, cell)}
                        role="gridcell"
                        aria-label={`${field.b_name}, ${
                          matrix.view.kind === "day"
                            ? format(new Date(`${cell.dateStart}T12:00:00`), "d MMMM", {
                                locale: nl,
                              })
                            : `week ${cell.label}`
                        }, ${cell.type}`}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-full items-center justify-center gap-0.5 rounded-xs text-[10px] transition-all",
                            cell.type === "empty" && "hover:bg-muted/60",
                            cell.type === "weiden" &&
                              !cell.isPlanned &&
                              "border border-emerald-500/40 bg-emerald-500/25 font-medium text-emerald-950 dark:text-emerald-200",
                            cell.type === "weiden" &&
                              cell.isPlanned &&
                              "border border-dashed border-emerald-500/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(16,185,129,0.2)_2px,rgba(16,185,129,0.2)_4px)] font-normal text-emerald-800 opacity-75 dark:text-emerald-300",
                            cell.type === "maaien" &&
                              "border border-amber-500/40 bg-amber-500/25 font-medium text-amber-950 dark:text-amber-200",
                            cell.type === "mixed" &&
                              "border border-emerald-500/40 bg-gradient-to-r from-emerald-500/30 to-amber-500/30 font-semibold",
                          )}
                        >
                          {(cell.type === "weiden" || cell.type === "mixed") && (
                            <span>{cell.isPlanned ? "▨ gepl." : "▨"}</span>
                          )}
                          <CellEventMarkers
                            cell={cell}
                            b_id={field.b_id}
                            onSheetRequest={canWrite ? onSheetRequest : undefined}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

      {/* Popover */}
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

const formatDay = (day: string) => format(new Date(`${day}T12:00:00`), "d MMM", { locale: nl })

/**
 * Switches the calendar between the weeks of the year and the days of one month, with the
 * previous and next month in the day view. The view lives in the URL (`weergave`, `maand`), so the
 * loader builds the matching columns and a link keeps the view.
 */
function CalendarViewSwitch({ view, year }: { view: GrazingCalendarView; year: number }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const setView = (next: GrazingCalendarView) => {
    const params = new URLSearchParams(searchParams)
    if (next.kind === "day") {
      params.set("weergave", "dag")
      params.set("maand", String(next.month))
    } else {
      params.delete("weergave")
      params.delete("maand")
    }
    setSearchParams(params, { preventScrollReset: true })
  }
  const monthLabel = (month: number) =>
    format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: nl })
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        size="sm"
        variant="outline"
        value={[view.kind]}
        // Base UI sends an empty array when the active item is clicked again; keep the view then
        onValueChange={([value]) => {
          if (value === "week") setView({ kind: "week" })
          // The day view opens on the current month
          if (value === "day" && view.kind !== "day")
            setView({ kind: "day", month: new Date().getMonth() + 1 })
        }}
        aria-label="Weergave van de kalender"
      >
        <ToggleGroupItem value="week" className="px-3 text-xs">
          Week
        </ToggleGroupItem>
        <ToggleGroupItem value="day" className="px-3 text-xs">
          Dag
        </ToggleGroupItem>
      </ToggleGroup>
      {view.kind === "day" && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setView({ kind: "day", month: view.month - 1 })}
            disabled={view.month <= 1}
            aria-label="Vorige maand"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span key={view.month} className="min-w-32 text-center text-sm font-medium capitalize">
            {monthLabel(view.month)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setView({ kind: "day", month: view.month + 1 })}
            disabled={view.month >= 12}
            aria-label="Volgende maand"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Markers for the mowing and fertilizer applications in a week. With write permission they are
 * buttons that open the first item of the week to change or remove it; the label lists them all.
 * They stop the click and the drag of the cell, which records a grazing.
 */
function CellEventMarkers({
  cell,
  b_id,
  onSheetRequest,
}: {
  cell: GrazingCalendarCell
  b_id: string
  onSheetRequest?: (request: AddEventSheetRequest) => void
}) {
  const harvests = cell.harvestEntries ?? []
  const fertilizers = cell.fertilizerEntries ?? []
  if (harvests.length === 0 && fertilizers.length === 0) return null

  const harvestLabel = harvests.map((h) => `Maaien ${formatDay(h.harvestDate)}`).join(", ")
  const fertilizerLabel = fertilizers
    .map(
      (f) =>
        `${f.p_name_nl ?? "Bemesting"}${
          f.p_app_amount_display != null
            ? ` ${f.p_app_amount_display.toLocaleString("nl-NL")} ${f.p_app_amount_unit}`
            : ""
        } (${formatDay(f.p_app_date)})`,
    )
    .join(", ")

  const stop = (e: MouseEvent) => e.stopPropagation()
  const markerClassName =
    "inline-flex size-4 items-center justify-center rounded-xs pointer-coarse:size-6"

  return (
    <span className="flex items-center gap-px">
      {harvests.length > 0 &&
        (onSheetRequest ? (
          <button
            type="button"
            className={cn(markerClassName, "hover:bg-amber-500/30")}
            title={harvestLabel}
            aria-label={`${harvestLabel}: bewerken`}
            onMouseDown={stop}
            onClick={(e) => {
              stop(e)
              onSheetRequest({
                type: "harvest-edit",
                context: {
                  b_id,
                  b_lu: harvests[0].b_lu,
                  b_id_harvesting: harvests[0].b_id_harvesting,
                },
              })
            }}
          >
            <Wheat className="size-3 text-amber-800" aria-hidden="true" />
          </button>
        ) : (
          <span className={markerClassName} title={harvestLabel}>
            <Wheat className="size-3 text-amber-800" aria-label={harvestLabel} />
          </span>
        ))}
      {fertilizers.length > 0 &&
        (onSheetRequest ? (
          <button
            type="button"
            className={cn(markerClassName, "hover:bg-sky-500/20")}
            title={fertilizerLabel}
            aria-label={`${fertilizerLabel}: bewerken`}
            onMouseDown={stop}
            onClick={(e) => {
              stop(e)
              onSheetRequest({
                type: "fertilizer-edit",
                context: { b_id, p_app_id: fertilizers[0].p_app_id },
              })
            }}
          >
            <Shovel className="size-3 text-sky-700" aria-hidden="true" />
          </button>
        ) : (
          <span className={markerClassName} title={fertilizerLabel}>
            <Shovel className="size-3 text-sky-700" aria-label={fertilizerLabel} />
          </span>
        ))}
    </span>
  )
}
