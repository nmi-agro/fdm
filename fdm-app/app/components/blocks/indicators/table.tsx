import { TriangleAlert } from "lucide-react"
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
} from "@tanstack/react-table"
import { NavLink } from "react-router"
import { useMemo } from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import {
    INDICATOR_CATEGORIES,
    INDICATORS,
    scoreToDisplay,
    type IndicatorCategory,
    type IndicatorInfo,
} from "~/lib/indicators"
import type { FieldBln3Score } from "~/integrations/bln3.server"
import { HeatmapCell } from "./table-cell"
import { cn } from "~/lib/utils"

type FieldRow = {
    b_id: string
    b_name: string | null | undefined
    scores: Record<string, { score01: number; index01: number } | undefined>
}

const CATEGORY_TEXT: Record<IndicatorCategory, string> = {
    Biologisch:       "text-amber-600 dark:text-amber-400",
    Chemisch:         "text-blue-600 dark:text-blue-400",
    Fysisch:          "text-stone-600 dark:text-stone-400",
    Grondwater:       "text-cyan-600 dark:text-cyan-400",
    "Nutriënten":     "text-green-600 dark:text-green-400",
    Oppervlaktewater: "text-sky-600 dark:text-sky-400",
}

const CATEGORY_BORDER: Record<IndicatorCategory, string> = {
    Biologisch:       "border-b-amber-400",
    Chemisch:         "border-b-blue-400",
    Fysisch:          "border-b-stone-400",
    Grondwater:       "border-b-cyan-400",
    "Nutriënten":     "border-b-green-400",
    Oppervlaktewater: "border-b-sky-400",
}

type HeatmapTableProps = {
    fields: { b_id: string; b_name: string | null | undefined }[]
    fieldScores: FieldBln3Score[]
    activeCategory: IndicatorCategory | null
    showIndex: boolean
    basePath: string
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
    activeCategory,
    showIndex,
    basePath,
    onIndicatorClick,
    selectedIndicatorId,
}: HeatmapTableProps) {
    // Build per-field score rows
    const data = useMemo<FieldRow[]>(() => {
        return fields.map((field) => {
            const fs = fieldScores.find((s) => s.b_id === field.b_id)
            const scores: FieldRow["scores"] = {}
            if (fs?.score) {
                for (const ind of fs.score.indicators) {
                    scores[ind.indicator_id] = {
                        score01: ind.score,
                        index01: ind.index,
                    }
                }
            }
            return { b_id: field.b_id, b_name: field.b_name, scores }
        })
    }, [fields, fieldScores])

    // Column definitions: field column + one group per category
    const columns = useMemo<ColumnDef<FieldRow>[]>(() => {
        const fieldCol: ColumnDef<FieldRow> = {
            id: "field",
            accessorKey: "b_name",
            header: "Perceel",
            cell: ({ row }) => (
                <NavLink
                    to={`${basePath}/${row.original.b_id}`}
                    className="hover:underline font-medium"
                >
                    {row.original.b_name ?? row.original.b_id}
                </NavLink>
            ),
        }

        const categories = activeCategory ? [activeCategory] : INDICATOR_CATEGORIES
        const groups: ColumnDef<FieldRow>[] = categories.map((cat) => ({
            id: cat,
            header: cat,
            columns: INDICATORS.filter((i) => i.category === cat).map(
                (ind: IndicatorInfo) => ({
                    id: ind.id,
                    // Rotated indicator name header — full name always visible via tooltip
                    header: () => (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span
                                    className="vertical-header text-[11px] font-medium text-foreground cursor-default"
                                >
                                    {ind.name}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[220px] text-xs">
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

        return [fieldCol, ...groups]
    }, [activeCategory, showIndex, basePath])

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    // Always 2 header groups: [category group row, indicator name row]
    const [categoryGroupRow, indicatorNameRow] = table.getHeaderGroups()

    // Indicator leaf columns (excluding the field column) for the painpoint row
    const indicatorLeafHeaders = indicatorNameRow.headers.filter(
        (h) => h.column.id !== "field",
    )

    // Painpoint counts: number of fields with display score <40 per indicator
    const painpointCounts = useMemo(() => {
        const counts = new Map<string, number>()
        const indicators = activeCategory
            ? INDICATORS.filter((i) => i.category === activeCategory)
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
    }, [data, activeCategory, showIndex])

    const hasPainpoints = [...painpointCounts.values()].some((c) => c > 0)

    // Shared cell class strings
    const thBase = "bg-background px-1 text-xs font-medium text-muted-foreground border-b border-border"
    const tdBase = "text-center px-1 py-2 border-b border-border"
    const stickyCol = "sticky left-0 z-10 bg-background"
    const stickyCorner = "sticky left-0 z-30 bg-background"

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
                                const cat = header.column.id as IndicatorCategory
                                return (
                                    <th
                                        key={header.id}
                                        colSpan={header.colSpan}
                                        className={cn(
                                            thBase,
                                            "text-center py-1.5 h-8 border-l border-border border-b-2",
                                            CATEGORY_TEXT[cat],
                                            CATEGORY_BORDER[cat],
                                        )}
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext(),
                                        )}
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
                                return (
                                    <th
                                        key={header.id}
                                        className={cn(
                                            thBase,
                                            "h-36 w-12 min-w-[48px] pb-2 align-bottom overflow-hidden",
                                            onIndicatorClick && "cursor-pointer hover:bg-muted/40",
                                            selectedIndicatorId === header.column.id &&
                                                "bg-muted/60 ring-2 ring-inset ring-primary/50",
                                        )}
                                        onClick={() =>
                                            onIndicatorClick?.(
                                                selectedIndicatorId === header.column.id
                                                    ? null
                                                    : header.column.id,
                                            )
                                        }
                                    >
                                        <div className="flex justify-center items-end h-full overflow-hidden">
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext(),
                                            )}
                                        </div>
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {/* Painpoint row — always first */}
                        {hasPainpoints && (
                            <tr>
                                <td
                                    className={cn(
                                        stickyCol,
                                        "px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400 border-b-2 border-r border-border",
                                    )}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                                        Knelpunten
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
                        )}

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
                                    return (
                                        <td
                                            key={cell.id}
                                            className={tdBase}
                                        >
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
