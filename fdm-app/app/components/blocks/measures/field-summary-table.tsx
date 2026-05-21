/**
 * Table of per-field measure summaries on the farm measures overview page.
 *
 * Features:
 *  - Fuzzy search + buffer-strip toggle (shared via useFieldFilterStore)
 *  - Row selection with "Maatregel toevoegen" action button
 *  - Sortable columns (field name, cultivation, area, measure count)
 */
import {
    type ColumnDef,
    type RowSelectionState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    type SortingState,
    useReactTable,
} from "@tanstack/react-table"
import fuzzysort from "fuzzysort"
import { Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router"
import { FieldFilterToggle } from "~/components/custom/field-filter-toggle"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { useFieldFilterStore } from "~/store/field-filter"
import { cn } from "~/lib/utils"
import type { FieldSummaryRow } from "./field-summary-columns"

interface FieldSummaryTableProps {
    columns: ColumnDef<FieldSummaryRow>[]
    data: FieldSummaryRow[]
    onAddMeasure: (selectedFieldIds: string[]) => void
}

export function FieldSummaryTable({
    columns,
    data,
    onAddMeasure,
}: FieldSummaryTableProps) {
    const [sorting, setSorting] = useState<SortingState>([
        { id: "b_area", desc: true },
    ])
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

    const { b_id_farm } = useParams()
    const fieldFilter = useFieldFilterStore()

    useEffect(() => {
        if (b_id_farm) {
            fieldFilter.syncFarm(b_id_farm)
        }
    }, [b_id_farm, fieldFilter.syncFarm])

    const filteredData = useMemo(() => {
        let rows = data

        if (fieldFilter.showProductiveOnly) {
            rows = rows.filter((r) => !r.b_bufferstrip)
        }

        if (fieldFilter.searchTerms.trim()) {
            rows = rows.filter((r) => {
                const target = [
                    r.b_name ?? "",
                    r.mainCultivation?.b_lu_name ?? "",
                    ...r.measures.map((m) => m.m_name),
                ]
                    .filter(Boolean)
                    .join(" ")
                return (
                    fuzzysort.go(fieldFilter.searchTerms, [target]).length > 0
                )
            })
        }

        return rows
    }, [data, fieldFilter.searchTerms, fieldFilter.showProductiveOnly])

    const table = useReactTable({
        data: filteredData,
        columns,
        getRowId: (row) => row.b_id,
        state: { sorting, rowSelection },
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        enableRowSelection: true,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    })

    const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])
    const hasSelection = selectedIds.length > 0

    return (
        <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
                <Input
                    placeholder="Zoek perceel of maatregel…"
                    value={fieldFilter.searchTerms ?? ""}
                    onChange={(e) => fieldFilter.setSearchTerms(e.target.value)}
                    className="w-full sm:w-auto sm:flex-grow max-w-sm"
                />
                <div className="flex items-center gap-2 ml-auto">
                    <FieldFilterToggle />
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span
                                    className={cn(
                                        !hasSelection && "cursor-not-allowed",
                                    )}
                                >
                                    <Button
                                        disabled={!hasSelection}
                                        onClick={() => onAddMeasure(selectedIds)}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Toevoegen
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                {hasSelection
                                    ? `Maatregel toevoegen aan ${selectedIds.length} perceel${selectedIds.length === 1 ? "" : "en"}`
                                    : "Selecteer één of meerdere percelen om een maatregel toe te voegen"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={cn({
                                            "sticky left-0 bg-background w-[40px]":
                                                header.column.id === "select",
                                        })}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef
                                                      .header,
                                                  header.getContext(),
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length > 0 ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={
                                        row.getIsSelected() && "selected"
                                    }
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn({
                                                "sticky left-0 bg-background":
                                                    cell.column.id === "select",
                                            })}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-20 text-center text-muted-foreground text-sm"
                                >
                                    {fieldFilter.searchTerms ||
                                    fieldFilter.showProductiveOnly
                                        ? "Geen percelen gevonden."
                                        : "Geen percelen beschikbaar."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
