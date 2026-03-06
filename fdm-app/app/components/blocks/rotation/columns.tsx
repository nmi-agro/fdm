import type { ColumnDef } from "@tanstack/react-table"
import { ChevronRight } from "lucide-react"
import React from "react"
import { NavLink, useFetcher } from "react-router-dom"
import { cn } from "@/app/lib/utils"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { DataTableColumnHeader } from "./column-header"
import { DateRangeDisplay } from "./date-range-display"
import { TableDateSelector } from "./date-selector"
import { FertilizerDisplay } from "./fertilizer-display"
import { HarvestDatesDisplay } from "./harvest-dates-display"
import { NameCell } from "./name-cell"
import { TableVarietySelector } from "./variety-selector"

export type CropRow = {
    type: "crop"
    canModify: boolean
    b_lu_catalogue: string
    b_lu: string[]
    b_lu_name: string
    m_cropresidue: "all" | "some" | "none"
    b_lu_variety: Record<string, number>
    b_lu_variety_options: { label: string; value: string }[] | null
    b_lu_croprotation: string
    b_lu_harvestable: "once" | "multiple" | "none"
    calendar: string
    b_lu_start: Date[]
    b_lu_end: Date[]
    b_bufferstrip: boolean
    fields: FieldRow[]
}

export type FieldRow = {
    type: "field"
    canModify: boolean
    b_id: string
    b_name: string
    b_area: number
    b_bufferstrip: boolean
    a_som_loi: string | number
    b_soiltype_agr: string | number
    m_cropresidue: "all" | "some" | "none"
    m_cropresidue_ending: [Date, boolean][]
    b_lu_variety: Record<string, number>
    b_lu_croprotation: string
    harvests: {
        b_lu: string
        b_id_harvesting: string
        b_lu_harvest_date: Date | null
    }[]
    b_lu_harvestable: "once" | "multiple" | "none"
    calendar: string
    b_lu_start: Date[]
    b_lu_end: Date[]
    fertilizerApplications: {
        p_name_nl: string | null
        p_id: string
    }[]
    fertilizers: {
        p_name_nl: string | null
        p_id: string
        p_type: string | null
    }[]
    fields?: undefined
}

export type RotationExtended = CropRow | FieldRow

