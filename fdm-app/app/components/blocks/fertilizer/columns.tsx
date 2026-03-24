import type { ColumnDef } from "@tanstack/react-table"
import { Pencil } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { DataTableColumnHeader } from "./column-header"

export type Fertilizer = {
    p_id: string
    p_name_nl: string
    p_dm?: number | null
    p_density?: number | null
    p_om?: number | null
    p_n_rt?: number | null
    p_p_rt?: number | null
    p_k_rt?: number | null
    p_mg_rt?: number | null
    p_ca_rt?: number | null
    p_na_rt?: number | null
    p_s_rt?: number | null
    p_cu_rt?: number | null
    p_zn_rt?: number | null
    p_b_rt?: number | null
    p_mn_rt?: number | null
    p_ni_rt?: number | null
    p_fe_rt?: number | null
    p_mo_rt?: number | null
    p_co_rt?: number | null
    p_as_rt?: number | null
    p_cd_rt?: number | null
    p_cr_rt?: number | null
    p_cr_vi?: number | null
    p_pb_rt?: number | null
    p_hg_rt?: number | null
    p_cl_rt?: number | null
    p_eoc?: number | null
    p_n_wc?: number | null
    p_type_rvo?: string | null
    p_type_rvo_label?: string | null
    p_type?: "manure" | "compost" | "mineral" | null
    p_source?: string
    is_custom?: boolean
}

function formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return "-"
    return new Intl.NumberFormat("nl-NL", {
        maximumFractionDigits: 2,
    }).format(value)
}

function formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) return "-"
    return new Intl.NumberFormat("nl-NL", {
        style: "percent",
        maximumFractionDigits: 0,
    }).format(value)
}

export const columns: ColumnDef<Fertilizer>[] = [
    {
        accessorKey: "p_name_nl",
        header: "Naam",
        cell: ({ row }) => {
            const isCustom = row.original.is_custom
            return (
                <div className="flex items-center gap-2">
                    <span className="font-medium">
                        {row.original.p_name_nl}
                    </span>
                    {isCustom && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge
                                        variant="outline"
                                        className="px-1 py-0 h-5"
                                    >
                                        <Pencil className="h-3 w-3 text-muted-foreground" />
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Eigen meststof</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            )
        },
    },
    {
        accessorKey: "p_n_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="N (g/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_n_rt),
    },
    {
        accessorKey: "p_n_wc",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="N-werk." />
        },
        cell: ({ row }) => formatPercent(row.original.p_n_wc),
    },
    {
        accessorKey: "p_p_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="P₂O₅ (g/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_p_rt),
    },
    {
        accessorKey: "p_k_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="K₂O (g/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_k_rt),
    },
    {
        accessorKey: "p_dm",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="DS (g/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_dm),
    },
    {
        accessorKey: "p_om",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="OS (g/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_om),
    },
    {
        accessorKey: "p_mg_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="MgO (g/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_mg_rt),
    },
    {
        accessorKey: "p_ca_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="CaO (g/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_ca_rt),
    },
    {
        accessorKey: "p_na_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Na₂O (g/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_na_rt),
    },
    {
        accessorKey: "p_s_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="SO₃ (g/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_s_rt),
    },
    {
        accessorKey: "p_cu_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Cu (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_cu_rt),
    },
    {
        accessorKey: "p_zn_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Zn (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_zn_rt),
    },
    {
        accessorKey: "p_b_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="B (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_b_rt),
    },
    {
        accessorKey: "p_mn_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Mn (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_mn_rt),
    },
    {
        accessorKey: "p_ni_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Ni (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_ni_rt),
    },
    {
        accessorKey: "p_fe_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Fe (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_fe_rt),
    },
    {
        accessorKey: "p_mo_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Mo (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_mo_rt),
    },
    {
        accessorKey: "p_co_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Co (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_co_rt),
    },
    {
        accessorKey: "p_as_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="As (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_as_rt),
    },
    {
        accessorKey: "p_cd_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Cd (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_cd_rt),
    },
    {
        accessorKey: "p_cr_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Cr (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_cr_rt),
    },
    {
        accessorKey: "p_cr_vi",
        header: ({ column }) => {
            return (
                <DataTableColumnHeader column={column} title="Cr-VI (mg/kg)" />
            )
        },
        cell: ({ row }) => formatNumber(row.original.p_cr_vi),
    },
    {
        accessorKey: "p_pb_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Pb (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_pb_rt),
    },
    {
        accessorKey: "p_hg_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Hg (mg/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_hg_rt),
    },
    {
        accessorKey: "p_cl_rt",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Cl (g/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_cl_rt),
    },
    {
        accessorKey: "p_eoc",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="EOC (g/kg)" />
        },
        cell: ({ row }) => formatNumber(row.original.p_eoc),
    },
    {
        accessorKey: "p_type_rvo",
        header: ({ column }) => {
            return (
                <DataTableColumnHeader column={column} title="Mestcode (RVO)" />
            )
        },
        cell: ({ row }) => {
            const fertilizer = row.original
            if (!fertilizer.p_type_rvo) {
                return null
            }
            const p_type = fertilizer.p_type
            const rawLabel = fertilizer.p_type_rvo_label?.trim() ?? ""
            const displayLabel = rawLabel || fertilizer.p_type_rvo || "Onbekend"
            const MAX_LABEL_LEN = 48
            const isTruncated = displayLabel.length > MAX_LABEL_LEN
            const truncatedLabel = isTruncated
                ? `${displayLabel.substring(0, MAX_LABEL_LEN)}...`
                : displayLabel

            const badge = (
                <Badge
                    className={
                        p_type === "manure"
                            ? "bg-amber-600 text-white hover:bg-amber-700"
                            : p_type === "compost"
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : p_type === "mineral"
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-gray-600 text-white hover:bg-gray-700"
                    }
                    variant="outline"
                >
                    <p>{truncatedLabel}</p>
                </Badge>
            )

            return (
                <span className="flex items-center gap-2">
                    {isTruncated ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>{badge}</TooltipTrigger>
                                <TooltipContent>
                                    <p>{displayLabel}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        badge
                    )}
                </span>
            )
        },
    },
]
