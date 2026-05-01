import {
    type ColumnDef,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    getFacetedRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    type Row,
    type RowSelectionState,
    type SortingState,
    useReactTable,
    type VisibilityState,
} from "@tanstack/react-table"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import fuzzysort from "fuzzysort"
import { ChevronDown, Plus } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, useLocation, useParams } from "react-router-dom"
import { toast as notify } from "sonner"
import { modifySearchParams } from "@/app/lib/url-utils"
import { useActiveTableFormStore } from "@/app/store/active-table-form"
import { useFieldFilterStore } from "@/app/store/field-filter"
import { useRotationSelectionStore } from "@/app/store/rotation-selection"
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
import type { CropRow, FieldRow, RotationExtended } from "./columns"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    canAddItem: boolean
}

export function DataTable<TData extends RotationExtended, TValue>({
    columns,
    data,
    canAddItem,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const fieldFilter = useFieldFilterStore()
    const isMobile = useIsMobile()
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
        isMobile
            ? { a_som_loi: false, b_soiltype_agr: false, b_area: false }
            : {},
    )
    const lastSelectedRowIndex = useRef<string | null>(null)
    const location = useLocation()

    const selection = useRotationSelectionStore((state) => state.selection)
    const updateSelection = useRotationSelectionStore(
        (state) => state.updateSelection,
    )
    const syncFarm = useRotationSelectionStore((state) => state.syncFarm)

    useEffect(() => {
        setColumnVisibility(
            isMobile
                ? { a_som_loi: false, b_soiltype_agr: false, b_area: false }
                : {},
        )
    }, [isMobile])

    const params = useParams()
    const b_id_farm = params.b_id_farm
    const calendar = params.calendar

    useEffect(() => {
        if (b_id_farm) {
            syncFarm(b_id_farm)
            fieldFilter.syncFarm(b_id_farm)
        }
    }, [b_id_farm, syncFarm, fieldFilter.syncFarm])

    const clearActiveForm = useActiveTableFormStore(
        (store) => store.clearActiveForm,
    )

    function handleSelection(rowSelection: RowSelectionState) {
        // Sync to store
        const newSelection = Object.fromEntries(
            table
                .getFilteredRowModel()
                .rows.map((row) => [
                    row.original.b_lu_catalogue,
                    Object.fromEntries(
                        row.subRows.map((fieldRow) => [
                            (fieldRow.original as FieldRow).b_id,
                            rowSelection[fieldRow.id],
                        ]),
                    ),
                ]),
        )
        updateSelection(newSelection)
    }

    const handleRowClick = (
        row: Row<MemoizedTData>,
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

        clearActiveForm()
        if (event.shiftKey) {
            document.getSelection()?.removeAllRanges()
            const lastSelectedRow =
                lastSelectedRowIndex.current &&
                table.getRow(lastSelectedRowIndex.current)
            if (lastSelectedRow) {
                const newRowSelection = { ...table.getState().rowSelection }
                const visibleRows = table.getRowModel().rows

                // Select or deselect everything in between
                const mode = lastSelectedRow.getIsSelected()
                const lastIndex = visibleRows.findIndex(
                    (r) => r.id === lastSelectedRow.id,
                )
                const currentIndex = visibleRows.findIndex(
                    (r) => r.id === row.id,
                )

                const start = Math.min(lastIndex, currentIndex)
                const end = Math.max(lastIndex, currentIndex)

                let somethingSelected = false

                for (let i = start; i <= end; i++) {
                    const r = visibleRows[i]
                    if ((newRowSelection[r.id] ?? false) !== mode) {
                        somethingSelected = true
                    }
                    newRowSelection[r.id] = mode
                    if (r.original.type === "crop" && r.getCanExpand()) {
                        // Also select subrows
                        for (const sub of r.subRows) {
                            if ((newRowSelection[sub.id] ?? false) !== mode) {
                                somethingSelected = true
                            }
                            newRowSelection[sub.id] = mode
                            if (sub.id === visibleRows[end].id) break
                        }
                    }
                }

                if (!somethingSelected) {
                    // Fall back to toggling last clicked row's selection if no visible selection change happens
                    newRowSelection[row.id] = !row.getIsSelected()
                }

                handleSelection(newRowSelection)
            }
        } else {
            lastSelectedRowIndex.current = null
            const newIsSelected = !row.getIsSelected()
            row.toggleSelected(newIsSelected)
        }
        lastSelectedRowIndex.current = row.id
    }

    const memoizedData = useMemo(() => {
        return (data as CropRow[]).map((item) => {
            const commonTerms = item.b_lu_name
            const crop_b_lu_start = new Set<string>()
            const crop_b_lu_end = new Set<string>()
            const crop_b_lu_harvest_date = new Set<string>()

            const formatDate = (date: Date) =>
                format(date, "d MMMM yyyy", { locale: nl })
            const dateTermsArr = (dates: Date[]) =>
                [...new Set(dates.map(formatDate))].join(" ")

            const fields = item.fields.map((field) => {
                field.b_lu_start.forEach((v) => {
                    crop_b_lu_start.add(formatDate(v))
                })
                field.b_lu_end.forEach((v) => {
                    crop_b_lu_end.add(formatDate(v))
                })
                field.harvests.forEach((v) => {
                    if (v.b_lu_harvest_date)
                        crop_b_lu_harvest_date.add(
                            formatDate(v.b_lu_harvest_date),
                        )
                })

                return {
                    ...field,
                    b_lu_catalogue: item.b_lu_catalogue,
                    searchTarget: `${field.b_name} ${commonTerms} ${dateTermsArr(field.b_lu_start)} ${dateTermsArr(field.b_lu_end)} ${dateTermsArr(field.harvests.flatMap((harvest) => harvest.b_lu_harvest_date ?? []))}`,
                }
            })

            return {
                ...item,
                fields: fields,
                searchTarget: `${commonTerms} ${[...crop_b_lu_start].join(" ")} ${[...crop_b_lu_end].join(" ")} ${[...crop_b_lu_harvest_date].join(" ")}`,
            }
        })
    }, [data])
    type MemoizedTData =
        | (typeof memoizedData)[number] // Memoized CropRow
        | (typeof memoizedData)[number]["fields"][number] // Memoized FieldRow

    const fuzzySearchAndProductivityFilter = (
        data: MemoizedTData,
        searchTerms: string,
        showProductiveOnly: boolean,
    ) => {
        if (
            showProductiveOnly &&
            !(data.type === "crop"
                ? data.fields.some((field) => !field.b_bufferstrip)
                : !data.b_bufferstrip)
        ) {
            return false
        }

        return (
            searchTerms === "" ||
            fuzzysort.go(searchTerms, [data.searchTarget]).length > 0
        )
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: the filter function is pure
    const rowSelection = useMemo(() => {
        return Object.fromEntries([
            // Crop selection state is derived from whether all its fields are selected
            ...memoizedData.map((crop) => [
                `crop_${crop.b_lu_catalogue}`,
                crop.fields.every(
                    (field) =>
                        !fuzzySearchAndProductivityFilter(
                            field,
                            fieldFilter.searchTerms,
                            fieldFilter.showProductiveOnly,
                        ) || selection[crop.b_lu_catalogue]?.[field.b_id],
                ),
            ]),
            // Include each field's selection state too
            ...memoizedData.flatMap((crop) =>
                crop.fields.map((field) => [
                    `${crop.b_lu_catalogue}_${field.b_id}`,
                    selection[crop.b_lu_catalogue]?.[field.b_id],
                ]),
            ),
        ])
    }, [selection, memoizedData, fieldFilter])

    const table = useReactTable<MemoizedTData>({
        data: memoizedData,
        columns: columns as ColumnDef<MemoizedTData>[],
        getRowId: (row) =>
            row.type === "crop"
                ? `crop_${row.b_lu_catalogue}`
                : `${row.b_lu_catalogue}_${row.b_id}`,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getSubRows: (row) => (row.type === "crop" ? row.fields : undefined),
        onColumnVisibilityChange: setColumnVisibility,
        onGlobalFilterChange: (fn) => {
            const result = typeof fn === "function" ? fn(fieldFilter) : fn
            const newSearchTerms =
                typeof result === "string" ? result : result?.searchTerms
            if ((newSearchTerms ?? "") !== fieldFilter.searchTerms)
                fieldFilter.setSearchTerms(newSearchTerms ?? "")
        },
        onRowSelectionChange: (fn) => {
            const selection = typeof fn === "function" ? fn(rowSelection) : fn
            handleSelection(selection)
        },
        globalFilterFn: (row) =>
            fuzzySearchAndProductivityFilter(
                row.original,
                fieldFilter.searchTerms,
                fieldFilter.showProductiveOnly,
            ),
        // There are nulls in the columns which can cause false assumptions if this is not provided
        // The global filter checks the searchTarget field anyways
        // Filter only one of the columns to gain performance
        getColumnCanGlobalFilter: (column) => column.id === "name",
        filterFromLeafRows: true,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter: fieldFilter,
            rowSelection,
        },
    })

    // biome-ignore lint/correctness/useExhaustiveDependencies: rowSelection is needed for Oogst button activation
    const selectedCultivations = useMemo(() => {
        return table
            .getFilteredRowModel()
            .rows.filter(
                (row) =>
                    row.original.type === "crop" &&
                    (row.getIsSelected() || row.getIsSomeSelected()),
            )
            .map((row) => row.original)
    }, [table, rowSelection])

    // biome-ignore lint/correctness/useExhaustiveDependencies: rowSelection is needed for Bemesting button activation
    const selectedFields = useMemo(() => {
        return (
            table
                .getFilteredSelectedRowModel()
                .flatRows.filter(
                    (row) => row.original.type === "field",
                ) as Row<FieldRow>[]
        ).map((row) => row.original)
    }, [table, rowSelection])

    const selectedCultivationIds = selectedCultivations.map(
        (cultivation) => cultivation.b_lu_catalogue,
    )
    const selectedFieldIds = selectedFields.map((field) => field.b_id)

    const isFertilizerButtonDisabled = selectedFieldIds.length === 0
    const fertilizerTooltipContent = isFertilizerButtonDisabled
        ? "Selecteer één of meerdere gewassen om bemesting toe te voegen"
        : "Bemesting toevoegen aan geselecteerd gewas"

    const isHarvestButtonDisabled =
        selectedCultivationIds.length !== 1 ||
        selectedCultivations[0].b_lu_harvestable === "none"
    const harvestErrorMessage =
        selectedCultivations.length > 0
            ? selectedCultivations[0].b_lu_harvestable === "none"
                ? "Dit gewas is niet oogstbaar."
                : null
            : null
    const harvestTooltipContent =
        selectedCultivationIds.length !== 1
            ? "Selecteer één gewas om oogst toe te voegen"
            : harvestErrorMessage
              ? harvestErrorMessage
              : "Oogst toevoegen aan geselecteerd gewas"

    function makeWizardUrl(url: string) {
        return modifySearchParams(url, (searchParams) => {
            searchParams.set("cultivationIds", selectedCultivationIds.join(","))
            searchParams.set("fieldIds", selectedFieldIds.join(","))
            if (location.pathname.toLowerCase().startsWith("/farm/create"))
                searchParams.set("create", "")
        })
    }

    function isFirstFieldRowForACrop(
        flatRows: Row<MemoizedTData>[],
        i: number,
    ) {
        if (flatRows[i].original.type !== "field") return false
        return i === 0 || flatRows[i - 1].original.type === "crop"
    }

    function isLastFieldRowForACrop(flatRows: Row<MemoizedTData>[], i: number) {
        if (flatRows[i].original.type !== "field") return false
        return (
            i + 1 === flatRows.length ||
            flatRows[i + 1].original.type === "crop"
        )
    }

    return (
        <div className="w-full flex flex-col h-full min-w-0">
            <div className="sticky top-0 z-5 bg-background py-4 flex flex-col sm:flex-row gap-2 items-center">
                <Input
                    placeholder="Zoek op gewas, meststof of datum"
                    value={fieldFilter.searchTerms ?? ""}
                    onChange={(event) =>
                        fieldFilter.setSearchTerms(event.target.value)
                    }
                    className="w-full sm:w-auto sm:grow"
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
                                            b_lu_name: "Gewas",
                                            b_lu_start: "Zaaidatum",
                                            b_lu_end: "Einddatum",
                                            b_harvest_date: "Oogstdata",
                                            b_lu_variety: "Variëteit",
                                            m_cropresidue: "Gewasresten",
                                            fertilizers: "Bemesting",
                                            b_name: "Percelen",
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
                                            to={makeWizardUrl(
                                                `/farm/${b_id_farm}/${calendar}/rotation/fertilizer`,
                                            )}
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
                                <div
                                    className={cn(!canAddItem ? "hidden" : "")}
                                >
                                    {isHarvestButtonDisabled ? (
                                        <Button
                                            disabled={isHarvestButtonDisabled}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Oogst toevoegen
                                        </Button>
                                    ) : harvestErrorMessage ? (
                                        <Button
                                            onClick={() =>
                                                notify.error(
                                                    harvestErrorMessage,
                                                )
                                            }
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Oogst toevoegen
                                        </Button>
                                    ) : (
                                        <NavLink
                                            to={makeWizardUrl(
                                                `/farm/${b_id_farm}/${calendar}/rotation/harvest`,
                                            )}
                                        >
                                            <Button>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Oogst toevoegen
                                            </Button>
                                        </NavLink>
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{harvestTooltipContent}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
            <div className="rounded-md border grow relative overflow-x-auto">
                <Table>
                    <TableHeader className="sticky top-0 z-5 bg-background">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            className={cn("box-border", {
                                                "sticky left-0":
                                                    header.column.id ===
                                                    "select",
                                                "sticky right-0":
                                                    header.column.id ===
                                                    "actions",
                                                "min-w-35":
                                                    header.column.id === "name",
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
                            table.getRowModel().rows.map((row, i, flatRows) => (
                                <TableRow
                                    key={row.id}
                                    onClick={(event) =>
                                        handleRowClick(row, event)
                                    }
                                    className={cn(
                                        "data-[state=selected]:bg-muted data-[state=indeterminate]:bg-muted/50",
                                        row.getIsSelected()
                                            ? "bg-green-100 hover:bg-green-300/50"
                                            : row.original.type === "crop" &&
                                                row.getIsSomeSelected()
                                              ? "bg-green-50 hover:bg-green-300/25"
                                              : row.original.type === "field" &&
                                                "bg-muted/50 hover:bg-muted",
                                        row.original.type === "field" &&
                                            (row.getParentRow()?.subRows
                                                .length === 1
                                                ? "shadow-[inset_0_1em_2em_-2em_#00000088,inset_0_-1em_2em_-2em_#00000088]"
                                                : isFirstFieldRowForACrop(
                                                        flatRows,
                                                        i,
                                                    )
                                                  ? "shadow-[inset_0_1em_2em_-2em_#00000088]"
                                                  : isLastFieldRowForACrop(
                                                        flatRows,
                                                        i,
                                                    ) &&
                                                    "shadow-[inset_0_-1em_2em_-2em_#00000088]"),
                                    )}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn({
                                                "sticky left-0":
                                                    cell.column.id === "select",
                                                "sticky right-0":
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