export const columns: ColumnDef<RotationExtended>[] = [
    {
        id: "Children",
        enableHiding: false,
        cell: ({ row }) => {
            return row.getCanExpand() ? (
                <button
                    type="button"
                    onClick={row.getToggleExpandedHandler()}
                    style={{ cursor: "pointer" }}
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
        id: "select",
        header: ({ table }) => (
            <div className="pe-4">
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) =>
                        table.toggleAllPageRowsSelected(!!value)
                    }
                    aria-label="Selecteer alle rijen"
                />
            </div>
        ),
        cell: ({ row }) => (
            <div
                className={cn(row.original.type === "field" ? "ps-4" : "pe-4")}
            >
                <Checkbox
                    checked={
                        row.getIsSelected()
                            ? true
                            : row.getIsSomeSelected()
                              ? "indeterminate"
                              : false
                    }
                    onCheckedChange={(value) => {
                        row.toggleSelected(!!value)
                    }}
                    aria-label="Selecteer deze rij"
                    className="text-muted-foreground"
                />
            </div>
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        id: "name",
        accessorFn: (row) => (row.type === "crop" ? row.b_lu_name : row.b_name),
        enableSorting: true,
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Gewas" />
        },
        cell: (context) => <NameCell {...context} />,
    },
    {
        accessorKey: "b_lu_start",
        enableSorting: true,
        sortingFn: "datetime",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Zaaidatum" />
        },
        enableHiding: true, // Enable hiding for mobile
        cell: ({ cell, row }) =>
            !row.original.canModify ? (
                <DateRangeDisplay
                    range={row.original.b_lu_start}
                    emptyContent="Geen"
                />
            ) : (
                <TableDateSelector
                    name="b_lu_start"
                    row={row}
                    cellId={cell.id}
                />
            ),
    },
    {
        accessorKey: "b_lu_end",
        enableSorting: true,
        sortingFn: "datetime",
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Einddatum" />
        },
        enableHiding: true, // Enable hiding for mobile
        cell: ({ cell, row }) => {
            if (!row.original.canModify) {
                return (
                    <DateRangeDisplay
                        range={row.original.b_lu_end}
                        emptyContent="Geen"
                    />
                )
            }
            const cultivation = (row.getParentRow() ?? row).original as CropRow
            const tooltipMessageNumHarvests =
                cultivation.b_lu_harvestable === "multiple"
                    ? 0
                    : (row.original.type === "crop"
                          ? row.original.fields
                          : [row.original]
                      ).reduce(
                          (sum, fieldRow) => sum + fieldRow.harvests.length,
                          0,
                      )
            return cultivation.b_lu_harvestable !== "multiple" ? (
                <span className="whitespace-nowrap">
                    <Tooltip>
                        <TooltipTrigger>
                            <DateRangeDisplay
                                range={row.original.b_lu_end}
                                emptyContent="Geen"
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            {tooltipMessageNumHarvests > 1
                                ? "U zou in plaats daarvan de huidige oogsten bijwerken."
                                : tooltipMessageNumHarvests === 1
                                  ? "U zou in plaats daarvan de huidige oogst bijwerken."
                                  : "U zou in plaats daarvan een oogst moeten toevoegen."}
                        </TooltipContent>
                    </Tooltip>
                </span>
            ) : (
                <TableDateSelector name="b_lu_end" row={row} cellId={cell.id} />
            )
        },
    },
    {
        accessorKey: "b_harvest_date",
        enableSorting: false,
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Oogstdata" />
        },
        enableHiding: true, // Enable hiding for mobile
        cell: ({ row }) => {
            const cultivation = row.original
            return <HarvestDatesDisplay row={cultivation} />
        },
    },
    {
        accessorKey: "b_lu_variety",
        enableSorting: false,
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Variëteit" />
        },
        enableHiding: true, // Enable hiding for mobile
        cell: ({ cell, row }) => (
            <TableVarietySelector
                name="b_lu_variety"
                row={row}
                cellId={cell.id}
                canModify={row.original.canModify}
            />
        ),
    },
    {
        accessorKey: "m_cropresidue",
        enableSorting: false,
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Gewasresten" />
        },
        enableHiding: true, // Enable hiding for mobile
        cell: ({ cell, row }) => {
            const fetcher = useFetcher()

            const submit = (value: boolean) => {
                const fieldIds = (
                    row.original.type === "crop"
                        ? row.original.fields
                        : [row.original]
                )
                    .map((field) => encodeURIComponent(field.b_id))
                    .join(",")
                const cultivationIds = encodeURIComponent(
                    ((row.getParentRow()?.original ?? row.original) as CropRow)
                        .b_lu_catalogue,
                )
                return fetcher.submit(
                    {
                        m_cropresidue: value,
                    },
                    {
                        method: "POST",
                        action: `?cultivationIds=${cultivationIds}&fieldIds=${fieldIds}`,
                    },
                )
            }

            const inputId = `${cell.id}_checkbox`

            const checkedState = (
                {
                    all: true,
                    some: "indeterminate",
                    none: false,
                } as const
            )[row.original.m_cropresidue]

            return fetcher.state !== "idle" ? (
                <Spinner />
            ) : (
                <div className="flex flex-row items-center gap-1 text-muted-foreground">
                    {row.original.canModify ? (
                        <Checkbox
                            id={inputId}
                            checked={checkedState}
                            onCheckedChange={(value) => submit(!!value)}
                        />
                    ) : (
                        <Checkbox
                            id={inputId}
                            checked={checkedState}
                            disabled={true}
                        />
                    )}
                    <label htmlFor={inputId}>
                        {" "}
                        {
                            (
                                {
                                    all: "Ja",
                                    some: "Gedeeltelijk",
                                    none: "Nee",
                                } as const
                            )[row.original.m_cropresidue]
                        }
                    </label>
                </div>
            )
        },
    },
    {
        accessorKey: "fertilizers",
        enableSorting: false,
        enableHiding: true, // Enable hiding for mobile
        header: ({ column }) => {
            return (
                <DataTableColumnHeader column={column} title="Bemesting met:" />
            )
        },
        cell: ({ row }) => {
            const cultivation = row.original
            return <FertilizerDisplay cultivation={cultivation} />
        },
    },
    {
        accessorKey: "b_name",
        enableSorting: true,
        sortingFn: (rowA, rowB, _columnId) => {
            const fieldA = rowA.original.fields?.length ?? 0
            const fieldB = rowB.original.fields?.length ?? 0
            return fieldA - fieldB
        },
        enableHiding: true, // Enable hiding for mobile
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Percelen" />
        },
        cell: ({ row }) => {
            const cultivation = row.original

            const fieldsDisplay = React.useMemo(() => {
                const fieldsSorted = [...(cultivation.fields ?? [])].sort(
                    (a, b) => a.b_name.localeCompare(b.b_name),
                )
                return (
                    cultivation.type === "crop" && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost">
                                    <p className="text-muted-foreground">
                                        {fieldsSorted.length === 1
                                            ? "1 perceel"
                                            : `${fieldsSorted.length} percelen`}
                                    </p>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <ScrollArea
                                    className={
                                        fieldsSorted.length >= 8
                                            ? "h-72 overflow-y-auto w-48"
                                            : "w-48"
                                    }
                                >
                                    <div className="grid grid-cols-1 gap-2">
                                        {fieldsSorted.map((field) => (
                                            <NavLink
                                                to={`../${cultivation.calendar}/field/${field.b_id}`}
                                                key={`${field.b_id}`}
                                            >
                                                <DropdownMenuItem>
                                                    {field.b_name}
                                                </DropdownMenuItem>
                                            </NavLink>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )
                )
            }, [cultivation.type, cultivation.calendar, cultivation.fields])

            return fieldsDisplay
        },
    },
    {
        accessorKey: "b_area",
        enableSorting: true,
        sortingFn: (rowA, rowB, _columnId) => {
            const areaA =
                rowA.original.type === "field"
                    ? rowA.original.b_area
                    : rowA.original.fields.reduce(
                          (acc, field) => acc + field.b_area,
                          0,
                      )
            const areaB =
                rowB.original.type === "field"
                    ? rowB.original.b_area
                    : rowB.original.fields.reduce(
                          (acc, field) => acc + field.b_area,
                          0,
                      )
            return areaA - areaB
        },
        header: ({ column }) => {
            return <DataTableColumnHeader column={column} title="Oppervlakte" />
        },
        enableHiding: true, // Enable hiding for mobile
        cell: ({ row }) => {
            const cultivation = row.original

            const provided_b_area =
                cultivation.type === "field" ? cultivation.b_area : null
            const formattedArea = React.useMemo(() => {
                const b_area =
                    cultivation.type === "field"
                        ? (provided_b_area ?? 0)
                        : cultivation.fields.reduce(
                              (acc, field) => acc + field.b_area,
                              0,
                          )

                return b_area < 0.1 ? "< 0.1 ha" : `${b_area.toFixed(1)} ha`
            }, [cultivation.type, provided_b_area, cultivation.fields])

            return <p className="text-muted-foreground">{formattedArea}</p>
        },
    },
]
