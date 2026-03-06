import {
    type ColumnDef,
    type ColumnFiltersState,
    type FilterFn,
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    type Row,
    type RowSelectionState,
    type SortingState,
    useReactTable,
    type VisibilityState,
} from "@tanstack/react-table"
import fuzzysort from "fuzzysort"
import { ChevronDown } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "~/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import { useIsMobile } from "~/hooks/use-mobile"
import { cn } from "~/lib/utils"
import type { FarmExtended } from "./columns"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
}

function withSearchTarget<TData extends FarmExtended>(item: TData) {
    return {
        ...item,
        fields: item.fields ? item.fields.map(withSearchTarget) : item.fields,
        searchTarget: `${item.b_name_farm} ${item.owner?.displayUserName ?? ""} ${item.cultivations.map((c) => c.b_lu_name).join(" ")} ${item.fertilizers.map((f) => f.p_name_nl).join(" ")}`,
    }
}

export function DataTable<TData extends FarmExtended, TValue>({
    columns,
    data,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [globalFilter, setGlobalFilter] = useState("")
    const isMobile = useIsMobile()
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
        isMobile ? { owner: false, b_area: false } : {},
    )
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

    useEffect(() => {
        setColumnVisibility(isMobile ? { owner: false, b_area: false } : {})
    }, [isMobile])

    const memoizedData = useMemo(() => {
        return data.map((data) => withSearchTarget(data))
    }, [data])

    const fuzzyFilter: FilterFn<TData> = (row, _columnId, filterValue) => {
        const result = fuzzysort.go(filterValue, [
            (row.original as any).searchTarget,
        ])
        return result.length > 0
    }

    const table = useReactTable({
        data: memoizedData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        getExpandedRowModel: getExpandedRowModel(),
        getSubRows: (row) => row.fields as TData[],
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        globalFilterFn: fuzzyFilter,
        filterFromLeafRows: true,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter,
            rowSelection,
        },
    })

    return (
        <div className="w-full flex flex-col h-full">
            <div className="sticky top-0 z-10 bg-background py-4 flex flex-col sm:flex-row gap-2 items-center">
                <Input
                    placeholder="Zoek op naam, gewas of meststof"
                    value={globalFilter ?? ""}
                    onChange={(event) => setGlobalFilter(event.target.value)}
                    className="w-full sm:w-auto sm:flex-grow"
                />
                <div className="flex w-full items-center justify-start sm:justify-end gap-2 sm:w-auto flex-wrap">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                Bekijk
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    const columnNames: Record<string, string> =
                                        {
                                            b_name_farm: "Naam",
                                            owner: "Eigenaar",
                                            cultivations: "Gewassen",
                                            fertilizerApplications:
                                                "Bemesting met:",
                                            b_area: "Oppervlakte",
                                        }
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(!!value)
                                            }
                                        >
                                            {columnNames[column.id] ??
                                                column.id}
                                        </DropdownMenuCheckboxItem>
                                    )
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="rounded-md border grow relative overflow-x-auto">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            className={cn({
                                                "sticky left-0 bg-background":
                                                    header.column.id ===
                                                    "select",
                                                "sticky right-0 bg-background":
                                                    header.column.id ===
                                                    "actions",
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
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={
                                        row.getIsSelected() && "selected"
                                    }
                                    className={cn(
                                        row.original.type === "field" &&
                                            "bg-muted/50 hover:bg-muted",
                                        row.original.type === "field" &&
                                            ((row.getParentRow() as Row<TData>)
                                                ?.subRows.length === 1
                                                ? "shadow-[inset_0_1em_2em_-2em_#00000088,inset_0_-1em_2em_-2em_#00000088]"
                                                : row.index === 0
                                                  ? "shadow-[inset_0_1em_2em_-2em_#00000088]"
                                                  : row.index ===
                                                        (
                                                            row.getParentRow() as Row<TData>
                                                        )?.subRows.length -
                                                            1 &&
                                                    "shadow-[inset_0_-1em_2em_-2em_#00000088]"),
                                    )}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn({
                                                "sticky left-0 bg-background":
                                                    cell.column.id === "select",
                                                "sticky right-0 bg-background":
                                                    cell.column.id ===
                                                    "actions",
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
                                    className="h-24 text-center"
                                >
                                    Geen resultaten.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
