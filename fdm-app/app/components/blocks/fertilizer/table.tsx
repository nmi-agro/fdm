import {
  type ColumnFiltersState,
  FlexRender,
  RowData,
  type SortingState,
  useTable,
} from "@tanstack/react-table"
import { Plus } from "lucide-react"
import { useState } from "react"
import { NavLink } from "react-router"
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
import { cn } from "~/lib/utils"
import type { columns as ColumnsT, Fertilizer } from "./columns"
import { fertilizerTableFeatures } from "./table-features"

interface DataTableProps<TData extends RowData> {
  columns: typeof ColumnsT
  data: TData[]
  canAddItem: boolean
}

export function DataTable<TData extends Fertilizer>({
  columns,
  data,
  canAddItem,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    p_dm: false,
    p_om: false,
    p_n_wc: false,
    p_mg_rt: false,
    p_ca_rt: false,
    p_na_rt: false,
    p_s_rt: false,
    p_cu_rt: false,
    p_zn_rt: false,
    p_b_rt: false,
    p_mn_rt: false,
    p_ni_rt: false,
    p_fe_rt: false,
    p_mo_rt: false,
    p_co_rt: false,
    p_as_rt: false,
    p_cd_rt: false,
    p_cr_rt: false,
    p_cr_vi: false,
    p_pb_rt: false,
    p_hg_rt: false,
    p_cl_rt: false,
  })

  const table = useTable({
    data,
    features: fertilizerTableFeatures,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  })

  const columnLabels: Record<string, string> = {
    p_name_nl: "Naam",
    p_n_rt: "N (Stikstof)",
    p_n_wc: "N-werk. (N-werkingscoëfficiënt)",
    p_p_rt: "P₂O₅ (Fosfaat)",
    p_k_rt: "K₂O (Kalium)",
    p_dm: "DS (Droge stof)",
    p_om: "OS (Organische stof)",
    p_mg_rt: "MgO (Magnesium)",
    p_ca_rt: "CaO (Calcium)",
    p_na_rt: "Na₂O (Natrium)",
    p_s_rt: "SO₃ (Zwavel)",
    p_cu_rt: "Cu (Koper)",
    p_zn_rt: "Zn (Zink)",
    p_b_rt: "B (Borium)",
    p_mn_rt: "Mn (Mangaan)",
    p_ni_rt: "Ni (Nikkel)",
    p_fe_rt: "Fe (IJzer)",
    p_mo_rt: "Mo (Molybdeen)",
    p_co_rt: "Co (Kobalt)",
    p_as_rt: "As (Arseen)",
    p_cd_rt: "Cd (Cadmium)",
    p_cr_rt: "Cr (Chroom)",
    p_cr_vi: "Cr-VI (Chroom-VI)",
    p_pb_rt: "Pb (Lood)",
    p_hg_rt: "Hg (Kwik)",
    p_cl_rt: "Cl (Chloor)",
    p_eoc: "EOC (Effectieve OS)",
    p_type_rvo: "Mestcode (RVO)",
  }

  return (
    <div>
      <div className="flex items-center gap-4 py-4">
        <Input
          placeholder="Filter meststoffen..."
          value={(table.getColumn("p_name_nl")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("p_name_nl")?.setFilterValue(event.target.value)}
          className="flex-1"
        />
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Kolommen</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-100 overflow-y-auto">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide() && column.id !== "p_name_nl")
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {columnLabels[column.id] || column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className={cn(!canAddItem ? "hidden" : "")}>
            <Button asChild>
              <NavLink to={"./new"}>
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Meststof toevoegen</span>
                <span className="sm:hidden">Toevoegen</span>
              </NavLink>
            </Button>
          </div>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
                const fertilizer = row.original
                const p_id = fertilizer.p_id
                const p_name = fertilizer.p_name_nl || "Onbekende meststof"

                return (
                  <TableRow key={row.id} className="hover:bg-muted/50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {cell.column.id === "p_name_nl" && p_id ? (
                          <NavLink
                            to={`./${p_id}`}
                            className="focus-visible:ring-ring block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                            aria-label={`Bekijk details van ${p_name}`}
                          >
                            <FlexRender cell={cell} />
                          </NavLink>
                        ) : (
                          <FlexRender cell={cell} />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
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
