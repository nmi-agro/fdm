import type { SoilParameterDescription } from "@nmi-agro/fdm-core"
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import * as chrono from "chrono-node"
import { format, isValid, parseISO } from "date-fns"
import { nl } from "date-fns/locale/nl"
import {
    AlertTriangle,
    CalendarIcon,
    Check,
    Microscope,
    Save,
    Shovel,
    X,
} from "lucide-react"
import type React from "react"
import { memo, useCallback, useMemo, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover"
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
import { endMonth } from "~/lib/calendar"

const isValidDate = (dateStr: string | undefined | null): boolean => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return isValid(d)
}

function parseDateText(date: string | Date | undefined): Date | undefined {
    if (date instanceof Date) return date
    if (!date) return undefined

    // Attempt to parse as ISO string first
    const isoDate = parseISO(date)
    if (isValid(isoDate)) return isoDate

    // Fallback to chrono-node for localized strings
    const referenceDate = new Date()
    const parsedDate = chrono.nl.parseDate(date, referenceDate)
    return parsedDate || undefined
}

const DateCell = memo(function DateCell({
    analysisId,
    initialDateStr,
    onDateChange,
}: {
    analysisId: string
    initialDateStr: string
    onDateChange: (id: string, date: string) => void
}) {
    const date = initialDateStr ? new Date(initialDateStr) : undefined
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState(
        date && isValid(date) ? format(date, "PPP", { locale: nl }) : "",
    )

    const onDateSelect = (d: Date | undefined) => {
        if (d) {
            const iso = format(d, "yyyy-MM-dd")
            onDateChange(analysisId, iso)
            setInputValue(format(d, "PPP", { locale: nl }))
        } else {
            onDateChange(analysisId, "")
            setInputValue("")
        }
        setOpen(false)
    }

    const onInputBlur = () => {
        const parsed = parseDateText(inputValue)
        if (parsed && isValid(parsed)) {
            const iso = format(parsed, "yyyy-MM-dd")
            onDateChange(analysisId, iso)
            setInputValue(format(parsed, "PPP", { locale: nl }))
        } else if (inputValue === "") {
            onDateChange(analysisId, "")
        }
    }

    return (
        <div className="relative flex gap-2 w-[200px]">
            <Input
                value={inputValue}
                placeholder="Kies een datum"
                className="bg-background pr-10 text-xs h-8"
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={onInputBlur}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault()
                        e.currentTarget.blur()
                    }
                    if (e.key === "ArrowDown") {
                        e.preventDefault()
                        setOpen(true)
                    }
                }}
            />
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        className="absolute top-1/2 right-1 size-6 -translate-y-1/2 p-0 h-6 w-6"
                    >
                        <CalendarIcon className="size-3" />
                        <span className="sr-only">Kies een datum</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="end"
                >
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={onDateSelect}
                        startMonth={new Date(1970, 0)}
                        endMonth={endMonth}
                        locale={nl}
                        className="rounded-md border shadow-sm"
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
})

export type ProcessedAnalysis = {
    id: string
    filename: string
    b_sampling_date: string
    a_som_loi?: number
    a_p_al?: number
    a_p_cc?: number
    a_nmin_cc?: number
    a_nh4_cc?: number
    a_no3_cc?: number
    a_depth_upper?: number
    a_depth_lower?: number
    a_source: string
    matchedFieldId?: string
    matchReason?: "geometry" | "name" | "both"
    data: Record<string, unknown> // Raw parsed data
}

type Field = {
    b_id: string
    b_name: string
}

const MatchCell = memo(
    ({
        analysisId,
        matchId,
        isDateValid,
        onFieldChange,
        fieldOptions,
    }: {
        analysisId: string
        matchId: string
        isDateValid: boolean
        onFieldChange: (analysisId: string, fieldId: string) => void
        fieldOptions: React.ReactNode
    }) => {
        return (
            <Select
                value={matchId}
                disabled={!isDateValid}
                onValueChange={(value) => onFieldChange(analysisId, value)}
            >
                <SelectTrigger className="w-[250px] text-xs h-8">
                    <SelectValue placeholder="Selecteer perceel..." />
                </SelectTrigger>
                <SelectContent>{fieldOptions}</SelectContent>
            </Select>
        )
    },
)

