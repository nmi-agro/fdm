import type { ImportReviewAction, UserChoiceMap } from "@nmi-agro/fdm-rvo/types"
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    type RowData,
    type SortingState,
    useReactTable,
} from "@tanstack/react-table"
import { Plus, Search } from "lucide-react"
import { useState } from "react"
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
import type { MeasureTableRow } from "./columns"

declare module "@tanstack/react-table" {
    interface TableMeta<TData extends RowData> {
        canModify: boolean
    }
}
interface MeasuresDataTableProps {
    columns: ColumnDef<MeasureTableRow>[]
    data: MeasureTableRow[]
    onAddClick?: () => void
    canModify?: boolean
}

export function MeasuresDataTable({
    columns,
    data,
    onAddClick = () => {},
    canModify = true,
}: MeasuresDataTableProps) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [globalFilter, setGlobalFilter] = useState("")

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter,
            columnVisibility: { actions: canModify },
        },
        meta: {
            canModify,
            calendar: "",
            userChoices: {} as UserChoiceMap,
            onChoiceChange: (() => {}) as (
                id: string,
                action: ImportReviewAction,
            ) => void,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    })

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Zoek maatregel…"
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
                {canModify && (
                    <Button size="sm" onClick={onAddClick} className="shrink-0">
                        <Plus className="h-4 w-4 mr-1" />
                        Toevoegen
                    </Button>
                )}
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
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
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
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
                                    className="h-24 text-center text-muted-foreground text-sm"
                                >
                                    {globalFilter
                                        ? `Geen maatregelen gevonden voor "${globalFilter}".`
                                        : "Nog geen maatregelen vastgelegd."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
