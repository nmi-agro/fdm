import { FlexRender, type Row, RowSelectionState, useTable } from "@tanstack/react-table"
import fuzzysort from "fuzzysort"
import { ChevronDown, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { NavLink, useParams } from "react-router"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useIsMobile } from "~/hooks/use-mobile"
import { cn } from "~/lib/utils"
import type { buildColumns, FieldExtended } from "./columns"
import { FieldFilterToggle } from "../../custom/field-filter-toggle"
import { fieldsTableFeatures } from "./table-features"

interface DataTableProps<TData extends FieldExtended> {
  columns: ReturnType<typeof buildColumns>
  data: TData[]
  canAddItem: boolean
}

export function DataTable<TData extends FieldExtended>({
  columns,
  data,
  canAddItem,
}: DataTableProps<TData>) {
  const isMobile = useIsMobile()
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    isMobile ? { a_som_loi: false, b_soiltype_agr: false, b_area: false } : {},
  )
  const fieldIds = useFieldSelectionStore((state) => state.fieldIds)
  const setFieldIds = useFieldSelectionStore((state) => state.setFieldIds)
  const syncFarm = useFieldSelectionStore((state) => state.syncFarm)
  const fieldFilter = useFieldFilterStore()

  const rowSelection = useMemo(
    () => Object.fromEntries(fieldIds.map((id) => [id, true])) as RowSelectionState,
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
    setColumnVisibility(isMobile ? { a_som_loi: false, b_soiltype_agr: false, b_area: false } : {})
  }, [isMobile])

  const handleRowClick = (
    row: Row<typeof fieldsTableFeatures, FieldExtended>,
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

    document.getSelection()?.removeAllRanges()

    row.getToggleSelectedHandler()({
      ...event,
      target: { checked: !row.getIsSelected() },
    })
  }

  const memoizedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      searchTarget: `${item.b_name} ${item.cultivations.map((c) => c.b_lu_name).join(" ")} ${item.fertilizers.map((f) => f.p_name_nl).join(" ")} ${item.b_soiltype_agr}`,
    }))
  }, [data])

  const table = useTable({
    data: memoizedData,
    features: fieldsTableFeatures,
    columns,
    getRowId: (row) => row.b_id,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (fn) => {
      const result = typeof fn === "function" ? fn(fieldFilter) : fn
      // Ensure we are dealing with the store object structure before updating
      const newSearchTerms = typeof result === "string" ? result : result?.searchTerms
      if ((newSearchTerms ?? "") !== fieldFilter.searchTerms) {
        fieldFilter.setSearchTerms(newSearchTerms ?? "")
      }
    },
    onRowSelectionChange: (fn) => {
      const selection = typeof fn === "function" ? fn(rowSelection) : fn
      setFieldIds(Object.keys(selection).filter((k) => selection[k]))
    },
    globalFilterFn: (row, _columnId, { searchTerms }) => {
      if (searchTerms === "") return true
      const result = fuzzysort.go(searchTerms, [(row.original as any).searchTarget])
      return result.length > 0
    },
    state: {
      columnVisibility,
      globalFilter: fieldFilter,
      rowSelection: rowSelection,
    },
  })

  const selectedFields = useMemo(() => {
    return table.getFilteredSelectedRowModel().rows.map((row) => row.original)
    // oxlint-disable-next-line react-hooks/exhaustive-deps We know that selected rows depend on the row selection.
  }, [table, rowSelection])

  const selectedFieldIds = selectedFields.map((field) => field.b_id)

  const isFertilizerButtonDisabled = selectedFields.length === 0
  const fertilizerTooltipContent = isFertilizerButtonDisabled
    ? "Selecteer één of meerdere percelen om bemesting toe te voegen"
    : "Bemesting toevoegen aan geselecteerde percelen"

  return (
    <div className="flex h-full w-full flex-col">
      <div className="bg-background sticky top-0 z-10 flex flex-col items-center gap-2 py-4 sm:flex-row">
        <Input
          placeholder="Zoek op naam, gewas of meststof"
          value={fieldFilter.searchTerms ?? ""}
          onChange={(event) => fieldFilter.setSearchTerms(event.target.value)}
          className="w-full sm:w-auto sm:flex-grow"
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
                    b_name: "Naam",
                    cultivations: "Gewassen",
                    fertilizerApplications: "Bemesting",
                    bcs: "BodemConditieScore",
                    a_som_loi: "Organische stof",
                    b_soiltype_agr: "Bodemtype",
                    b_area: "Oppervlakte",
                    b_bufferstrip: "Bufferstrook",
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
                <NavLink to={"./new"} className={cn(!canAddItem ? "hidden" : "")}>
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
      <div className="relative grow overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className="bg-background sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={cn({
                        "bg-background sticky left-0": header.column.id === "select",
                        "bg-background sticky right-0": header.column.id === "actions",
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={(event) => handleRowClick(row, event)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn({
                        "bg-background sticky left-0": cell.column.id === "select",
                        "bg-background sticky right-0": cell.column.id === "actions",
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
