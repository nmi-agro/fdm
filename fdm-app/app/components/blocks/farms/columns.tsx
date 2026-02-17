import type { Cultivation, Fertilizer } from "@svenvw/fdm-core"
import type { ColumnDef } from "@tanstack/react-table"
import {
    ArrowUpRightFromSquare,
    ChevronRight,
    Circle,
    Diamond,
    Square,
    Triangle,
} from "lucide-react"
import { NavLink, useParams } from "react-router-dom"
import { cn } from "@/app/lib/utils"
import { DataTableColumnHeader } from "~/components/blocks/fields/column-header"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "../../ui/button"

export interface FarmExtended {
    type: "farm" | "field"
    b_id_farm: string
    b_name_farm: string | null
    b_area: number | null
    owner?: {
        displayUserName: string | null
        image: string | null
        initials: string | null
    } | null
    fields?: FarmExtended[]
    fertilizers: Pick<Fertilizer, "p_id" | "p_name_nl" | "p_type">[]
    cultivations: Pick<
        Cultivation,
        "b_lu_catalogue" | "b_lu_name" | "b_lu_croprotation"
    >[]
}

export const columns: ColumnDef<FarmExtended>[] = [
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
                    aria-label={
                        row.getIsExpanded() ? "Klap rij in" : "Klap rij uit"
                    }
                    title={row.getIsExpanded() ? "Klap rij in" : "Klap rij uit"}
                >
                    <ChevronRight
                        className={cn(
                            "transition-transform duration-300 text-muted-foreground",
                            row.getIsExpanded()
                                ? "rotate-90"
                                : "transform-none",
                        )}
                    />
                </button>
            ) : (
                ""
            )
        },
    },
    {
        accessorKey: "b_name_farm",
        enableSorting: true,
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Naam" />
        },
        cell: ({ row }) => {
            const params = useParams()
            const farm = row.original

            return (
                <NavLink
                    to={
                        row.original.type === "field"
                            ? `/farm/${row.getParentRow()?.original.b_id_farm}/${params.calendar}/field/${row.original.b_id_farm}`
                            : `/farm/${farm.b_id_farm}`
                    }
                    className="group flex items-center hover:underline w-fit"
                >
                    {farm.b_name_farm ?? "Onbekend"}
                    <ArrowUpRightFromSquare className="ml-2 h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </NavLink>
            )
        },
    },
    {
        id: "owner",
        accessorKey: "owner.displayUserName",
        enableSorting: true,
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Eigenaar" />
        },
        cell: ({ row }) => {
            const owner = row.original.owner
            if (row.original.type !== "farm") return
            return (
                <div className="flex flex-row items-center text-muted-foreground gap-2">
                    {owner ? (
                        <>
                            <Avatar className="h-6 w-6 rounded-lg">
                                <AvatarImage
                                    src={owner.image ?? undefined}
                                    alt={owner.displayUserName ?? undefined}
                                />
                                <AvatarFallback>
                                    {owner.initials}
                                </AvatarFallback>
                            </Avatar>
                            {owner.displayUserName}
                        </>
                    ) : (
                        <>
                            <div className="h-6 w-6 invisible" />
                            Onbekend
                        </>
                    )}
                </div>
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
                                    cultivation.b_lu_croprotation || "other",
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
        accessorKey: "fertilizers",
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
                        <Badge
                            key={fertilizer.p_id}
                            variant="outline"
                            className="text-muted-foreground gap-1"
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
