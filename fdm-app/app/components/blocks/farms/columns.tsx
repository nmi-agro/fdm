import type { Cultivation, Fertilizer } from "@nmi-agro/fdm-core"
import type { CellContext, ColumnDef } from "@tanstack/react-table"
import { ArrowUpRightFromSquare, ChevronRight } from "lucide-react"
import { NavLink, useParams } from "react-router"
import { cn } from "@/app/lib/utils"
import { DataTableColumnHeader } from "~/components/blocks/data-table/column-header"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { FertilizerIcon } from "~/components/custom/fertilizer-icon"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { farmTableFeatures } from "./table-features"
import { type DisplayUser, UserDisplay } from "./user-display"

export interface FarmExtended {
  type: "farm" | "field"
  b_id_farm: string
  b_name_farm: string | null
  b_area: number | null
  owners?: DisplayUser[]
  /** The groups of the organization this farm belongs to. Field rows carry the groups of their farm. */
  groups?: { b_id_group: string; b_name_group: string }[]
  fields?: FarmExtended[]
  fertilizers: Pick<Fertilizer, "p_id" | "p_name_nl" | "p_type" | "p_type_rvo">[]
  cultivations: Pick<Cultivation, "b_lu_catalogue" | "b_lu_name" | "b_lu_croprotation">[]
}

export const columns: ColumnDef<typeof farmTableFeatures, FarmExtended>[] = [
  {
    id: "Children",
    enableHiding: false,
    header: () => (
      <Button variant="ghost" type="button" className="invisible">
        <ChevronRight />
      </Button>
    ),
    cell: ({ row }) => {
      return row.getCanExpand() ? (
        <button
          type="button"
          onClick={row.getToggleExpandedHandler()}
          style={{ cursor: "pointer" }}
          aria-label={row.getIsExpanded() ? "Klap rij in" : "Klap rij uit"}
          aria-expanded={row.getIsExpanded()}
          title={row.getIsExpanded() ? "Klap rij in" : "Klap rij uit"}
        >
          <ChevronRight
            className={cn(
              "text-muted-foreground transition-transform duration-300",
              row.getIsExpanded() ? "rotate-90" : "transform-none",
            )}
          />
        </button>
      ) : null
    },
  },
  {
    accessorKey: "b_name_farm",
    enableSorting: true,
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Naam" />
    },
    cell: (ctx) => <FarmNameCell {...ctx} />,
  },
  {
    id: "owner",
    accessorKey: "owner.displayUserName",
    enableSorting: true,
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Eigenaar" />
    },
    cell: ({ row }) =>
      row.original.type === "farm" && (
        <UserDisplay
          users={row.original.owners}
          fallback={
            <>
              <div className="invisible h-6 w-6" />
              Onbekend
            </>
          }
        />
      ),
  },
  {
    accessorKey: "cultivations",
    enableSorting: true,
    sortFn: (rowA, rowB, _columnId) => {
      const cultivationA = rowA.original.cultivations[0]?.b_lu_name || ""
      const cultivationB = rowB.original.cultivations[0]?.b_lu_name || ""
      return cultivationA.localeCompare(cultivationB)
    },
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Gewassen" />
    },
    cell: ({ row }) => {
      const field = row.original

      const cultivationsSorted = [...field.cultivations].sort((a, b) =>
        a.b_lu_name.localeCompare(b.b_lu_name),
      )

      return (
        <div className="flex flex-col items-start space-y-2">
          {cultivationsSorted.map((cultivation, idx) => (
            <Badge
              key={`${cultivation.b_lu_name}-${idx}`}
              style={{
                backgroundColor: getCultivationColor(cultivation.b_lu_croprotation || "other"),
              }}
              className="text-white"
              variant="default"
            >
              {cultivation.b_lu_name}
            </Badge>
          ))}
        </div>
      )
    },
    enableHiding: true, // Enable hiding for mobile
  },
  {
    accessorKey: "fertilizers",
    enableSorting: true,
    sortFn: (rowA, rowB, _columnId) => {
      const fertilizerA = rowA.original.fertilizers[0]?.p_name_nl || ""
      const fertilizerB = rowB.original.fertilizers[0]?.p_name_nl || ""
      return fertilizerA.localeCompare(fertilizerB)
    },
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Bemesting met:" />
    },
    cell: ({ row }) => {
      const fertilizers = row.original.fertilizers

      return (
        <div className="flex flex-col items-start space-y-2">
          {fertilizers.map((fertilizer) => (
            <Badge key={fertilizer.p_id} variant="outline" className="text-muted-foreground gap-1">
              <span>
                <FertilizerIcon
                  p_type={fertilizer.p_type ?? "other"}
                  p_type_rvo={fertilizer.p_type_rvo}
                />
              </span>
              {fertilizer.p_name_nl}
            </Badge>
          ))}
        </div>
      )
    },
    enableHiding: true, // Enable hiding for mobile
  },
  {
    accessorKey: "b_area",
    enableSorting: true,
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Oppervlakte" />
    },
    cell: ({ cell }) => (
      <span className="text-muted-foreground">
        {Math.round(10 * (cell.getValue<number>() ?? 0)) / 10} ha
      </span>
    ),
  },
]

/**
 * Column with a checkbox to select farms, used to assign them to groups in bulk.
 * Field rows cannot be selected.
 */
export const selectColumn: ColumnDef<typeof farmTableFeatures, FarmExtended> = {
  id: "select",
  enableSorting: false,
  enableHiding: false,
  header: ({ table }) => (
    <Checkbox
      checked={
        table.getIsAllRowsSelected()
          ? true
          : table.getIsSomeRowsSelected()
            ? "indeterminate"
            : false
      }
      onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
      aria-label="Selecteer alle bedrijven"
    />
  ),
  cell: ({ row }) =>
    row.original.type === "farm" ? (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={`Selecteer ${row.original.b_name_farm ?? "bedrijf"}`}
      />
    ) : null,
}

/**
 * Column with the groups of a farm as neutral badges. Only shown when the organization has groups.
 */
export const groupsColumn: ColumnDef<typeof farmTableFeatures, FarmExtended> = {
  id: "groups",
  accessorFn: (row) => row.groups?.map((group) => group.b_name_group).join(", ") ?? "",
  enableSorting: true,
  header: ({ column }) => <DataTableColumnHeader column={column} title="Groepen" />,
  filterFn: (row, _columnId, filterValue: string[]) =>
    !filterValue ||
    filterValue.length === 0 ||
    (row.original.groups?.some((group) => filterValue.includes(group.b_id_group)) ?? false),
  cell: ({ row }) =>
    row.original.type === "farm" ? (
      <div className="flex flex-wrap items-center gap-1">
        {(row.original.groups ?? []).map((group) => (
          <Badge key={group.b_id_group} variant="secondary">
            {group.b_name_group}
          </Badge>
        ))}
      </div>
    ) : null,
}

function FarmNameCell({ row }: CellContext<typeof farmTableFeatures, FarmExtended, unknown>) {
  const params = useParams()
  const farm = row.original

  return (
    <NavLink
      to={
        row.original.type === "field"
          ? `/farm/${row.getParentRow()?.original.b_id_farm}/${params.calendar}/field/${row.original.b_id_farm}`
          : `/farm/${farm.b_id_farm}`
      }
      className="group flex w-fit items-center hover:underline"
    >
      {farm.b_name_farm ?? "Onbekend"}
      <ArrowUpRightFromSquare className="ml-2 h-4 w-4 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100" />
    </NavLink>
  )
}
