import type {
    ImportReviewAction,
    RvoImportReviewItem,
    UserChoiceMap,
} from "@nmi-agro/fdm-rvo/types"
import { getItemId } from "@nmi-agro/fdm-rvo/utils"
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { area } from "@turf/area"
import { format, parseISO } from "date-fns"
import { Archive, ArrowLeftRight, Check, Plus, Trash2, X } from "lucide-react"
import { useMemo } from "react"
import { clientConfig } from "@/app/lib/config"
import { Badge } from "~/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { acquiringMethodOptions } from "~/lib/constants"
import { cn } from "~/lib/utils"

declare module "@tanstack/react-table" {
    interface TableMeta<TData extends object> {
        userChoices: UserChoiceMap
        onChoiceChange: (id: string, action: ImportReviewAction) => void
    }
}

interface RvoImportReviewTableProps {
    data: RvoImportReviewItem<any>[]
    userChoices: UserChoiceMap
    onChoiceChange: (id: string, action: ImportReviewAction) => void
}

function formatDate(dateString?: string | Date) {
    if (!dateString) return "-"
    try {
        const date =
            typeof dateString === "string" ? parseISO(dateString) : dateString
        return format(date, "dd-MM-yyyy")
    } catch {
        return dateString.toString()
    }
}

function formatArea(geometry: any) {
    if (!geometry) return "-"
    const a = area(geometry)
    return `${(a / 10000).toFixed(2)} ha`
}

// Helper to render diff cells
const DiffCell = ({
    local,
    remote,
    status,
    action,
    formatter = (v: any) => v,
}: {
    local?: any
    remote?: any
    status: string
    action: ImportReviewAction
    formatter?: (v: any) => React.ReactNode
}) => {
    // If MATCH, just show one value
    if (status === "MATCH") {
        return (
            <span className="text-sm text-foreground">{formatter(local)}</span>
        )
    }

    // NEW REMOTE -> Show remote without badge
    if (status === "NEW_REMOTE") {
        return (
            <span className="text-sm font-medium text-muted-foreground">
                {formatter(remote)}
            </span>
        )
    }

    // NEW LOCAL -> Show local without badge
    if (status === "NEW_LOCAL" || status === "EXPIRED_LOCAL") {
        return (
            <span className="text-sm font-medium text-muted-foreground">
                {formatter(local)}
            </span>
        )
    }

    // CONFLICT
    if (status === "CONFLICT") {
        // If values are effectively equal (deep check), show one
        if (JSON.stringify(local) === JSON.stringify(remote)) {
            return (
                <span className="text-sm text-foreground">
                    {formatter(local)}
                </span>
            )
        }

        const useRemote =
            action === "UPDATE_FROM_REMOTE" || action === "ADD_REMOTE"
        const useLocal = action === "KEEP_LOCAL"

        return (
            <div className="flex flex-col gap-1.5">
                {local !== undefined && (
                    <div
                        className={cn(
                            "flex items-center gap-2",

                            useRemote && "opacity-70",
                        )}
                    >
                        <Badge
                            variant="outline"
                            className="h-5 px-1 text-[10px] text-muted-foreground border-border min-w-[45px] justify-center"
                        >
                            {clientConfig.name}
                        </Badge>

                        <span
                            className={cn(
                                "text-sm",

                                useRemote &&
                                    "line-through decoration-muted-foreground/50 text-muted-foreground",

                                useLocal && "font-bold",
                            )}
                        >
                            {formatter(local)}
                        </span>
                    </div>
                )}

                {remote !== undefined && (
                    <div
                        className={cn(
                            "flex items-center gap-2",

                            useLocal && "opacity-70",
                        )}
                    >
                        <Badge
                            variant="outline"
                            className="h-5 px-1 text-[10px] text-blue-700 bg-blue-50 border-blue-200 min-w-[45px] justify-center"
                        >
                            RVO
                        </Badge>

                        <span
                            className={cn(
                                "text-sm",

                                useLocal &&
                                    "line-through decoration-muted-foreground/50 text-muted-foreground",

                                useRemote && "font-bold",
                            )}
                        >
                            {formatter(remote)}
                        </span>
                    </div>
                )}
            </div>
        )
    }

    return null
}

