import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { Fragment } from "react"
import { Form } from "react-router"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { Spinner } from "~/components/ui/spinner"
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
import { FertilizerIcon } from "./fertilizer-icon"
import type { ParsedPlan, PlanRow } from "./types"

const columnHelper = createColumnHelper<PlanRow>()

const columns = [
    columnHelper.accessor("b_name", {
        header: "Perceel",
        cell: (info) => (
            <span className="font-medium text-foreground">
                {info.getValue()}
            </span>
        ),
    }),
    columnHelper.accessor("b_lu_name", {
        header: "Gewas",
        cell: (info) => {
            const row = info.row.original
            return (
                <Badge
                    style={{
                        backgroundColor: getCultivationColor(
                            row.b_lu_croprotation ?? undefined,
                        ),
                    }}
                    className="text-white text-xs font-normal"
                >
                    {info.getValue() || row.b_lu_catalogue}
                </Badge>
            )
        },
    }),
    columnHelper.accessor("b_area", {
        header: "Opp.",
        cell: (info) => {
            const ha = info.getValue()
            return (
                <span className="text-muted-foreground tabular-nums text-sm">
                    {ha === null
                        ? "—"
                        : ha < 0.1
                          ? "< 0.1 ha"
                          : `${ha.toFixed(1)} ha`}
                </span>
            )
        },
    }),
    columnHelper.accessor("applications", {
        header: "Bemestingsmaatregelen",
        cell: (info) => {
            const appsValue = info.getValue()
            const apps = appsValue
                ?.slice()
                .sort(
                    (a, b) =>
                        new Date(a.p_app_date).getTime() -
                        new Date(b.p_app_date).getTime(),
                )
            if (!apps || apps.length === 0)
                return (
                    <Badge variant="outline" className="font-normal opacity-60">
                        Geen bemesting
                    </Badge>
                )
            return (
                <div className="flex flex-col gap-1.5">
                    {apps.map((app, i) => (
                        <TooltipProvider key={i}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge
                                        variant="outline"
                                        className="gap-1.5 font-normal text-muted-foreground w-fit cursor-help"
                                    >
                                        <FertilizerIcon p_type={app.p_type} />
                                        <span className="font-medium text-foreground">
                                            {app.p_name_nl}
                                        </span>
                                        <span className="tabular-nums">
                                            {app.p_app_amount} {"kg/ha"}
                                        </span>
                                        <span className="text-muted-foreground/70">·</span>
                                        <span>{app.p_app_date}</span>
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-xs">
                                        Methode:{" "}
                                        <span className="font-semibold">
                                            {app.p_app_method_name ?? "Onbekend"}
                                        </span>
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ))}
                </div>
            )
        },
    }),
]

interface PlanTableProps {
    plan: ParsedPlan & { plan: PlanRow[] }
    isSaving: boolean
    expandedRows: Set<string>
    toggleRow: (b_id: string) => void
}

