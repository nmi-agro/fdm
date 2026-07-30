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
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type RowSelectionState,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"
import { useFieldFilterStore } from "~/store/field-filter"
import type { FieldSummaryRow } from "./field-summary-columns"

interface FieldSummaryTableProps {
  columns: ColumnDef<FieldSummaryRow>[]
  data: FieldSummaryRow[]
  onAddMeasure?: (selectedFieldIds: string[]) => void
  canModify?: boolean
}

export function FieldSummaryTable({
  columns,
  data,
  onAddMeasure = () => {},
  canModify = true,
}: FieldSummaryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "b_area", desc: true }])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const { b_id_farm } = useParams()
  const syncFarm = useFieldFilterStore((s) => s.syncFarm)
  const showProductiveOnly = useFieldFilterStore((s) => s.showProductiveOnly)
  const searchTerms = useFieldFilterStore((s) => s.searchTerms)
  const setSearchTerms = useFieldFilterStore((s) => s.setSearchTerms)

  useEffect(() => {
    if (b_id_farm) {
      syncFarm(b_id_farm)
    }
  }, [b_id_farm, syncFarm])

  const filteredData = useMemo(() => {
    let rows = data

    if (showProductiveOnly) {
      rows = rows.filter((r) => !r.b_bufferstrip)
    }

    if (searchTerms.trim()) {
      rows = rows.filter((r) => {
        const target = [
          r.b_name ?? "",
          ...(r.mainCultivations?.map((cult) => cult.b_lu_name ?? "") ?? []),
          ...r.measures.map((m) => m.m_name),
        ]
          .filter(Boolean)
          .join(" ")
        return fuzzysort.go(searchTerms, [target]).length > 0
      })
    }

    return rows
  }, [data, searchTerms, showProductiveOnly])

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.b_id,
    state: {
      sorting,
      rowSelection,
      columnVisibility: { select: canModify },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: canModify,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])
  const hasSelection = selectedIds.length > 0

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Zoek perceel of maatregel…"
          value={searchTerms ?? ""}
          onChange={(e) => setSearchTerms(e.target.value)}
          className="w-full max-w-sm sm:w-auto sm:flex-grow"
        />
        <div className="ml-auto flex items-center gap-2">
          <FieldFilterToggle />
          {canModify && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(!hasSelection && "cursor-not-allowed")}>
                    <Button disabled={!hasSelection} onClick={() => onAddMeasure(selectedIds)}>
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
          )}
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
                      "bg-background sticky left-0 w-[40px]": header.column.id === "select",
                    })}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn({
                        "bg-background sticky left-0": cell.column.id === "select",
                      })}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-20 text-center text-sm"
                >
                  {searchTerms || showProductiveOnly
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
