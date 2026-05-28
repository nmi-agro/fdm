import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpRightFromSquare } from "lucide-react"
import { Link } from "react-router"
import { DataTableColumnHeader } from "~/components/blocks/fields/column-header"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import { Checkbox } from "~/components/ui/checkbox"

export type FieldSummaryRow = {
    b_id: string
    b_name: string | null
    b_area: number | null
    b_bufferstrip: boolean
    mainCultivation: {
        b_lu_name: string | null
        b_lu_croprotation: string | null
    } | null
    measures: { m_name: string }[]
    /** href to the field's measures detail page */
    href: string
}

export function getFieldSummaryColumns(): ColumnDef<FieldSummaryRow>[] {
    return [
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
                    aria-label="Selecteer alles"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Selecteer rij"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "b_name",
            enableSorting: true,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Perceel" />
            ),
            cell: ({ row }) => (
                <Link
                    to={row.original.href}
                    className="group flex items-center gap-1.5 hover:underline font-medium w-fit"
                >
                    {row.original.b_name ?? row.original.b_id}
                    {row.original.b_bufferstrip && (
                        <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400">
                            Bufferstrook
                        </span>
                    )}
                    <ArrowUpRightFromSquare className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
            ),
        },
        {
            accessorKey: "mainCultivation",
            enableSorting: true,
            sortingFn: (a, b) => {
                const nameA = a.original.mainCultivation?.b_lu_name ?? ""
                const nameB = b.original.mainCultivation?.b_lu_name ?? ""
                return nameA.localeCompare(nameB, "nl")
            },
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Gewas" />
            ),
            cell: ({ row }) => {
                const cult = row.original.mainCultivation
                if (!cult?.b_lu_name) {
                    return (
                        <span className="text-xs text-muted-foreground">—</span>
                    )
                }
                return (
                    <Badge
                        style={{
                            backgroundColor: getCultivationColor(
                                cult.b_lu_croprotation ?? undefined,
                            ),
                        }}
                        className="text-white text-xs"
                    >
                        {cult.b_lu_name}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "b_area",
            enableSorting: true,
            sortingFn: "basic",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Oppervlakte" />
            ),
            cell: ({ row }) => {
                const area = row.original.b_area
                if (area == null)
                    return <span className="text-muted-foreground">—</span>
                return (
                    <span className="text-muted-foreground tabular-nums">
                        {area < 0.1 ? "< 0,1 ha" : `${area.toFixed(1)} ha`}
                    </span>
                )
            },
        },
        {
            id: "measureCount",
            accessorFn: (row) => row.measures.length,
            enableSorting: true,
            sortingFn: "basic",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Maatregelen" />
            ),
            cell: ({ row }) => {
                const measures = row.original.measures
                if (measures.length === 0) {
                    return (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
                            Geen
                        </span>
                    )
                }
                return (
                    <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 w-fit">
                            {measures.length} maatregel
                            {measures.length === 1 ? "" : "en"}
                        </span>
                        {measures.slice(0, 2).map((m, i) => (
                            <span
                                key={i}
                                className="text-xs text-muted-foreground"
                            >
                                · {m.m_name}
                            </span>
                        ))}
                        {measures.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                                + {measures.length - 2} meer
                            </span>
                        )}
                    </div>
                )
            },
        },
    ]
}