const StatusCell = memo(
    ({
        matchId,
        date,
        matchReason,
        initialMatchId,
    }: {
        matchId: string
        date: string
        matchReason?: "geometry" | "name" | "both"
        initialMatchId?: string
    }) => {
        const isMatched = matchId && matchId !== "none"
        const isDateValid = isValidDate(date)

        if (!isDateValid) {
            return (
                <div className="flex items-center text-destructive">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Datum ontbreekt</span>
                </div>
            )
        }

        if (isMatched) {
            const isAutomatic = matchId === initialMatchId
            let tooltipText = "Handmatig gekoppeld"

            if (isAutomatic && matchReason) {
                if (matchReason === "geometry")
                    tooltipText = "Automatisch gekoppeld op basis van geometrie"
                else if (matchReason === "name")
                    tooltipText = "Automatisch gekoppeld op basis van naam"
                else if (matchReason === "both")
                    tooltipText =
                        "Automatisch gekoppeld op basis van geometrie en naam"
            }

            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center text-green-600 cursor-help">
                            <Check className="h-4 w-4 mr-1" />
                            <span className="text-xs">Gekoppeld</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tooltipText}</p>
                    </TooltipContent>
                </Tooltip>
            )
        }

        return (
            <div className="flex items-center text-amber-600">
                <AlertTriangle className="h-4 w-4 mr-1" />
                <span className="text-xs">Niet gekoppeld</span>
            </div>
        )
    },
)

