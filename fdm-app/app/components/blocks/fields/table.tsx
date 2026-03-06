import {
    type ColumnDef,
    type ColumnFiltersState,
    type FilterFn,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    type Row,
    type SortingState,
    useReactTable,
    type VisibilityState,
} from "@tanstack/react-table"
import fuzzysort from "fuzzysort"
import { ChevronDown, Plus } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, useParams } from "react-router-dom"
import { useFieldFilterStore } from "@/app/store/field-filter"
import { useFieldSelectionStore } from "@/app/store/field-selection"
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { useIsMobile } from "~/hooks/use-mobile"
import { cn } from "~/lib/utils"
import { FieldFilterToggle } from "../../custom/field-filter-toggle"
import type { FieldExtended } from "./columns"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    canAddItem: boolean
}

export function DataTable<TData extends FieldExtended, TValue>({
    columns,
    data,
    canAddItem,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const isMobile = useIsMobile()
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
        isMobile
            ? { a_som_loi: false, b_soiltype_agr: false, b_area: false }
            : {},
    )
    const fieldIds = useFieldSelectionStore((state) => state.fieldIds)
    const setFieldIds = useFieldSelectionStore((state) => state.setFieldIds)
    const syncFarm = useFieldSelectionStore((state) => state.syncFarm)
    const lastSelectedRowIndex = useRef<number | null>(null)
    const fieldFilter = useFieldFilterStore()

    const rowSelection = useMemo(
        () => Object.fromEntries(fieldIds.map((id) => [id, true])),
        [fieldIds],
    )

    const params = useParams()
    const b_id_farm = params.b_id_farm
    const calendar = params.calendar

    useEffect(() => {
        if (b_id_farm) {
            syncFarm(b_id_farm)
            fieldFilter.syncFarm(b_id_farm)
        }
    }, [b_id_farm, syncFarm, fieldFilter.syncFarm])

    useEffect(() => {
        setColumnVisibility(
            isMobile
                ? { a_som_loi: false, b_soiltype_agr: false, b_area: false }
                : {},
        )
    }, [isMobile])

    const handleRowClick = (
        row: Row<TData>,
        event: React.MouseEvent<HTMLTableRowElement>,
    ) => {
        // Ignore clicks on interactive elements inside the row
        const isInteractive = (target: EventTarget | null): boolean => {
            if (!(target instanceof Element)) return false
            return !!target.closest(
                'a,button,input,label,select,textarea,[role="button"],[role="link"],[role="checkbox"],[data-prevent-row-click="true"]',
            )
        }

        if (isInteractive(event.target)) {
            // If a link was clicked, let the default navigation happen
            return
        }

        if (event.shiftKey && lastSelectedRowIndex.current !== null) {
            const currentIndex = row.index
            const start = Math.min(currentIndex, lastSelectedRowIndex.current)
            const end = Math.max(currentIndex, lastSelectedRowIndex.current)

            const rowsToSelect = table
                .getRowModel()
                .rows.slice(start, end + 1)
                .map((r) => r.original.b_id) // Use b_id directly

            const newFieldIds = new Set(fieldIds)
            rowsToSelect.forEach((id) => newFieldIds.add(id))
            setFieldIds(Array.from(newFieldIds))
        } else {
            row.toggleSelected()
        }
        lastSelectedRowIndex.current = row.index
    }

    const memoizedData = useMemo(() => {
        return data.map((item) => ({
            ...item,
            searchTarget: `${item.b_name} ${item.cultivations.map((c) => c.b_lu_name).join(" ")} ${item.fertilizers.map((f) => f.p_name_nl).join(" ")} ${item.b_soiltype_agr}`,
        }))
    }, [data])

    const fuzzyFilter: FilterFn<TData> = (row, _columnId, { searchTerms }) => {
        if (searchTerms === "") return true
        const result = fuzzysort.go(searchTerms, [
            (row.original as any).searchTarget,
        ])
        return result.length > 0
    }

    const table = useReactTable({
        data: memoizedData,
        columns,
        getRowId: (row) => row.b_id,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onGlobalFilterChange: (fn) => {
            const result = typeof fn === "function" ? fn(fieldFilter) : fn
            // Ensure we are dealing with the store object structure before updating
            const newSearchTerms =
                typeof result === "string" ? result : result?.searchTerms
            if ((newSearchTerms ?? "") !== fieldFilter.searchTerms) {
                fieldFilter.setSearchTerms(newSearchTerms ?? "")
            }
        },
        onRowSelectionChange: (fn) => {
            const selection = typeof fn === "function" ? fn(rowSelection) : fn
            setFieldIds(Object.keys(selection).filter((k) => selection[k]))
        },
        globalFilterFn: fuzzyFilter,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter: fieldFilter,
            rowSelection,
        },
    })

    // biome-ignore lint/correctness/useExhaustiveDependencies: rowSelection is needed for Bemesting button activation
    const selectedFields = useMemo(() => {
        return table
            .getFilteredSelectedRowModel()
            .rows.map((row) => row.original)
    }, [table, rowSelection])

    const selectedFieldIds = selectedFields.map((field) => field.b_id)

    const isFertilizerButtonDisabled = selectedFields.length === 0
    const fertilizerTooltipContent = isFertilizerButtonDisabled
        ? "Selecteer één of meerdere percelen om bemesting toe te voegen"
        : "Bemesting toevoegen aan geselecteerde percelen"

    return (
        <div className="w-full flex flex-col h-full">
            <div className="sticky top-0 z-10 bg-background py-4 flex flex-col sm:flex-row gap-2 items-center">
                <Input
                    placeholder="Zoek op naam, gewas of meststof"
                    value={fieldFilter.searchTerms ?? ""}
                    onChange={(event) =>
                        fieldFilter.setSearchTerms(event.target.value)
                    }
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
                                            b_name: "Naam",
                                            cultivations: "Gewassen",
                                            fertilizerApplications:
                                                "Bemesting met:",
                                            a_som_loi: "OS",
                                            b_soiltype_agr: "Bodemtype",
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
                    <FieldFilterToggle />
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    className={cn(!canAddItem ? "hidden" : "")}
                                >
                                    {isFertilizerButtonDisabled ? (
                                        <Button
                                            disabled={
                                                isFertilizerButtonDisabled
                                            }
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Bemesting
                                        </Button>
                                    ) : (
                                        <NavLink
                                            to={`/farm/${b_id_farm}/${calendar}/field/fertilizer?fieldIds=${selectedFieldIds.map(encodeURIComponent).join(",")}`}
                                        >
                                            <Button>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Bemesting
                                            </Button>
                                        </NavLink>
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{fertilizerTooltipContent}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <NavLink
                                    to={"./new"}
                                    className={cn(!canAddItem ? "hidden" : "")}
                                >
                                    <Button>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Nieuw perceel
                                    </Button>
                                </NavLink>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Voeg een nieuw perceel toe</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
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
                                    onClick={(event) =>
                                        handleRowClick(row, event)
                                    }
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
