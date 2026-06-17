import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { useMemo } from "react"
import { NavLink } from "react-router"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import type { FieldBln3Score } from "~/integrations/bln3.server"
import {
    ECOSYSTEEMDIENSTEN,
    type Ecosysteemdienst,
    INDICATORS,
    type IndicatorInfo,
    scoreToDisplay,
} from "~/lib/indicators"
import { cn } from "~/lib/utils"
import { HeatmapCell } from "./table-cell"

type FieldRow = {
    b_id: string
    b_name: string | null | undefined
    scores: Record<string, { score01: number; index01: number } | undefined>
    /** Number of indicators with display score <40 for this field */
    knelpuntCount: number
}

const CATEGORY_TEXT: Record<Ecosysteemdienst, string> = {
    Productie: "text-orange-600 dark:text-orange-400",
    Klimaat: "text-stone-600 dark:text-stone-400",
    Water: "text-blue-600 dark:text-blue-400",
    Nutriëntenkringloop: "text-violet-600 dark:text-violet-400",
}

const CATEGORY_BORDER: Record<Ecosysteemdienst, string> = {
    Productie: "border-b-orange-400",
    Klimaat: "border-b-stone-400",
    Water: "border-b-blue-400",
    Nutriëntenkringloop: "border-b-violet-400",
}

type HeatmapTableProps = {
    fields: { b_id: string; b_name: string | null | undefined }[]
    fieldScores: FieldBln3Score[]
    activeCategories: Ecosysteemdienst[]
    showIndex: boolean
    basePath?: string
    basePathFormatter?: (b_id: string) => string
    /** Called when the user clicks a column header to pin/unpin that indicator on the map. */
    onIndicatorClick?: (indicatorId: string | null) => void
    /** ID of the currently pinned indicator (highlights the column). */
    selectedIndicatorId?: string | null
}

/**
 * Heatmap table built with TanStack Table for column grouping.
 *
 * Rendered with a plain <table> (not the shadcn Table wrapper) so that a
 * single overflow-auto container handles both axes, making sticky headers
 * scroll correctly with horizontal scroll.
 */