export function BulkSoilAnalysisReview({
    analyses,
    fields,
    soilParameterDescription,
    onSave,
    onCancel,
}: {
    analyses: ProcessedAnalysis[]
    fields: Field[]
    soilParameterDescription: SoilParameterDescription
    onSave: (
        matches: { analysisId: string; fieldId: string }[],
        updatedAnalyses: ProcessedAnalysis[],
    ) => void
    onCancel: () => void
}) {
    const [matches, setMatches] = useState<Record<string, string>>(
        Object.fromEntries(analyses.map((a) => [a.id, a.matchedFieldId || ""])),
    )
    const [dates, setDates] = useState<Record<string, string>>(
        Object.fromEntries(
            analyses.map((a) => {
                const date = a.b_sampling_date
                    ? new Date(a.b_sampling_date)
                    : null
                const validDateStr =
                    date && isValid(date) ? format(date, "yyyy-MM-dd") : ""
                return [a.id, validDateStr]
            }),
        ),
    )

    const handleFieldChange = useCallback(
        (analysisId: string, fieldId: string) => {
            setMatches((prev) => ({ ...prev, [analysisId]: fieldId }))
        },
        [],
    )

    const handleDateChange = useCallback((analysisId: string, date: string) => {
        setDates((prev) => ({ ...prev, [analysisId]: date }))
    }, [])

    const validMatches = useMemo(
        () =>
            Object.entries(matches)
                .filter(([analysisId, fieldId]) => {
                    if (fieldId === "" || fieldId === "none") return false
                    const date = dates[analysisId]
                    return isValidDate(date)
                })
                .map(([analysisId, fieldId]) => ({ analysisId, fieldId })),
        [matches, dates],
    )

    const handleSave = () => {
        const updatedAnalyses = analyses.map((a) => ({
            ...a,
            b_sampling_date: dates[a.id],
        }))
        onSave(validMatches, updatedAnalyses)
    }

    const fieldOptions = useMemo(
        () => (
            <>
                <SelectItem value="none">-- Geen perceel --</SelectItem>
                {fields.map((field) => (
                    <SelectItem key={field.b_id} value={field.b_id}>
                        {field.b_name}
                    </SelectItem>
                ))}
            </>
        ),
        [fields],
    )

    const sourceLabelMap = useMemo(() => {
        const sourceParam = soilParameterDescription.find(
            (x: { parameter: string }) => x.parameter === "a_source",
        )
        return Object.fromEntries(
            sourceParam?.options?.map((x: { value: string; label: string }) => [
                x.value,
                x.label,
            ]) || [],
        )
    }, [soilParameterDescription])

    const columns: ColumnDef<ProcessedAnalysis>[] = useMemo(
        () => [
            {
                accessorKey: "filename",
                header: "Bestand / Lab",
                cell: ({ row }) => {
                    const sourceLabel =
                        sourceLabelMap[row.original.a_source] ||
                        row.original.a_source ||
                        "Onbekend"

                    return (
                        <div className="flex flex-col">
                            <span className="font-medium">
                                {row.original.filename}
                            </span>
                            <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground">
                                <div className="flex items-center">
                                    <Microscope className="h-3 w-3 mr-1" />
                                    <span>{sourceLabel}</span>
                                </div>
                                {(row.original.a_depth_upper !== undefined ||
                                    row.original.a_depth_lower !==
                                        undefined) && (
                                    <div className="flex items-center ">
                                        <Shovel className="h-3 w-3 mr-1" />
                                        <span>
                                            Diepte:{" "}
                                            {row.original.a_depth_upper ?? 0} -{" "}
                                            {row.original.a_depth_lower ?? "?"}{" "}
                                            cm
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                },
            },
            {
                accessorKey: "b_sampling_date",
                header: "Datum",
                cell: ({ row, table }) => {
                    const meta = table.options.meta as any
                    return (
                        <DateCell
                            analysisId={row.original.id}
                            initialDateStr={meta.dates[row.original.id]}
                            onDateChange={meta.handleDateChange}
                        />
                    )
                },
            },
            {
                id: "parameters",
                header: "Parameters",
                cell: ({ row }) => (
                    <div className="flex flex-wrap gap-1">
                        {row.original.a_som_loi != null && (
                            <Badge variant="secondary">
                                OS: {row.original.a_som_loi}%
                            </Badge>
                        )}
                        {row.original.a_p_al != null && (
                            <Badge variant="secondary">
                                P-Al: {row.original.a_p_al}
                            </Badge>
                        )}
                        {row.original.a_p_cc != null && (
                            <Badge variant="secondary">
                                P-CaCl₂: {row.original.a_p_cc}
                            </Badge>
                        )}
                        {row.original.a_nmin_cc != null && (
                            <Badge variant="secondary">
                                Nmin: {row.original.a_nmin_cc}
                            </Badge>
                        )}
                        {row.original.a_nh4_cc != null && (
                            <Badge variant="secondary">
                                NH₄: {row.original.a_nh4_cc}
                            </Badge>
                        )}
                        {row.original.a_no3_cc != null && (
                            <Badge variant="secondary">
                                NO₃: {row.original.a_no3_cc}
                            </Badge>
                        )}
                    </div>
                ),
            },
            {
                id: "match",
                header: "Perceel",
                cell: ({ row, table }) => {
                    const meta = table.options.meta as any
                    return (
                        <MatchCell
                            analysisId={row.original.id}
                            matchId={meta.matches[row.original.id]}
                            isDateValid={isValidDate(
                                meta.dates[row.original.id],
                            )}
                            onFieldChange={meta.handleFieldChange}
                            fieldOptions={meta.fieldOptions}
                        />
                    )
                },
            },
            {
                id: "status",
                header: "Status",
                cell: ({ row, table }) => {
                    const meta = table.options.meta as any
                    return (
                        <StatusCell
                            matchId={meta.matches[row.original.id]}
                            date={meta.dates[row.original.id]}
                            matchReason={row.original.matchReason}
                            initialMatchId={row.original.matchedFieldId}
                        />
                    )
                },
            },
        ],
        [sourceLabelMap],
    )

    const table = useReactTable({
        data: analyses,
        columns,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            matches,
            dates,
            handleFieldChange,
            handleDateChange,
            fieldOptions,
        },
    })

    return (
        <TooltipProvider>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Controleer en koppel</CardTitle>
                    <CardDescription>
                        Controleer de gegevens uit de pdf's en koppel ze aan het
                        juiste perceel. Analyses met ontbrekende datum of zonder
                        gekoppeld perceel worden overgeslagen.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead key={header.id}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                          header.column
                                                              .columnDef.header,
                                                          header.getContext(),
                                                      )}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {table.getRowModel().rows?.length ? (
                                    table.getRowModel().rows.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            data-state={
                                                row.getIsSelected() &&
                                                "selected"
                                            }
                                        >
                                            {row
                                                .getVisibleCells()
                                                .map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(
                                                            cell.column
                                                                .columnDef.cell,
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
                </CardContent>
                <CardFooter className="flex justify-between border-t p-6">
                    <Button variant="outline" onClick={onCancel}>
                        <X className="mr-2 h-4 w-4" />
                        Annuleren
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={validMatches.length === 0}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        Opslaan & Koppelen
                    </Button>
                </CardFooter>
            </Card>
        </TooltipProvider>
    )
}
