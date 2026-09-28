/* eslint-disable typescript/unbound-method -- TanStack React Table row models are designed to use destructured methods directly in columns. */
import {
  ColumnVisibilityState,
  FlexRender,
  type Row,
  type RowSelectionState,
  useTable,
} from "@tanstack/react-table"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import fuzzysort from "fuzzysort"
import { ChevronDown, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { NavLink, useLocation, useParams } from "react-router"
import { toast as notify } from "sonner"
import { useActiveTableFormStore } from "@/app/store/active-table-form"
import { getHarvestTerm } from "~/components/blocks/harvest/utils"
import { FieldFilterToggle } from "~/components/custom/field-filter-toggle"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useIsMobile } from "~/hooks/use-mobile"
import { modifySearchParams } from "~/lib/url-utils"
import { cn } from "~/lib/utils"
import { useFieldFilterStore } from "~/store/field-filter"
import { useRotationSelectionStore } from "~/store/rotation-selection"
import type {
  columns as ColumnsT,
  CropRow,
  MemoizedFieldRow,
  MemoizedRotationExtended,
  RotationExtended,
} from "./columns"
import { buildRowSelection, handleRowSelection } from "./row-selection"
import { rotationTableFeatures } from "./table-features"

interface DataTableProps<TData> {
  columns: typeof ColumnsT
  data: TData[]
  canAddItem: boolean
}

/**
 * Check if the given rotation table row matches the search terms and the productivity filter.
 *
 * @param data Row data to test.
 * @param searchTerms Search terms as found in the field filter state.
 * @param showProductiveOnly Productivity filter as found in the field filter state.
 * @returns true iff the filters match.
 */
function fuzzySearchAndProductivityFilter(
  data: MemoizedRotationExtended,
  searchTerms: string,
  showProductiveOnly: boolean,
) {
  if (
    showProductiveOnly &&
    !(data.type === "crop"
      ? data.fields.some((field) => !field.b_bufferstrip)
      : !data.b_bufferstrip)
  ) {
    return false
  }

  return searchTerms === "" || fuzzysort.go(searchTerms, [data.searchTarget]).length > 0
}

