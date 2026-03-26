import type { ColumnDef } from "@tanstack/react-table"
import {
    ArrowUpRightFromSquare,
    Circle,
    Diamond,
    MoreHorizontal,
    Square,
    Triangle,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
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
import { DataTableColumnHeader } from "./column-header"
import { BufferStripCheckbox } from "./buffer-strip-checkbox"

export type FieldExtended = {
    b_id: string
    b_name: string
    cultivations: {
        b_lu_name: string
        b_lu_croprotation: string
        b_lu_start: Date
    }[]
    fertilizers: {
        p_name_nl: string
        p_id: string
        p_type: string
    }[]
    a_som_loi: number
    b_soiltype_agr: string
    b_area: number
    b_bufferstrip: boolean
    has_write_permission: boolean
}

export const columns: ColumnDef<FieldExtended>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) =>
                    table.toggleAllPageRowsSelected(!!value)
                }
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
                <NavLink
                    to={`./${field.b_id}`}
                    className="group flex items-center hover:underline w-fit"
                >
                    {field.b_name}
                    <ArrowUpRightFromSquare className="ml-2 h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                <div className="flex items-start flex-col space-y-2">
                    {cultivationsSorted.map((cultivation, idx) => (
                        <Badge
                            key={`${cultivation.b_lu_name}-${idx}`}
                            style={{
                                backgroundColor: getCultivationColor(
                                    cultivation.b_lu_croprotation,
                                ),
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
        accessorKey: "fertilizerApplications",
        enableSorting: true,
        sortingFn: (rowA, rowB, _columnId) => {
            const fertilizerA = rowA.original.fertilizers[0]?.p_name_nl || ""
            const fertilizerB = rowB.original.fertilizers[0]?.p_name_nl || ""
            return fertilizerA.localeCompare(fertilizerB)
        },
        header: ({ column }) => {
            return (
                <DataTableColumnHeader column={column} title="Bemesting met:" />
            )
        },
        cell: ({ row }) => {
            const fertilizers = row.original.fertilizers

            return (
                <div className="flex items-start flex-col space-y-2">
                    {fertilizers.map((fertilizer) => (
                        <NavLink
                            key={fertilizer.p_id}
                            to={`./modify_fertilizer/${fertilizer.p_id}?fieldIds=${row.original.b_id}`}
                        >
                            <Badge
                                variant="outline"
                                className="gap-1 text-muted-foreground"
                            >
                                <span>
                                    {fertilizer.p_type === "manure" ? (
                                        <Square className="size-3 text-yellow-600 fill-yellow-600" />
                                    ) : fertilizer.p_type === "mineral" ? (
                                        <Circle className="size-3 text-sky-600 fill-sky-600" />
                                    ) : fertilizer.p_type === "compost" ? (
                                        <Triangle className="size-3 text-green-600 fill-green-600" />
                                    ) : (
                                        <Diamond className="size-3 text-gray-600 fill-gray-600" />
                                    )}
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
            return (
                <DataTableColumnHeader column={column} title="Bufferstrook" />
            )
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
                    {field.a_som_loi !== null && field.a_som_loi !== undefined
                        ? `${field.a_som_loi.toFixed(2)} %`
                        : "-"}
                </p>
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
            return (
                <p className="text-muted-foreground">{field.b_soiltype_agr}</p>
            )
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
                    {field.b_area < 0.1
                        ? "< 0.1 ha"
                        : `${field.b_area.toFixed(1)} ha`}
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
                            <NavLink to={`./${field.b_id}/cultivation`}>
                                Gewassen
                            </NavLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <NavLink to={`./${field.b_id}/fertilizer`}>
                                Bemesting
                            </NavLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <NavLink to={`./${field.b_id}/soil`}>Bodem</NavLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <NavLink to={`./${field.b_id}/atlas`}>
                                Kaart
                            </NavLink>
                        </DropdownMenuItem>
                        {field.has_write_permission && (
                            <DropdownMenuItem>
                                <NavLink to={`./${field.b_id}/delete`}>
                                    Verwijderen
                                </NavLink>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
