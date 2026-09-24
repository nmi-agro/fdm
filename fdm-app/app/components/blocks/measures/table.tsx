import { FlexRender, type SortingState, useTable } from "@tanstack/react-table"
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
import type { getColumns, MeasureTableRow } from "./columns"
import { measuresTableFeatures } from "./table-features"

interface MeasuresDataTableProps {
  columns: ReturnType<typeof getColumns>
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

  const table = useTable({
    data,
    features: measuresTableFeatures,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility: { actions: canModify },
    },
    meta: {
      canModify,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Zoek maatregel…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        {canModify && (
          <Button size="sm" onClick={onAddClick} className="shrink-0">
            <Plus className="mr-1 h-4 w-4" />
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
                    <FlexRender header={header} />
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
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center text-sm"
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
