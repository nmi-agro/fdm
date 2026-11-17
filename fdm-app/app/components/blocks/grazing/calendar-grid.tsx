import { cn } from "cn"
import { AlertTriangle } from "lucide-react"
import { useState } from "react"
import type {
  GrazingCalendarCell,
  GrazingCalendarFieldRow,
  GrazingCalendarMatrix,
} from "~/lib/grazing-calendar.server"
import { TooltipProvider } from "~/components/ui/tooltip"
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
}

export function CalendarGrid({ matrix, b_id_farm, calendar, canWrite = true }: CalendarGridProps) {
  const [selectedKoppelId, setSelectedKoppelId] = useState(matrix.herds[0]?.l_id_herd ?? "")

  // Drag-to-paint state
  const [isDragging, setIsDragging] = useState(false)
  const [dragField, setDragField] = useState<GrazingCalendarFieldRow | null>(null)
  const [dragStartWeek, setDragStartWeek] = useState<number | null>(null)
  const [dragEndWeek, setDragEndWeek] = useState<number | null>(null)

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
      setPopoverExistingGrazing(null)
      setPopoverStartDate(cell.dateStart)
      setPopoverEndDate(cell.dateEnd)
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

      const startCell = dragField.weeks[minW]
      const endCell = dragField.weeks[maxW]

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
              <span className="inline-block h-3.5 w-4 rounded-xs border border-amber-600/40 bg-amber-500/30" />
              <span>Maaien</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="bg-muted/40 inline-block h-3.5 w-4 rounded-xs border border-slate-300 dark:border-slate-700" />
              <span>Rust</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-4 rounded-xs border border-dashed border-emerald-500/50 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(16,185,129,0.2)_2px,rgba(16,185,129,0.2)_4px)] opacity-70" />
              <span>Gepland</span>
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="bg-card relative overflow-x-auto rounded-xl border shadow-xs">
          <table className="w-full border-collapse text-left text-xs" role="grid">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b font-medium">
                <th className="bg-muted/90 sticky left-0 z-20 min-w-44 p-3 backdrop-blur-xs">
                  Perceel
                </th>
                <th className="w-16 p-3 text-right">ha</th>
                {/* 52 weeks headers, rendered by month groups */}
                {Array.from({ length: 52 }, (_, i) => i + 1).map((weekNum) => (
                  <th
                    key={weekNum}
                    className={cn(
                      "border-border/40 min-w-8 border-l p-1.5 text-center text-[11px] font-normal",
                      weekNum % 4 === 1 && "border-l-border text-foreground font-semibold",
                    )}
                  >
                    {weekNum}
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

                  {field.weeks.map((cell, wIdx) => {
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
                          wIdx % 4 === 0 && "border-l-border",
                        )}
                        onMouseDown={() => handleMouseDown(field, wIdx)}
                        onMouseEnter={() => handleMouseEnter(wIdx)}
                        onClick={() => handleCellClick(field, cell)}
                        role="gridcell"
                        aria-label={`${field.b_name}, week ${wIdx + 1}, ${cell.type}`}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-full items-center justify-center rounded-xs text-[10px] transition-all",
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
                          {cell.type === "weiden" && (cell.isPlanned ? "▨ gepl." : "▨")}
                          {cell.type === "maaien" && "▤"}
                          {cell.type === "mixed" && "▨▤"}
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
