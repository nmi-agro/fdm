import { FlexRender, RowData, type SortingState, useTable } from "@tanstack/react-table"
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
import type { columns as ColumnsT, FarmExtended } from "./columns"
import { farmTableFeatures } from "./table-features"

interface DataTableProps<TData extends RowData> {
  columns: typeof ColumnsT
  data: TData[]
}

function withSearchTarget<TData extends FarmExtended>(
  item: TData,
): TData & { searchTarget: string } {
  return {
    ...item,
    fields: item.fields ? item.fields.map(withSearchTarget) : item.fields,
    searchTarget: `${item.b_name_farm} ${item.owners?.map((o) => o.displayUserName).join(" ") ?? ""} ${item.cultivations.map((c) => c.b_lu_name).join(" ")} ${item.fertilizers.map((f) => f.p_name_nl).join(" ")}`,
  }
}

export function DataTable<TData extends FarmExtended>({ columns, data }: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const isMobile = useIsMobile()
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    isMobile ? { owner: false, b_area: false } : {},
  )

  useEffect(() => {
    setColumnVisibility(isMobile ? { owner: false, b_area: false } : {})
  }, [isMobile])

  const memoizedData = useMemo(() => {
    return data.map((data) => withSearchTarget(data))
  }, [data])

  const table = useTable({
    data: memoizedData,
    features: farmTableFeatures,
    columns,
    onSortingChange: setSorting,
    getSubRows: (row) => row.fields as typeof memoizedData,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const result = fuzzysort.go(filterValue, [(row.original as any).searchTarget])
      return result.length > 0
    },
    filterFromLeafRows: true,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
    },
  })

  return (
    <div className="flex h-full w-full flex-col">
      <div className="bg-background sticky top-0 z-10 flex flex-col items-center gap-2 py-4 sm:flex-row">
        <Input
          placeholder="Zoek op naam, gewas of meststof"
          value={globalFilter ?? ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
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
                    b_name_farm: "Naam",
                    owner: "Eigenaar",
                    cultivations: "Gewassen",
                    fertilizerApplications: "Bemesting met:",
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
              table.getRowModel().rows.map((row) => {
                const parentRow = row.getParentRow()
                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      row.original.type === "field" && "bg-muted/50 hover:bg-muted",
                      row.original.type === "field" &&
                        parentRow &&
                        (parentRow.subRows.length === 1
                          ? "shadow-[inset_0_1em_2em_-2em_#00000088,inset_0_-1em_2em_-2em_#00000088]"
                          : row.index === 0
                            ? "shadow-[inset_0_1em_2em_-2em_#00000088]"
                            : row.index === parentRow.subRows.length - 1 &&
                              "shadow-[inset_0_-1em_2em_-2em_#00000088]"),
                    )}
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
                )
              })
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