export function PlanTable({
    plan,
    isSaving,
    expandedRows,
    toggleRow,
}: PlanTableProps) {
    const table = useReactTable({
        data: plan.plan || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1.5">
                    <CardTitle className="text-lg">
                        Voorgesteld bemestingsplan
                    </CardTitle>
                    <CardDescription>
                        Klik op een rij voor perceeldetails (normen, N-balans,
                        organische stofbalans).
                    </CardDescription>
                </div>
                <Form method="post">
                    <input type="hidden" name="intent" value="accept" />
                    <input
                        type="hidden"
                        name="plan"
                        value={JSON.stringify(plan)}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <Spinner className="mr-2" />
                        ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Plan definitief maken en toepassen
                    </Button>
                </Form>
            </CardHeader>
            <CardContent className="p-0">
                <div className="rounded-md border-y">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            {table.getHeaderGroups().map((hg) => (
                                <TableRow key={hg.id}>
                                    {hg.headers.map((h) => (
                                        <TableHead
                                            key={h.id}
                                            className="font-semibold"
                                        >
                                            {h.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      h.column.columnDef.header,
                                                      h.getContext(),
                                                  )}
                                        </TableHead>
                                    ))}
                                    <TableHead className="w-8" />
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => {
                                    const isExpanded = expandedRows.has(
                                        row.original.b_id,
                                    )
                                    const hasMetrics =
                                        row.original.fieldMetrics != null
                                    const dose =
                                        row.original.fieldMetrics?.proposedDose
                                    const advice =
                                        row.original.fieldMetrics?.advice
                                    const normsFilling =
                                        row.original.fieldMetrics?.normsFilling
                                    const norms =
                                        row.original.fieldMetrics?.norms
                                    const nBalance =
                                        row.original.fieldMetrics?.nBalance
                                    const omBalance =
                                        row.original.fieldMetrics?.omBalance
                                    const eomSupplyPerHa =
                                        row.original.fieldMetrics
                                            ?.eomSupplyPerHa

                                    return (
                                        <Fragment key={row.id}>
                                            <TableRow
                                                className={`hover:bg-muted/20 transition-colors ${hasMetrics ? "cursor-pointer" : ""}`}
                                                onClick={() =>
                                                    hasMetrics &&
                                                    toggleRow(row.original.b_id)
                                                }
                                            >
                                                {row
                                                    .getVisibleCells()
                                                    .map((cell) => (
                                                        <TableCell
                                                            key={cell.id}
                                                            className="py-3"
                                                        >
                                                            {flexRender(
                                                                cell.column
                                                                    .columnDef
                                                                    .cell,
                                                                cell.getContext(),
                                                            )}
                                                        </TableCell>
                                                    ))}
                                                <TableCell className="py-3">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {hasMetrics &&
                                                            advice &&
                                                            (() => {
                                                                const hasAdvice =
                                                                    advice.d_n_req >
                                                                        0 ||
                                                                    advice.d_p_req >
                                                                        0 ||
                                                                    advice.d_k_req >
                                                                        0
                                                                if (!hasAdvice)
                                                                    return null

                                                                const badges = [
                                                                    {
                                                                        key: "N",
                                                                        fill:
                                                                            dose?.p_dose_nw ??
                                                                            0,
                                                                        ref: advice.d_n_req,
                                                                    },
                                                                    {
                                                                        key: "P",
                                                                        fill:
                                                                            dose?.p_dose_p ??
                                                                            0,
                                                                        ref: advice.d_p_req,
                                                                    },
                                                                    {
                                                                        key: "K",
                                                                        fill:
                                                                            dose?.p_dose_k ??
                                                                            0,
                                                                        ref: advice.d_k_req,
                                                                    },
                                                                ]
                                                                return (
                                                                    <TooltipProvider>
                                                                        {badges.map(
                                                                            ({
                                                                                key,
                                                                                fill,
                                                                                ref,
                                                                            }) => {
                                                                                if (
                                                                                    ref <=
                                                                                    0
                                                                                )
                                                                                    return null
                                                                                const pct =
                                                                                    Math.round(
                                                                                        (Number(
                                                                                            fill,
                                                                                        ) /
                                                                                            ref) *
                                                                                            100,
                                                                                    )
                                                                                const isUnder =
                                                                                    pct <
                                                                                    90
                                                                                const isExceed =
                                                                                    pct >
                                                                                    110
                                                                                const colorClass =
                                                                                    isUnder
                                                                                        ? "bg-red-100 text-red-700 border-red-200"
                                                                                        : isExceed
                                                                                          ? "bg-amber-100 text-amber-700 border-amber-200"
                                                                                          : "bg-green-100 text-green-700 border-green-200"

                                                                                return (
                                                                                    <Tooltip
                                                                                        key={
                                                                                            key
                                                                                        }
                                                                                    >
                                                                                        <TooltipTrigger
                                                                                            asChild
                                                                                        >
                                                                                            <span
                                                                                                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tabular-nums cursor-default ${colorClass}`}
                                                                                            >
                                                                                                {
                                                                                                    key
                                                                                                }{" "}
                                                                                                {
                                                                                                    pct
                                                                                                }
                                                                                                %
                                                                                            </span>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent
                                                                                            side="top"
                                                                                            className="text-xs"
                                                                                        >
                                                                                            <div className="space-y-1">
                                                                                                <p className="font-semibold">
                                                                                                    {key ===
                                                                                                    "N"
                                                                                                        ? "Stikstof"
                                                                                                        : key ===
                                                                                                            "P"
                                                                                                          ? "Fosfaat"
                                                                                                          : key ===
                                                                                                              "K"
                                                                                                            ? "Kali"
                                                                                                            : key}
                                                                                                </p>
                                                                                                <p>
                                                                                                    Advies:{" "}
                                                                                                    {Math.round(
                                                                                                        ref,
                                                                                                    )}{" "}
                                                                                                    kg/ha
                                                                                                </p>
                                                                                                <p>
                                                                                                    Aangevoerd:{" "}
                                                                                                    {Math.round(
                                                                                                        fill,
                                                                                                    )}{" "}
                                                                                                    kg/ha
                                                                                                </p>
                                                                                            </div>
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                )
                                                                            },
                                                                        )}
                                                                    </TooltipProvider>
                                                                )
                                                            })()}
                                                        {hasMetrics &&
                                                            (isExpanded ? (
                                                                <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
                                                            ))}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && hasMetrics && (
                                                <TableRow className="bg-muted/10 hover:bg-muted/10">
                                                    <TableCell
                                                        colSpan={
                                                            columns.length + 1
                                                        }
                                                        className="py-4 px-6"
                                                    >
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
                                                            {/* ── Normen ── */}
                                                            {normsFilling &&
                                                                norms && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                                            Gebruiksruimte
                                                                            (kg/ha)
                                                                        </p>
                                                                        {[
                                                                            {
                                                                                label: "Dierlijke mest N",
                                                                                fill:
                                                                                    normsFilling
                                                                                        .manure
                                                                                        ?.normFilling ??
                                                                                    0,
                                                                                norm:
                                                                                    norms
                                                                                        .manure
                                                                                        ?.normValue ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                label: "Werkzame N",
                                                                                fill:
                                                                                    normsFilling
                                                                                        .nitrogen
                                                                                        ?.normFilling ??
                                                                                    0,
                                                                                norm:
                                                                                    norms
                                                                                        .nitrogen
                                                                                        ?.normValue ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                label: "Fosfaat P₂O₅",
                                                                                fill:
                                                                                    normsFilling
                                                                                        .phosphate
                                                                                        ?.normFilling ??
                                                                                    0,
                                                                                norm:
                                                                                    norms
                                                                                        .phosphate
                                                                                        ?.normValue ??
                                                                                    0,
                                                                            },
                                                                        ].map(
                                                                            ({
                                                                                label,
                                                                                fill,
                                                                                norm,
                                                                            }) => (
                                                                                <div
                                                                                    key={
                                                                                        label
                                                                                    }
                                                                                    className="space-y-1"
                                                                                >
                                                                                    <div className="flex justify-between text-xs">
                                                                                        <span className="text-muted-foreground">
                                                                                            {
                                                                                                label
                                                                                            }
                                                                                        </span>
                                                                                        <span
                                                                                            className={`tabular-nums font-medium ${fill > norm ? "text-red-600" : "text-foreground"}`}
                                                                                        >
                                                                                            {Math.round(
                                                                                                fill,
                                                                                            )}{" "}
                                                                                            /{" "}
                                                                                            {Math.round(
                                                                                                norm,
                                                                                            )}
                                                                                        </span>
                                                                                    </div>
                                                                                    <Progress
                                                                                        value={
                                                                                            fill >
                                                                                            norm
                                                                                                ? 100
                                                                                                : norm >
                                                                                                    0
                                                                                                  ? (fill /
                                                                                                        norm) *
                                                                                                    100
                                                                                                  : 0
                                                                                        }
                                                                                        colorBar={
                                                                                            fill >
                                                                                            norm
                                                                                                ? "red-500"
                                                                                                : "green-500"
                                                                                        }
                                                                                        className="h-1.5"
                                                                                    />
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                )}

                                                            {/* ── Balansen ── */}
                                                            <div className="space-y-6">
                                                                {nBalance && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                                            Stikstofbalans
                                                                        </p>
                                                                        <div className="flex justify-between text-sm items-center">
                                                                            <span className="text-muted-foreground">
                                                                                Balans
                                                                                vs.
                                                                                doel
                                                                                (kg/ha)
                                                                            </span>
                                                                            <span
                                                                                className={`font-semibold tabular-nums ${nBalance.balance <= nBalance.target ? "text-green-600" : "text-red-600"}`}
                                                                            >
                                                                                {Math.round(
                                                                                    nBalance.balance,
                                                                                )}{" "}
                                                                                /{" "}
                                                                                {Math.round(
                                                                                    nBalance.target,
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {(eomSupplyPerHa !=
                                                                    null ||
                                                                    omBalance !=
                                                                        null) && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                                            Organische
                                                                            stof
                                                                        </p>
                                                                        <div className="flex justify-between items-center text-sm">
                                                                            <span className="text-muted-foreground">
                                                                                Aanvoer
                                                                                EOS
                                                                                (kg/ha)
                                                                            </span>
                                                                            <span
                                                                                className={`font-semibold tabular-nums ${(eomSupplyPerHa ?? omBalance ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                                                                            >
                                                                                {(eomSupplyPerHa ??
                                                                                    omBalance ??
                                                                                    0) >
                                                                                0
                                                                                    ? "+"
                                                                                    : ""}
                                                                                {Math.round(
                                                                                    eomSupplyPerHa ??
                                                                                        omBalance ??
                                                                                        0,
                                                                                )}{" "}
                                                                                kg
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            EOS-aanvoer
                                                                            via
                                                                            meststoffen
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* ── Nutrientenadvies ── */}
                                                            {advice &&
                                                                dose &&
                                                                (() => {
                                                                    const allAdvices =
                                                                        [
                                                                            {
                                                                                key: "N",
                                                                                fill:
                                                                                    dose.p_dose_nw ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_n_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "P",
                                                                                fill:
                                                                                    dose.p_dose_p ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_p_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "K",
                                                                                fill:
                                                                                    dose.p_dose_k ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_k_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "S",
                                                                                fill:
                                                                                    dose.p_dose_s ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_s_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "Mg",
                                                                                fill:
                                                                                    dose.p_dose_mg ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_mg_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "Ca",
                                                                                fill:
                                                                                    dose.p_dose_ca ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_ca_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "Na",
                                                                                fill:
                                                                                    dose.p_dose_na ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_na_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "Cu",
                                                                                fill:
                                                                                    dose.p_dose_cu ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_cu_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "Zn",
                                                                                fill:
                                                                                    dose.p_dose_zn ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_zn_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "B",
                                                                                fill:
                                                                                    dose.p_dose_b ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_b_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "Mn",
                                                                                fill:
                                                                                    dose.p_dose_mn ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_mn_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "Mo",
                                                                                fill:
                                                                                    dose.p_dose_mo ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_mo_req ??
                                                                                    0,
                                                                            },
                                                                            {
                                                                                key: "Co",
                                                                                fill:
                                                                                    dose.p_dose_co ??
                                                                                    0,
                                                                                ref:
                                                                                    advice.d_co_req ??
                                                                                    0,
                                                                            },
                                                                        ].filter(
                                                                            (
                                                                                n,
                                                                            ) =>
                                                                                n.ref >
                                                                                0,
                                                                        )

                                                                    if (
                                                                        allAdvices.length ===
                                                                        0
                                                                    )
                                                                        return null

                                                                    return (
                                                                        <div className="space-y-2">
                                                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                                                Nutriëntenbehoefte
                                                                            </p>
                                                                            <TooltipProvider>
                                                                                <div className="flex flex-wrap gap-1.5">
                                                                                    {allAdvices.map(
                                                                                        ({
                                                                                            key,
                                                                                            fill,
                                                                                            ref,
                                                                                        }) => {
                                                                                            const pct =
                                                                                                Math.round(
                                                                                                    (fill /
                                                                                                        ref) *
                                                                                                        100,
                                                                                                )
                                                                                            const isUnder =
                                                                                                pct <
                                                                                                90
                                                                                            const isExceed =
                                                                                                pct >
                                                                                                110
                                                                                            const colorClass =
                                                                                                isUnder
                                                                                                    ? "bg-red-100 text-red-700 border-red-200"
                                                                                                    : isExceed
                                                                                                      ? "bg-amber-100 text-amber-700 border-amber-200"
                                                                                                      : "bg-green-100 text-green-700 border-green-200"

                                                                                            return (
                                                                                                <Tooltip
                                                                                                    key={
                                                                                                        key
                                                                                                    }
                                                                                                >
                                                                                                    <TooltipTrigger
                                                                                                        asChild
                                                                                                    >
                                                                                                        <span
                                                                                                            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tabular-nums cursor-default ${colorClass}`}
                                                                                                        >
                                                                                                            {
                                                                                                                key
                                                                                                            }{" "}
                                                                                                            {
                                                                                                                pct
                                                                                                            }
                                                                                                            %
                                                                                                        </span>
                                                                                                    </TooltipTrigger>
                                                                                                    <TooltipContent
                                                                                                        side="top"
                                                                                                        className="text-xs"
                                                                                                    >
                                                                                                        <div className="space-y-1">
                                                                                                            <p className="font-semibold">
                                                                                                                {key ===
                                                                                                                "N"
                                                                                                                    ? "Stikstof"
                                                                                                                    : key ===
                                                                                                                        "P"
                                                                                                                      ? "Fosfaat"
                                                                                                                      : key ===
                                                                                                                          "K"
                                                                                                                        ? "Kali"
                                                                                                                        : key}
                                                                                                            </p>
                                                                                                            <p>
                                                                                                                Advies:{" "}
                                                                                                                {Math.round(
                                                                                                                    ref,
                                                                                                                )}{" "}
                                                                                                                kg/ha
                                                                                                            </p>
                                                                                                            <p>
                                                                                                                Aangevoerd:{" "}
                                                                                                                {Math.round(
                                                                                                                    fill,
                                                                                                                )}{" "}
                                                                                                                kg/ha
                                                                                                            </p>
                                                                                                        </div>
                                                                                                    </TooltipContent>
                                                                                                </Tooltip>
                                                                                            )
                                                                                        },
                                                                                    )}
                                                                                </div>
                                                                            </TooltipProvider>
                                                                        </div>
                                                                    )
                                                                })()}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length + 1}
                                        className="h-32 text-center text-muted-foreground"
                                    >
                                        Geen percelen gevonden om te bemesten.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