export function DataTable<TData extends RotationExtended>({
  columns,
  data,
  canAddItem,
}: DataTableProps<TData>) {
  const fieldFilter = useFieldFilterStore()
  const isMobile = useIsMobile()
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(
    isMobile ? { a_som_loi: false, b_soiltype_agr: false, b_area: false } : {},
  )
  const location = useLocation()

  const selection = useRotationSelectionStore((state) => state.selection)
  const setSelection = useRotationSelectionStore((state) => state.setSelection)
  const syncFarm = useRotationSelectionStore((state) => state.syncFarm)
  const fieldFilterSyncFarm = fieldFilter.syncFarm

  useEffect(() => {
    setColumnVisibility(isMobile ? { a_som_loi: false, b_soiltype_agr: false, b_area: false } : {})
  }, [isMobile])

  const params = useParams()
  const b_id_farm = params.b_id_farm
  const calendar = params.calendar

  useEffect(() => {
    if (b_id_farm) {
      syncFarm(b_id_farm)
      fieldFilterSyncFarm(b_id_farm)
    }
  }, [b_id_farm, syncFarm, fieldFilterSyncFarm])

  const clearActiveForm = useActiveTableFormStore((store) => store.clearActiveForm)

  const memoizedData = useMemo(() => {
    return (data as CropRow[]).map((item) => {
      const commonTerms = item.b_lu_name
      const crop_b_lu_start = new Set<string>()
      const crop_b_lu_end = new Set<string>()
      const crop_b_lu_harvest_date = new Set<string>()

      const formatDate = (date: Date) => format(date, "d MMMM yyyy", { locale: nl })
      const dateTermsArr = (dates: Date[]) => [...new Set(dates.map(formatDate))].join(" ")

      const fields = item.fields.map((field) => {
        field.b_lu_start.forEach((v) => {
          crop_b_lu_start.add(formatDate(v))
        })
        field.b_lu_end.forEach((v) => {
          crop_b_lu_end.add(formatDate(v))
        })
        field.harvests.forEach((v) => {
          if (v.b_lu_harvest_date) crop_b_lu_harvest_date.add(formatDate(v.b_lu_harvest_date))
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

  const globalFilterFn = useCallback(
    (row: { original: MemoizedRotationExtended }) =>
      fuzzySearchAndProductivityFilter(
        row.original,
        fieldFilter.searchTerms,
        fieldFilter.showProductiveOnly,
      ),
    [fieldFilter.searchTerms, fieldFilter.showProductiveOnly],
  )

  const rowSelection = useMemo(
    () => buildRowSelection(selection, memoizedData, globalFilterFn),
    [selection, memoizedData, globalFilterFn],
  )

  const previousSelection = useRef<RowSelectionState>(rowSelection)
  const lastSelectedRowIndex = useRef<string | null>(null)
  function handleSelection(nextRowSelection: RowSelectionState) {
    // Only touch rows currently in the filtered row model so the selection
    // state of filtered-out rows already in the store is preserved. Always
    // update the state of these rows. Since TanStack might not return the
    // state for a row if it is deselected, updating the keys passed to
    // handleSelection doesn't suffice.
    const newSelection = Object.fromEntries(
      Object.entries(selection).map(([k, v]) => [k, { ...v }]),
    )
    for (const row of table.getFilteredRowModel().flatRows) {
      if (row.original.type !== "field") continue
      const { b_lu_catalogue, b_id } = row.original
      if (!(b_lu_catalogue in newSelection)) {
        newSelection[b_lu_catalogue] = {}
      }
      newSelection[b_lu_catalogue][b_id] = !!nextRowSelection[row.id]
    }
    setSelection(newSelection)
  }

  const isMemoizedFieldRow = (row: MemoizedRotationExtended): row is MemoizedFieldRow =>
    row.type === "field"

  const table = useTable({
    data: memoizedData,
    features: rotationTableFeatures,
    columns: columns,
    getRowId: (row) =>
      row.type === "crop" ? `crop_${row.b_lu_catalogue}` : `${row.b_lu_catalogue}_${row.b_id}`,
    getSubRows: (row) => (row.type === "crop" ? row.fields : undefined),
    // Only used when selecting using the select column.
    enableMultiRowSelection: true,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (fn) => {
      const result = typeof fn === "function" ? fn(fieldFilter) : fn
      const newSearchTerms = typeof result === "string" ? result : result?.searchTerms
      if ((newSearchTerms ?? "") !== fieldFilter.searchTerms)
        fieldFilter.setSearchTerms(newSearchTerms ?? "")
    },
    onRowSelectionChange: (fn) => {
      // A ref is used in case TanStack Table wants to do multiple selection state updates in the same render pass.
      const nextSelection = typeof fn === "function" ? fn(previousSelection.current) : fn
      previousSelection.current = nextSelection
      handleSelection(nextSelection)
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
    meta: {
      lastSelectedRowIndex,
      previousSelection,
    },
    state: {
      columnVisibility,
      globalFilter: fieldFilter,
      rowSelection,
    },
  })

  const selectedCultivations = useMemo(() => {
    return table
      .getFilteredRowModel()
      .rows.filter(
        (row) => row.original.type === "crop" && (row.getIsSelected() || row.getIsSomeSelected()),
      )
      .map((row) => row.original)
    // oxlint-disable-next-line react-hooks/exhaustive-deps We know that selected rows depend on the row selection.
  }, [table, rowSelection])

  const selectedFields = useMemo(() => {
    return table
      .getFilteredSelectedRowModel()
      .flatRows.map((row) => row.original)
      .filter(isMemoizedFieldRow)
    // oxlint-disable-next-line react-hooks/exhaustive-deps We know that selected rows depend on the row selection.
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
    selectedCultivationIds.length !== 1 || selectedCultivations[0].b_lu_harvestable === "none"
  const harvestErrorMessage =
    selectedCultivations.length > 0
      ? selectedCultivations[0].b_lu_harvestable === "none"
        ? "Dit gewas is niet oogstbaar."
        : null
      : null
  const harvestTooltipContent =
    selectedCultivationIds.length !== 1
      ? "Selecteer één gewas om oogst/snede toe te voegen"
      : harvestErrorMessage
        ? harvestErrorMessage
        : `${getHarvestTerm(selectedCultivations[0].b_lu_croprotation, false, selectedCultivations[0].b_lu_harvestable, true)} toevoegen aan geselecteerd gewas`

  function makeWizardUrl(url: string) {
    return modifySearchParams(url, (searchParams) => {
      searchParams.set("cultivationIds", selectedCultivationIds.join(","))
      searchParams.set("fieldIds", selectedFieldIds.join(","))
      if (location.pathname.toLowerCase().startsWith("/farm/create")) searchParams.set("create", "")
    })
  }

  function isFirstFieldRowForACrop(
    flatRows: Row<typeof rotationTableFeatures, MemoizedRotationExtended>[],
    i: number,
  ) {
    if (flatRows[i].original.type !== "field") return false
    return i === 0 || flatRows[i - 1].original.type === "crop"
  }

  function isLastFieldRowForACrop(
    flatRows: Row<typeof rotationTableFeatures, MemoizedRotationExtended>[],
    i: number,
  ) {
    if (flatRows[i].original.type !== "field") return false
    return i + 1 === flatRows.length || flatRows[i + 1].original.type === "crop"
  }

  const rows = table.getRowModel().rows
  useEffect(() => {
    if (!rows.some((row) => row.id === lastSelectedRowIndex.current)) {
      lastSelectedRowIndex.current = null
    }
  }, [rows])

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="bg-background sticky top-0 z-5 flex flex-col items-center gap-2 py-4 sm:flex-row">
        <Input
          placeholder="Zoek op gewas, meststof of datum"
          value={fieldFilter.searchTerms ?? ""}
          onChange={(event) => fieldFilter.setSearchTerms(event.target.value)}
          className="w-full sm:w-auto sm:grow"
        />
        <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
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
                  const columnNames: Record<string, string> = {
                    b_lu_name: "Gewas",
                    b_lu_start: "Zaaidatum",
                    b_lu_end: "Einddatum",
                    b_harvest_date: "Oogst/Maaidata",
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
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {columnNames[column.id] ?? column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <FieldFilterToggle />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(!canAddItem ? "hidden" : "")}>
                  {isFertilizerButtonDisabled ? (
                    <Button disabled={isFertilizerButtonDisabled}>
                      <Plus className="mr-2 h-4 w-4" />
                      Bemesting
                    </Button>
                  ) : (
                    <NavLink
                      to={makeWizardUrl(`/farm/${b_id_farm}/${calendar}/rotation/fertilizer`)}
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
                <div className={cn(!canAddItem ? "hidden" : "")}>
                  {isHarvestButtonDisabled ? (
                    <Button disabled={isHarvestButtonDisabled}>
                      <Plus className="mr-2 h-4 w-4" />
                      {selectedCultivations.length === 1
                        ? getHarvestTerm(
                            selectedCultivations[0].b_lu_croprotation,
                            false,
                            selectedCultivations[0].b_lu_harvestable,
                            true,
                          )
                        : "Oogst"}{" "}
                      toevoegen
                    </Button>
                  ) : harvestErrorMessage ? (
                    <Button onClick={() => notify.error(harvestErrorMessage)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {selectedCultivations.length === 1
                        ? getHarvestTerm(
                            selectedCultivations[0].b_lu_croprotation,
                            false,
                            selectedCultivations[0].b_lu_harvestable,
                            true,
                          )
                        : "Oogst"}{" "}
                      toevoegen
                    </Button>
                  ) : (
                    <NavLink to={makeWizardUrl(`/farm/${b_id_farm}/${calendar}/rotation/harvest`)}>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        {selectedCultivations.length === 1
                          ? getHarvestTerm(
                              selectedCultivations[0].b_lu_croprotation,
                              false,
                              selectedCultivations[0].b_lu_harvestable,
                              true,
                            )
                          : "Oogst"}{" "}
                        toevoegen
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
      <div className="relative grow overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className="bg-background sticky top-0 z-5">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={cn("box-border", {
                        "sticky left-0": header.column.id === "select",
                        "sticky right-0": header.column.id === "actions",
                        "min-w-35": header.column.id === "name",
                      })}
                    >
                      <FlexRender header={header} />
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row, i, flatRows) => (
                <TableRow
                  key={row.id}
                  onClick={(event) => {
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

                    handleRowSelection(row, table, {
                      ...event,
                      target: {
                        ...event.currentTarget,
                        checked: !row.getIsSelected(),
                      } as EventTarget,
                      currentTarget: { ...event.currentTarget, checked: row.getIsSelected() },
                    })
                  }}
                  className={cn(
                    "data-[state=selected]:bg-muted data-[state=indeterminate]:bg-muted/50",
                    row.getIsSelected()
                      ? "bg-green-100 hover:bg-green-300/50"
                      : row.original.type === "crop" && row.getIsSomeSelected()
                        ? "bg-green-50 hover:bg-green-300/25"
                        : row.original.type === "field" && "bg-muted/50 hover:bg-muted",
                    row.original.type === "field" &&
                      (row.getParentRow()?.subRows.length === 1
                        ? "shadow-[inset_0_1em_2em_-2em_#00000088,inset_0_-1em_2em_-2em_#00000088]"
                        : isFirstFieldRowForACrop(flatRows, i)
                          ? "shadow-[inset_0_1em_2em_-2em_#00000088]"
                          : isLastFieldRowForACrop(flatRows, i) &&
                            "shadow-[inset_0_-1em_2em_-2em_#00000088]"),
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn({
                        "sticky left-0": cell.column.id === "select",
                        "sticky right-0": cell.column.id === "actions",
                      })}
                    >
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
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