export function HeatmapTable({
    fields,
    fieldScores,
    activeCategories,
    showIndex,
    basePath,
    basePathFormatter,
    onIndicatorClick,
    selectedIndicatorId,
}: HeatmapTableProps) {
    // Build per-field score rows
    const data = useMemo<FieldRow[]>(() => {
        const activeInds =
            activeCategories.length > 0
                ? INDICATORS.filter((i) =>
                      activeCategories.includes(i.ecosysteemdienst),
                  )
                : INDICATORS
        const scoreByBid = new Map(fieldScores.map((s) => [s.b_id, s]))
        return fields.map((field) => {
            const fs = scoreByBid.get(field.b_id)
            const scores: FieldRow["scores"] = {}
            if (fs?.score) {
                for (const ind of fs.score.indicators) {
                    scores[ind.indicator_id] = {
                        score01: ind.score,
                        index01: ind.index,
                    }
                }
            }
            let knelpuntCount = 0
            for (const ind of activeInds) {
                const vals = scores[ind.id]
                if (!vals) continue
                const active01 = showIndex ? vals.index01 : vals.score01
                if (scoreToDisplay(active01) < 40) knelpuntCount++
            }
            return {
                b_id: field.b_id,
                b_name: field.b_name,
                scores,
                knelpuntCount,
            }
        })
    }, [fields, fieldScores, activeCategories, showIndex])

    // Column definitions: field column + knelpunten summary column + one group per category
    const columns = useMemo<ColumnDef<FieldRow>[]>(() => {
        const fieldCol: ColumnDef<FieldRow> = {
            id: "field",
            accessorKey: "b_name",
            header: "Perceel",
            cell: ({ row }) => (
                <NavLink
                    to={
                        basePathFormatter
                            ? basePathFormatter(row.original.b_id)
                            : `${basePath}/${row.original.b_id}`
                    }
                    className="hover:underline font-medium"
                >
                    {row.original.b_name ?? row.original.b_id}
                </NavLink>
            ),
        }

        const knelpuntCol: ColumnDef<FieldRow> = {
            id: "knelpunten",
            header: () => (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="vertical-header text-[11px] font-medium cursor-default self-stretch text-red-700 dark:text-red-400">
                            Knelpunten
                        </span>
                    </TooltipTrigger>
                    <TooltipContent
                        side="right"
                        className="max-w-[220px] text-xs bg-popover text-popover-foreground border shadow-md"
                    >
                        Aantal knelpunten voor dit perceel
                    </TooltipContent>
                </Tooltip>
            ),
            cell: ({ row }) => {
                const count = row.original.knelpuntCount
                return count > 0 ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold">
                        {count}
                    </span>
                ) : null
            },
        }

        const categories =
            activeCategories.length > 0 ? activeCategories : ECOSYSTEEMDIENSTEN
        const groups: ColumnDef<FieldRow>[] = categories.map((cat) => ({
            id: cat,
            header: cat,
            columns: INDICATORS.filter((i) => i.ecosysteemdienst === cat).map(
                (ind: IndicatorInfo) => ({
                    id: ind.id,
                    // Rotated indicator name header — full name always visible via tooltip
                    header: () => (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="vertical-header text-[11px] font-medium text-foreground cursor-default self-stretch">
                                    {ind.name}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent
                                side="right"
                                className="max-w-[220px] text-xs bg-popover text-popover-foreground border shadow-md"
                            >
                                {ind.name}
                            </TooltipContent>
                        </Tooltip>
                    ),
                    cell: ({ row }: { row: { original: FieldRow } }) => {
                        const vals = row.original.scores[ind.id]
                        return (
                            <HeatmapCell
                                indicator={ind}
                                score01={vals?.score01 ?? null}
                                index01={vals?.index01 ?? null}
                                showIndex={showIndex}
                            />
                        )
                    },
                }),
            ),
        }))

        return [fieldCol, knelpuntCol, ...groups]
    }, [activeCategories, showIndex, basePath, basePathFormatter])

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    // Always 2 header groups: [category group row, indicator name row]
    const [categoryGroupRow, indicatorNameRow] = table.getHeaderGroups()

    // Indicator leaf columns (excluding field and knelpunten columns) for the painpoint row
    const indicatorLeafHeaders = indicatorNameRow.headers.filter(
        (h) => h.column.id !== "field" && h.column.id !== "knelpunten",
    )

    // Painpoint counts: number of fields with display score <40 per indicator
    const painpointCounts = useMemo(() => {
        const counts = new Map<string, number>()
        const indicators =
            activeCategories.length > 0
                ? INDICATORS.filter((i) =>
                      activeCategories.includes(i.ecosysteemdienst),
                  )
                : INDICATORS
        for (const ind of indicators) {
            let count = 0
            for (const row of data) {
                const vals = row.scores[ind.id]
                if (!vals) continue
                const active01 = showIndex ? vals.index01 : vals.score01
                if (scoreToDisplay(active01) < 40) count++
            }
            counts.set(ind.id, count)
        }
        return counts
    }, [data, activeCategories, showIndex])

    // Total knelpunten across all fields (for the crossing cell)
    const totalKnelpunten = useMemo(
        () => data.reduce((sum, r) => sum + r.knelpuntCount, 0),
        [data],
    )

    // Shared cell class strings
    const thBase =
        "bg-background px-1 text-xs font-medium text-muted-foreground border-b border-border"
    const tdBase = "text-center px-1 py-2 border-b border-border"
    const stickyCol = "sticky left-0 z-10 bg-background"
    const stickyCorner = "sticky left-0 z-30 bg-background"
    // Second sticky column — knelpunten summary (left offset = field column width 160px)
    const stickyKnelpunt = "sticky left-[160px] z-10 bg-background"
    const stickyKnelpuntCorner = "sticky left-[160px] z-30 bg-background"

    return (
        <TooltipProvider>
            {/*
             * Single overflow-auto container so sticky thead scrolls correctly
             * with horizontal scroll (placing sticky inside a single scroll root).
             */}
            <div className="w-full overflow-auto max-h-[75vh] rounded-md border">
                <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
                    <thead className="sticky top-0 z-20">
                        {/* Row 1: Category group labels (colSpan per group) */}
                        <tr>
                            {categoryGroupRow.headers.map((header) => {
                                if (header.isPlaceholder) {
                                    // field placeholder
                                    if (header.column.id === "field") {
                                        return (
                                            <th
                                                key={header.id}
                                                className={cn(
                                                    stickyCorner,
                                                    "w-[160px] min-w-[160px] px-3 py-1.5 border-b border-r border-border",
                                                )}
                                            />
                                        )
                                    }
                                    // knelpunten placeholder
                                    return (
                                        <th
                                            key={header.id}
                                            className={cn(
                                                stickyKnelpuntCorner,
                                                "w-12 min-w-[48px] px-1 py-1.5 border-b border-r border-border",
                                            )}
                                        />
                                    )
                                }
                                const cat = header.column.id as Ecosysteemdienst
                                return (
                                    <th
                                        key={header.id}
                                        colSpan={header.colSpan}
                                        className={cn(
                                            thBase,
                                            "text-center py-1.5 h-8 border-l border-border border-b-2 max-w-0",
                                            CATEGORY_TEXT[cat],
                                            CATEGORY_BORDER[cat],
                                        )}
                                    >
                                        <div
                                            className="truncate px-1"
                                            title={cat}
                                        >
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext(),
                                            )}
                                        </div>
                                    </th>
                                )
                            })}
                        </tr>

                        {/* Row 2: Rotated indicator names */}
                        <tr className="align-bottom">
                            {indicatorNameRow.headers.map((header) => {
                                if (header.column.id === "field") {
                                    return (
                                        <th
                                            key={header.id}
                                            className={cn(
                                                stickyCorner,
                                                "w-[160px] min-w-[160px] px-3 pb-2 text-left text-xs font-medium text-muted-foreground border-b border-r border-border",
                                            )}
                                        >
                                            Perceel
                                        </th>
                                    )
                                }
                                if (header.column.id === "knelpunten") {
                                    return (
                                        <th
                                            key={header.id}
                                            className={cn(
                                                stickyKnelpuntCorner,
                                                "w-12 min-w-[48px] px-1 pb-2 text-center border-b border-r border-border align-middle",
                                            )}
                                        >
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext(),
                                            )}
                                        </th>
                                    )
                                }
                                return (
                                    <th
                                        key={header.id}
                                        className={cn(
                                            thBase,
                                            "h-36 w-12 min-w-[48px] pb-2 align-bottom overflow-hidden",
                                        )}
                                    >
                                        {onIndicatorClick ? (
                                            <button
                                                type="button"
                                                className={cn(
                                                    "flex justify-center items-end h-full w-full overflow-hidden cursor-pointer hover:bg-muted/40",
                                                    selectedIndicatorId ===
                                                        header.column.id &&
                                                        "bg-muted/60 ring-2 ring-inset ring-primary/50",
                                                )}
                                                aria-pressed={
                                                    selectedIndicatorId ===
                                                    header.column.id
                                                }
                                                aria-label={`${selectedIndicatorId === header.column.id ? "Unpin" : "Pin"} indicator ${header.column.id}`}
                                                onClick={() =>
                                                    onIndicatorClick(
                                                        selectedIndicatorId ===
                                                            header.column.id
                                                            ? null
                                                            : header.column.id,
                                                    )
                                                }
                                            >
                                                {flexRender(
                                                    header.column.columnDef
                                                        .header,
                                                    header.getContext(),
                                                )}
                                            </button>
                                        ) : (
                                            <div className="flex justify-center items-end h-full overflow-hidden">
                                                {flexRender(
                                                    header.column.columnDef
                                                        .header,
                                                    header.getContext(),
                                                )}
                                            </div>
                                        )}
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {/* Painpoint row — always visible; crossing cell shows total */}
                        <tr>
                            <td
                                className={cn(
                                    stickyCol,
                                    "px-3 py-2 text-xs font-semibold border-b-2 border-r border-border",
                                    totalKnelpunten > 0
                                        ? "text-red-700 dark:text-red-400"
                                        : "text-green-700 dark:text-green-400",
                                )}
                            >
                                <span className="flex items-center gap-1.5">
                                    Knelpunten
                                </span>
                            </td>
                            {/* Crossing cell: total knelpunten across all fields */}
                            <td
                                className={cn(
                                    stickyKnelpunt,
                                    "text-center px-1 py-2 border-b-2 border-r border-border",
                                )}
                            >
                                <span
                                    className={cn(
                                        "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                                        totalKnelpunten > 0
                                            ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                                            : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400",
                                    )}
                                >
                                    {totalKnelpunten}
                                </span>
                            </td>
                            {indicatorLeafHeaders.map((header) => {
                                const count =
                                    painpointCounts.get(header.column.id) ?? 0
                                return (
                                    <td
                                        key={header.id}
                                        className={cn(tdBase, "border-b-2")}
                                    >
                                        {count > 0 ? (
                                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold">
                                                {count}
                                            </span>
                                        ) : null}
                                    </td>
                                )
                            })}
                        </tr>

                        {/* Data rows */}
                        {table.getRowModel().rows.map((row) => (
                            <tr
                                key={row.id}
                                className="hover:bg-muted/50 transition-colors"
                            >
                                {row.getVisibleCells().map((cell) => {
                                    if (cell.column.id === "field") {
                                        return (
                                            <td
                                                key={cell.id}
                                                className={cn(
                                                    stickyCol,
                                                    "px-3 py-2 border-b border-r border-border",
                                                )}
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext(),
                                                )}
                                            </td>
                                        )
                                    }
                                    if (cell.column.id === "knelpunten") {
                                        return (
                                            <td
                                                key={cell.id}
                                                className={cn(
                                                    stickyKnelpunt,
                                                    "text-center px-1 py-2 border-b border-r border-border",
                                                )}
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext(),
                                                )}
                                            </td>
                                        )
                                    }
                                    return (
                                        <td key={cell.id} className={tdBase}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </TooltipProvider>
    )
}