export const columns: ColumnDef<RvoImportReviewItem<any>>[] = [
    {
        accessorKey: "status",
        header: () => (
            <Tooltip>
                <TooltipTrigger>Status</TooltipTrigger>
                <TooltipContent>
                    Geeft de vergelijkingsstatus weer tussen {clientConfig.name}{" "}
                    en RVO.
                </TooltipContent>
            </Tooltip>
        ),
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            switch (status) {
                case "MATCH":
                    return (
                        <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200"
                        >
                            <Tooltip>
                                <TooltipTrigger>Gelijk</TooltipTrigger>
                                <TooltipContent>
                                    Perceel komt in {clientConfig.name} en bij
                                    RVO volledig overeen.
                                </TooltipContent>
                            </Tooltip>
                        </Badge>
                    )
                case "NEW_REMOTE":
                    return (
                        <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                            <Tooltip>
                                <TooltipTrigger>Nieuw (RVO)</TooltipTrigger>
                                <TooltipContent>
                                    Perceel bestaat bij RVO, maar niet in{" "}
                                    {clientConfig.name}.
                                </TooltipContent>
                            </Tooltip>
                        </Badge>
                    )
                case "NEW_LOCAL":
                    return (
                        <Badge
                            variant="outline"
                            className="bg-yellow-50 text-yellow-700 border-yellow-200"
                        >
                            <Tooltip>
                                <TooltipTrigger>
                                    Nieuw ( {clientConfig.name})
                                </TooltipTrigger>
                                <TooltipContent>
                                    Perceel bestaat in {clientConfig.name}, maar
                                    niet bij RVO.
                                </TooltipContent>
                            </Tooltip>
                        </Badge>
                    )
                case "EXPIRED_LOCAL":
                    return (
                        <Badge
                            variant="outline"
                            className="bg-orange-50 text-orange-700 border-orange-200"
                        >
                            <Tooltip>
                                <TooltipTrigger>
                                    Niet meer actief
                                </TooltipTrigger>
                                <TooltipContent>
                                    Perceel is in {clientConfig.name} nog
                                    actief, maar komt niet meer voor bij RVO.
                                </TooltipContent>
                            </Tooltip>
                        </Badge>
                    )
                case "CONFLICT":
                    return (
                        <Badge
                            variant="destructive"
                            className="bg-red-50 text-red-700 border-red-200"
                        >
                            <Tooltip>
                                <TooltipTrigger>Verschil</TooltipTrigger>
                                <TooltipContent>
                                    Perceel bestaat in beide, maar met
                                    verschillende gegevens.
                                </TooltipContent>
                            </Tooltip>
                        </Badge>
                    )
                default:
                    return <Badge variant="secondary">{status}</Badge>
            }
        },
    },
    {
        id: "perceel",
        header: () => (
            <Tooltip>
                <TooltipTrigger>Perceel</TooltipTrigger>
                <TooltipContent>
                    De naam en het RVO ID van het perceel.
                </TooltipContent>
            </Tooltip>
        ),
        cell: ({ row, table }) => {
            const item = row.original
            const id = getItemId(item)
            const { userChoices } = table.options.meta!
            const action = userChoices[id] as ImportReviewAction

            return (
                <DiffCell
                    local={item.localField?.b_name}
                    remote={item.rvoField?.properties.CropFieldDesignator}
                    status={item.status}
                    action={action}
                    formatter={(val) => (
                        <span className="font-medium">{val || "Naamloos"}</span>
                    )}
                />
            )
        },
    },
    {
        id: "oppervlakte",
        header: () => (
            <Tooltip>
                <TooltipTrigger>Oppervlakte</TooltipTrigger>
                <TooltipContent>
                    De oppervlakte van het perceel in hectaren.
                </TooltipContent>
            </Tooltip>
        ),
        cell: ({ row, table }) => {
            const item = row.original
            const id = getItemId(item)
            const { userChoices } = table.options.meta!
            const action = userChoices[id] as ImportReviewAction

            const localArea = item.localField
                ? `${(item.localField.b_area ?? 0).toFixed(2)} ha`
                : undefined
            const remoteArea = item.rvoField
                ? formatArea(item.rvoField.geometry)
                : undefined

            return (
                <DiffCell
                    local={localArea}
                    remote={remoteArea}
                    status={item.status}
                    action={action}
                />
            )
        },
    },
    {
        id: "gewas",
        header: () => (
            <Tooltip>
                <TooltipTrigger>Gewas</TooltipTrigger>
                <TooltipContent>
                    Het gewas dat op 15 mei wordt geteeld.
                </TooltipContent>
            </Tooltip>
        ),
        cell: ({ row, table }) => {
            const item = row.original
            const id = getItemId(item)
            const { userChoices } = table.options.meta!
            const action = userChoices[id] as ImportReviewAction

            return (
                <DiffCell
                    local={item.localCultivation?.b_lu_name}
                    remote={item.rvoCultivation?.b_lu_name}
                    status={item.status}
                    action={action}
                    formatter={(val) => val || "-"}
                />
            )
        },
    },
    {
        id: "ingangsdatum",
        header: () => (
            <Tooltip>
                <TooltipTrigger>Ingangsdatum</TooltipTrigger>
                <TooltipContent>
                    De datum vanaf wanneer het perceel actief is.
                </TooltipContent>
            </Tooltip>
        ),
        cell: ({ row, table }) => {
            const item = row.original
            const id = getItemId(item)
            const { userChoices } = table.options.meta!
            const action = userChoices[id] as ImportReviewAction

            return (
                <DiffCell
                    local={formatDate(item.localField?.b_start)}
                    remote={formatDate(item.rvoField?.properties.BeginDate)}
                    status={item.status}
                    action={action}
                />
            )
        },
    },
    {
        id: "einddatum",
        header: () => (
            <Tooltip>
                <TooltipTrigger>Einddatum</TooltipTrigger>
                <TooltipContent>
                    De datum waarop het perceel niet meer actief is.
                </TooltipContent>
            </Tooltip>
        ),
        cell: ({ row, table }) => {
            const item = row.original
            const id = getItemId(item)
            const { userChoices } = table.options.meta!
            const action = userChoices[id] as ImportReviewAction

            return (
                <DiffCell
                    local={
                        item.localField?.b_end
                            ? formatDate(item.localField.b_end)
                            : undefined
                    }
                    remote={
                        item.rvoField?.properties.EndDate
                            ? formatDate(item.rvoField.properties.EndDate)
                            : undefined
                    }
                    status={item.status}
                    action={action}
                    formatter={(val) => val || "-"}
                />
            )
        },
    },
    {
        id: "gebruikstitel",
        header: () => (
            <Tooltip>
                <TooltipTrigger>Gebruikstitel</TooltipTrigger>
                <TooltipContent>
                    De vorm van gebruikstitel (bv. eigendom, pacht).
                </TooltipContent>
            </Tooltip>
        ),
        cell: ({ row, table }) => {
            const item = row.original
            const id = getItemId(item)
            const { userChoices } = table.options.meta!
            const action = userChoices[id] as ImportReviewAction

            // Map RVO code to label using FDM dictionary
            const rvoCode = item.rvoField?.properties.UseTitleCode
            const rvoLabel = rvoCode
                ? acquiringMethodOptions.find(
                      (opt) => opt.value === `nl_${rvoCode}`,
                  )?.label || rvoCode
                : undefined

            // Map local acquiring method to label (simplified)
            const localMethod = item.localField?.b_acquiring_method
            // Assuming localMethod is english enum like 'purchase', 'lease'. Map to NL for consistency
            const localLabel =
                acquiringMethodOptions.find((opt) => opt.value === localMethod)
                    ?.label || localMethod

            return (
                <DiffCell
                    local={localLabel}
                    remote={rvoLabel}
                    status={item.status}
                    action={action}
                    formatter={(val) => val || "-"}
                />
            )
        },
    },
    {
        id: "bufferstrook",
        header: () => (
            <Tooltip>
                <TooltipTrigger>Bufferstrook</TooltipTrigger>
                <TooltipContent>
                    Geeft aan of het perceel bij RVO geregistreerd staat als
                    bufferstrook.
                </TooltipContent>
            </Tooltip>
        ),
        cell: ({ row, table }) => {
            const item = row.original
            const { userChoices } = table.options.meta!
            const action = userChoices[getItemId(item)] as ImportReviewAction

            const rvoBufferstrip =
                item.rvoField?.properties.mestData?.IndBufferstrook
            const rvoLabel =
                rvoBufferstrip === undefined
                    ? undefined
                    : rvoBufferstrip === "J"
                      ? "Ja"
                      : "Nee"

            const localLabel =
                item.localField?.b_bufferstrip === undefined
                    ? undefined
                    : item.localField.b_bufferstrip
                      ? "Ja"
                      : "Nee"

            return (
                <DiffCell
                    local={localLabel}
                    remote={rvoLabel}
                    status={item.status}
                    action={action}
                    formatter={(val) => val ?? "-"}
                />
            )
        },
    },
    {
        id: "actions",
        header: () => (
            <Tooltip>
                <TooltipTrigger>Actie</TooltipTrigger>
                <TooltipContent>
                    Kies welke actie moet worden uitgevoerd voor dit perceel.
                </TooltipContent>
            </Tooltip>
        ),
        cell: ({ row, table }) => {
            const item = row.original
            const id = getItemId(item)
            const { userChoices, onChoiceChange } = table.options.meta!
            const currentChoice = userChoices[id] as ImportReviewAction

            if (item.status === "MATCH") {
                return (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                        <Check className="h-4 w-4" />
                        <span>Aanwezig</span>
                    </div>
                )
            }

            return (
                <Select
                    value={currentChoice}
                    onValueChange={(val) =>
                        onChoiceChange(id, val as ImportReviewAction)
                    }
                >
                    <SelectTrigger className="w-[180px] h-8 text-xs z-10">
                        <SelectValue placeholder="Kies actie" />
                    </SelectTrigger>
                    <SelectContent>
                        {item.status === "NEW_REMOTE" && (
                            <>
                                <SelectItem value="ADD_REMOTE">
                                    <div className="flex items-center gap-2">
                                        <Plus className="h-3 w-3" /> Toevoegen
                                    </div>
                                </SelectItem>
                                <SelectItem value="IGNORE">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <X className="h-3 w-3" /> Negeren
                                    </div>
                                </SelectItem>
                            </>
                        )}
                        {item.status === "NEW_LOCAL" && (
                            <>
                                <SelectItem value="REMOVE_LOCAL">
                                    <div className="flex items-center gap-2 text-destructive">
                                        <Trash2 className="h-3 w-3" />{" "}
                                        Verwijderen
                                    </div>
                                </SelectItem>
                                <SelectItem value="KEEP_LOCAL">
                                    <div className="flex items-center gap-2">
                                        <Check className="h-3 w-3" /> Behouden
                                    </div>
                                </SelectItem>
                            </>
                        )}
                        {item.status === "EXPIRED_LOCAL" && (
                            <>
                                <SelectItem value="CLOSE_LOCAL">
                                    <div className="flex items-center gap-2 text-orange-700">
                                        <Archive className="h-3 w-3" />{" "}
                                        Afsluiten
                                    </div>
                                </SelectItem>
                                <SelectItem value="KEEP_LOCAL">
                                    <div className="flex items-center gap-2">
                                        <Check className="h-3 w-3" /> Behouden
                                    </div>
                                </SelectItem>
                            </>
                        )}
                        {item.status === "CONFLICT" && (
                            <>
                                <SelectItem value="UPDATE_FROM_REMOTE">
                                    <div className="flex items-center gap-2">
                                        <ArrowLeftRight className="h-3 w-3" />{" "}
                                        Gebruik RVO
                                    </div>
                                </SelectItem>
                                <SelectItem value="KEEP_LOCAL">
                                    <div className="flex items-center gap-2">
                                        <Check className="h-3 w-3" /> Gebruik{" "}
                                        {clientConfig.name}
                                    </div>
                                </SelectItem>
                            </>
                        )}
                    </SelectContent>
                </Select>
            )
        },
    },
]

export function RvoImportReviewTable({
    data,
    userChoices,
    onChoiceChange,
}: RvoImportReviewTableProps) {
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => {
            const getArea = (item: typeof a): number | null => {
                if (item.rvoField?.geometry) {
                    return area(item.rvoField.geometry) / 10000
                }
                if (Number.isFinite(item.localField?.b_area)) {
                    return item.localField.b_area as number
                }
                return null
            }
            const areaA = getArea(a)
            const areaB = getArea(b)
            if (areaA === null && areaB === null) return 0
            if (areaA === null) return 1
            if (areaB === null) return -1
            return areaB - areaA
        })
    }, [data])

    const table = useReactTable({
        data: sortedData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            userChoices,
            onChoiceChange,
        },
    })

    return (
        <TooltipProvider>
            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef
                                                          .header,
                                                      header.getContext(),
                                                  )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={
                                        row.getIsSelected() && "selected"
                                    }
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    Geen resultaten.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </TooltipProvider>
    )
}
