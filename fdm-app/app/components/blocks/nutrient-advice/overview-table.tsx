import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import { ChevronDown, TriangleAlert } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { useIsMobile } from "~/hooks/use-mobile"
import { cn } from "~/lib/utils"
import type { FieldNutrientRow, UnitMode } from "./overview-types"
import type { NutrientDescription } from "./types"
import { buildOverviewColumns, GROUP_LABELS } from "./overview-columns"

// Above this many affected fields, the summary switches to "eerste N + en X andere" instead of
// listing every name, so a farm with many missing-advice fields doesn't produce an unreadable wall of text.
const MAX_ERROR_FIELDS_LISTED = 4

interface NutrientAdviceOverviewTableProps {
  data: FieldNutrientRow[]
  nutrients: NutrientDescription[]
}

export function NutrientAdviceOverviewTable({ data, nutrients }: NutrientAdviceOverviewTableProps) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [search, setSearch] = useState("")
  const [unitMode, setUnitMode] = useState<UnitMode>("per_ha")
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    isMobile
      ? Object.fromEntries(
          nutrients.filter((n) => n.type !== "primary").map((n) => [n.symbol, false]),
        )
      : {},
  )

  const columns = useMemo<ColumnDef<FieldNutrientRow>[]>(
    () => buildOverviewColumns(nutrients, unitMode),
    [nutrients, unitMode],
  )

  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return data
    return data.filter(
      (row) =>
        row.b_name.toLowerCase().includes(term) ||
        (row.mainCultivation?.b_lu_name.toLowerCase().includes(term) ?? false),
    )
  }, [data, search])

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.b_id,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
    },
  })

  const handleRowClick = (row: FieldNutrientRow, event: React.MouseEvent<HTMLTableRowElement>) => {
    const target = event.target
    if (target instanceof Element && target.closest("a,button,[role=button]")) {
      return
    }
    const to = `./${row.b_id}${row.mainCultivation ? `?cultivation=${row.mainCultivation.b_lu}` : ""}`
    navigate(to)
  }

  const nutrientColumns = table.getAllLeafColumns().filter((column) => column.id !== "field")
  const nutrientsBySymbol = useMemo(
    () => new Map(nutrients.map((nutrient) => [nutrient.symbol, nutrient])),
    [nutrients],
  )

  // Surfaced as a static, always-visible summary (not only a per-cell hover tooltip) so the reason
  // is discoverable for keyboard/screen-reader users too, without adding a tab stop to every "–" cell.
  const erroredFields = useMemo(() => data.filter((row) => row.errorMessage), [data])

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {erroredFields.length > 0 ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <TriangleAlert className="h-4 w-4 !text-amber-800" />
          <AlertDescription className="text-amber-800">
            We konden voor {erroredFields.length}{" "}
            {erroredFields.length === 1 ? "perceel" : "percelen"} geen bemestingsadvies berekenen:{" "}
            {erroredFields
              .slice(0, MAX_ERROR_FIELDS_LISTED)
              .map((row) => `${row.b_name} (${row.errorMessage})`)
              .join(", ")}
            {erroredFields.length > MAX_ERROR_FIELDS_LISTED
              ? ` en ${erroredFields.length - MAX_ERROR_FIELDS_LISTED} andere.`
              : "."}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="bg-background sticky top-0 z-10 flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Zoek op perceel of gewas"
          aria-label="Zoek op perceel of gewas"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full sm:w-64"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={unitMode} onValueChange={(value) => setUnitMode(value as UnitMode)}>
            <TabsList>
              <TabsTrigger value="per_ha">Per ha</TabsTrigger>
              <TabsTrigger value="total">Totaal</TabsTrigger>
            </TabsList>
          </Tabs>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Bekijk
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
              {(["primary", "secondary", "trace"] as const).map((type, index) => (
                <div key={type}>
                  {index > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuLabel>{GROUP_LABELS[type]}</DropdownMenuLabel>
                  {nutrientColumns
                    .filter((column) => nutrientsBySymbol.get(column.id)?.type === type)
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {nutrientsBySymbol.get(column.id)?.name ?? column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="relative grow overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className="bg-background sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn("text-right", {
                      "bg-background sticky left-0 z-20 text-left": header.column.id === "field",
                      "border-l-2": header.column.columnDef.meta?.groupStart,
                    })}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
            {/* Farm-level totals, pinned at the top (inside the sticky header) instead of a footer, so they stay visible while scrolling through fields. */}
            {table.getRowModel().rows?.length
              ? table.getFooterGroups().map((footerGroup) => (
                  <TableRow key={footerGroup.id} className="bg-muted/50">
                    {footerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn("text-right font-medium", {
                          // Opaque (not /50) so scrolled-under nutrient columns don't bleed through the pinned cell.
                          "bg-muted sticky left-0 z-20 text-left": header.column.id === "field",
                          "border-l-2": header.column.columnDef.meta?.groupStart,
                        })}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.footer, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))
              : null}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={(event) => handleRowClick(row.original, event)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn({
                        "bg-background sticky left-0 z-10": cell.column.id === "field",
                        "border-l-2": cell.column.columnDef.meta?.groupStart,
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
                  colSpan={table.getVisibleLeafColumns().length}
                  className="text-muted-foreground h-24 text-center"
                >
                  Geen percelen gevonden voor "{search}".
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
