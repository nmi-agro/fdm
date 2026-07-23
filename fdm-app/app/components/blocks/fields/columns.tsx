import type { Cultivation, Fertilizer } from "@nmi-agro/fdm-core"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpRightFromSquare, MoreHorizontal } from "lucide-react"
import { NavLink } from "react-router"
import type { BcsColor } from "~/components/blocks/soil-visual/bcs-color-utils"
import type { CultivationSuggestion } from "~/lib/cultivation-suggestion.server"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { FertilizerIcon } from "~/components/custom/fertilizer-icon"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { CultivationSuggestionBadge } from "../cultivation/suggestion"
import { BufferStripCheckbox } from "./buffer-strip-checkbox"
import { DataTableColumnHeader } from "./column-header"

const BCS_BADGE_CLASS: Record<BcsColor, string> = {
  red: "bg-red-100 text-red-700 hover:bg-red-200",
  orange: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  yellow: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
  green: "bg-green-100 text-green-700 hover:bg-green-200",
  emerald: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
}

export type FieldExtended = {
  b_id: string
  b_name: string
  cultivations: Cultivation[]
  cultivationSuggestion?: CultivationSuggestion
  fertilizers: Fertilizer[]
  a_som_loi: number | null
  b_soiltype_agr: string | null
  b_area: number
  b_bufferstrip: boolean
  has_write_permission: boolean
  bcs: {
    a_id: string
    d_bcs: number
    scoreColor: BcsColor
    scoreLabel: string
  } | null
}

export function buildColumns(b_id_farm: string, calendar: string): ColumnDef<FieldExtended>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "b_name",
      enableSorting: true,
      header: ({ column }) => {
        return <DataTableColumnHeader column={column} title="Naam" />
      },
      cell: ({ row }) => {
        const field = row.original

        return (
          <NavLink to={`./${field.b_id}`} className="group flex w-fit items-center hover:underline">
            {field.b_name}
            <ArrowUpRightFromSquare className="ml-2 h-4 w-4 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100" />
          </NavLink>
        )
      },
    },
    {
      accessorKey: "cultivations",
      enableSorting: true,
      sortingFn: (rowA, rowB, _columnId) => {
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
                  backgroundColor: getCultivationColor(cultivation.b_lu_croprotation ?? undefined),
                }}
                className="text-white"
                variant="default"
              >
                {cultivation.b_lu_name}
              </Badge>
            ))}
            {field.cultivationSuggestion && (
              <CultivationSuggestionBadge
                b_id_farm={b_id_farm}
                calendar={calendar}
                b_id={field.b_id}
                suggestion={field.cultivationSuggestion}
              />
            )}
          </div>
        )
      },
      enableHiding: true, // Enable hiding for mobile
    },
    {
      accessorKey: "fertilizerApplications",
      enableSorting: true,
      sortingFn: (rowA, rowB, _columnId) => {
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
              <NavLink
                key={fertilizer.p_id}
                to={`./modify_fertilizer/${fertilizer.p_id}?fieldIds=${row.original.b_id}`}
              >
                <Badge variant="outline" className="text-muted-foreground gap-1">
                  <span>
                    <FertilizerIcon p_type={fertilizer.p_type ?? "other"} />
                  </span>
                  {fertilizer.p_name_nl}
                </Badge>
              </NavLink>
            ))}
          </div>
        )
      },
      enableHiding: true, // Enable hiding for mobile
    },
    {
      accessorKey: "b_bufferstrip",
      header: ({ column }) => {
        return <DataTableColumnHeader column={column} title="Bufferstrook" />
      },
      cell: (props) => <BufferStripCheckbox {...props} />,
      enableHiding: true, // Enable hiding for mobile
    },
    {
      accessorKey: "a_som_loi",
      enableSorting: true,
      sortingFn: "alphanumeric",
      header: ({ column }) => {
        return <DataTableColumnHeader column={column} title="OS" />
      },
      enableHiding: true, // Enable hiding for mobile
      cell: ({ row }) => {
        const field = row.original
        return (
          <p className="text-muted-foreground">
            {field.a_som_loi !== null ? `${field.a_som_loi.toFixed(2)} %` : "-"}
          </p>
        )
      },
    },
    {
      id: "bcs",
      accessorFn: (row) => row.bcs?.d_bcs ?? null,
      enableSorting: true,
      sortingFn: "alphanumeric",
      header: ({ column }) => {
        return <DataTableColumnHeader column={column} title="BCS" />
      },
      enableHiding: true,
      cell: ({ row }) => {
        const field = row.original
        if (!field.bcs) {
          return (
            <NavLink
              to={`./${field.b_id}/bcs/new`}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Nieuwe BCS aanmaken"
            >
              –
            </NavLink>
          )
        }
        return (
          <NavLink to={`./${field.b_id}/bcs/${field.bcs.a_id}`} className="inline-flex">
            <Badge
              className={`tabular-nums ${BCS_BADGE_CLASS[field.bcs.scoreColor]}`}
              variant="secondary"
            >
              {Math.round(field.bcs.d_bcs)}
            </Badge>
          </NavLink>
        )
      },
    },
    {
      accessorKey: "b_soiltype_agr",
      enableSorting: true,
      sortingFn: "alphanumeric",
      header: ({ column }) => {
        return <DataTableColumnHeader column={column} title="Bodemtype" />
      },
      enableHiding: true, // Enable hiding for mobile
      cell: ({ row }) => {
        const field = row.original
        return <p className="text-muted-foreground">{field.b_soiltype_agr}</p>
      },
    },
    {
      accessorKey: "b_area",
      enableSorting: true,
      sortingFn: "alphanumeric",
      header: ({ column }) => {
        return <DataTableColumnHeader column={column} title="Oppervlakte" />
      },
      enableHiding: true, // Enable hiding for mobile
      cell: ({ row }) => {
        const field = row.original
        return (
          <p className="text-muted-foreground">
            {field.b_area < 0.1 ? "< 0.1 ha" : `${field.b_area.toFixed(1)} ha`}
          </p>
        )
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const field = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* <DropdownMenuLabel>Acties</DropdownMenuLabel>
                          <DropdownMenuItem
                              onClick={() =>
                                  navigator.clipboard.writeText(field.b_id)
                              }
                          >
                              Kopieer perceel id
                          </DropdownMenuItem>
                          <DropdownMenuSeparator /> */}
              <DropdownMenuLabel>Gegevens</DropdownMenuLabel>
              <DropdownMenuItem>
                <NavLink to={`./${field.b_id}`}>Overzicht</NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <NavLink to={`./${field.b_id}/cultivation`}>Gewassen</NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <NavLink to={`./${field.b_id}/fertilizer`}>Bemesting</NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <NavLink to={`./${field.b_id}/soil`}>Bodem</NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <NavLink to={`./${field.b_id}/atlas`}>Kaart</NavLink>
              </DropdownMenuItem>
              {field.has_write_permission && (
                <DropdownMenuItem>
                  <NavLink to={`./${field.b_id}/delete`}>Verwijderen</NavLink>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
