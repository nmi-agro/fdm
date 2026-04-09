import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export type AdvancedCultivationField = {
    b_lu_brp: number
    b_lu_catalogue: string
    b_lu_name: string
    b_lu_croprotation: string
    b_area: number
    b_area_overlap: number
    overlap_pct_of_selected: number
    overlap_pct_of_historical: number
}

export type EventType =
    | "stable"
    | "split"
    | "merge"
    | "expansion"
    | "shrinkage"
    | "no_data"

export type AdvancedCultivationYear = {
    year: number
    fields: AdvancedCultivationField[]
    total_overlap_pct: number
    event_type: EventType
}

export type AdvancedCultivationHistory = {
    selected_field_area_ha: number
    history: AdvancedCultivationYear[]
}

const EVENT_LABELS: Record<Exclude<EventType, "stable">, string> = {
    split: "Perceelsplitsing",
    merge: "Perceelsamenvoeging",
    expansion: "Perceelsuitbreiding",
    shrinkage: "Perceelsverkleining",
    no_data: "Geen registratie",
}

const EVENT_COLORS: Record<Exclude<EventType, "stable">, string> = {
    split: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    merge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    expansion:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    shrinkage:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    no_data:
        "bg-muted text-muted-foreground",
}

const SIGNIFICANCE_THRESHOLD = 0.01

function getBarPositions(fields: AdvancedCultivationField[]) {
    let x = 0
    return fields
        .filter((f) => f.overlap_pct_of_selected >= SIGNIFICANCE_THRESHOLD)
        .map((f) => {
            const width = f.overlap_pct_of_selected * 100
            const center = x + width / 2
            const pos = { center, width, startX: x, color: getCultivationColor(f.b_lu_croprotation) }
            x += width
            return pos
        })
}

function YearConnector({
    topFields,
    bottomFields,
    eventType,
}: {
    topFields: AdvancedCultivationField[]
    bottomFields: AdvancedCultivationField[]
    eventType: EventType
}) {
    const topPos = getBarPositions(topFields)
    const bottomPos = getBarPositions(bottomFields)

    // For split and merge, draw data-accurate fan/converge lines.
    // For all other transitions the API gives no per-field continuity info,
    // so a single neutral line avoids implying a fabricated crop-to-crop connection.
    const drawFanConverge =
        (eventType === "split" || eventType === "merge") &&
        topPos.length > 0 &&
        bottomPos.length > 0

    return (
        <div className="flex gap-3">
            {/* Spacer matching year label width */}
            <div className="w-14 shrink-0" />
            <div className="flex-1">
                {drawFanConverge ? (
                    <svg
                        viewBox="0 0 100 28"
                        className="w-full h-7"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        {eventType === "split"
                            ? // Fan out: single top bar to each bottom bar
                              bottomPos.map((bottom, i) => (
                                  <path
                                      key={i}
                                      d={`M ${topPos[0].center} 0 C ${topPos[0].center} 14, ${bottom.center} 14, ${bottom.center} 28`}
                                      fill="none"
                                      stroke={bottom.color}
                                      strokeWidth="2"
                                      strokeOpacity="0.45"
                                  />
                              ))
                            : // Converge: each top bar to single bottom bar
                              topPos.map((top, i) => (
                                  <path
                                      key={i}
                                      d={`M ${top.center} 0 C ${top.center} 14, ${bottomPos[0].center} 14, ${bottomPos[0].center} 28`}
                                      fill="none"
                                      stroke={top.color}
                                      strokeWidth="2"
                                      strokeOpacity="0.45"
                                  />
                              ))}
                    </svg>
                ) : (
                    // Neutral single vertical line — no crop-to-crop identity implied
                    <svg
                        viewBox="0 0 100 28"
                        className="w-full h-7"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        <line
                            x1="50"
                            y1="0"
                            x2="50"
                            y2="28"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeOpacity="0.2"
                            strokeDasharray="3 3"
                        />
                    </svg>
                )}
            </div>
        </div>
    )
}

function YearRow({
    yearEntry,
    currentYear,
}: {
    yearEntry: AdvancedCultivationYear
    currentYear: number
}) {
    const isActive = yearEntry.year === currentYear
    const significantFields = yearEntry.fields.filter(
        (f) => f.overlap_pct_of_selected >= SIGNIFICANCE_THRESHOLD,
    )
    const unregisteredPct = Math.max(0, 1 - yearEntry.total_overlap_pct)

    return (
        <div className="flex items-center gap-3">
            {/* Year label */}
            <div className="w-14 shrink-0 text-right">
                {isActive ? (
                    <Badge
                        variant="default"
                        className="h-5 px-1.5 text-[10px] font-black tabular-nums"
                    >
                        {yearEntry.year}
                    </Badge>
                ) : (
                    <span className="text-xs font-bold tabular-nums text-muted-foreground/70">
                        {yearEntry.year}
                    </span>
                )}
            </div>

            {/* Bars */}
            <div
                className={cn(
                    "flex-1 flex h-9 rounded overflow-hidden",
                    isActive && "ring-2 ring-primary ring-offset-1",
                )}
            >
                {significantFields.map((field) => (
                    <TooltipProvider key={`${field.b_lu_name}-${field.overlap_pct_of_selected}-${field.b_area_overlap}`}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    className="h-full flex items-center justify-center overflow-hidden cursor-help transition-opacity hover:opacity-80 shrink-0"
                                    style={{
                                        width: `${field.overlap_pct_of_selected * 100}%`,
                                        backgroundColor: getCultivationColor(
                                            field.b_lu_croprotation,
                                        ),
                                    }}
                                >
                                    {field.overlap_pct_of_selected >= 0.12 && (
                                        <span className="text-[10px] font-semibold text-white truncate px-1.5 select-none drop-shadow-sm">
                                            {field.b_lu_name}
                                        </span>
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="space-y-0.5">
                                <p className="font-semibold text-sm">
                                    {field.b_lu_name}
                                </p>
                                <p className="text-xs">
                                    {field.b_area_overlap.toFixed(2)} ha —{" "}
                                    <span className="font-medium">
                                        {Math.round(
                                            field.overlap_pct_of_selected * 100,
                                        )}
                                        % overlap
                                    </span>
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ))}

                {/* Unregistered portion */}
                {unregisteredPct >= 0.01 && (
                    <div
                        className="h-full flex items-center justify-center border border-dashed border-muted-foreground/25"
                        style={{ width: `${unregisteredPct * 100}%` }}
                    >
                        {unregisteredPct >= 0.12 && (
                            <span className="text-[10px] text-muted-foreground/50 truncate px-1 select-none">
                                Niet geregistreerd
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function EventLabel({ eventType }: { eventType: Exclude<EventType, "stable"> }) {
    return (
        <div className="flex gap-3 my-2">
            <div className="w-14 shrink-0" />
            <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-px bg-border/50" />
                <span
                    className={cn(
                        "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap",
                        EVENT_COLORS[eventType],
                    )}
                >
                    {EVENT_LABELS[eventType]}
                </span>
                <div className="flex-1 h-px bg-border/50" />
            </div>
        </div>
    )
}

export function AdvancedCultivationFlow({
    data,
    currentYear,
}: {
    data: AdvancedCultivationHistory
    currentYear: number
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const mobileLimit = 5
    const hasMore = data.history.length > mobileLimit

    return (
        <>
            <div className="space-y-0">
                {data.history.map((yearEntry, index) => {
                    const isHiddenOnMobile = !isExpanded && index >= mobileLimit
                    const hasNext = index < data.history.length - 1

                    return (
                        <div
                            key={yearEntry.year}
                            className={cn(isHiddenOnMobile && "hidden lg:block")}
                        >
                            <YearRow
                                yearEntry={yearEntry}
                                currentYear={currentYear}
                            />

                            {/* Connector + optional event label between rows.
                                Hidden on mobile when the next row is also hidden. */}
                            {hasNext && (
                                <div
                                    className={cn(
                                        !isExpanded &&
                                            index >= mobileLimit - 1 &&
                                            "hidden lg:block",
                                    )}
                                >
                                    {yearEntry.event_type !== "stable" && (
                                        <EventLabel
                                            eventType={yearEntry.event_type}
                                        />
                                    )}
                                    <YearConnector
                                        topFields={yearEntry.fields}
                                        bottomFields={
                                            data.history[index + 1].fields
                                        }
                                        eventType={yearEntry.event_type}
                                    />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {hasMore && (
                <div className="lg:hidden pt-2 border-t mt-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground hover:text-foreground h-10"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="mr-2 h-4 w-4" />
                                Minder jaren tonen
                            </>
                        ) : (
                            <>
                                <ChevronDown className="mr-2 h-4 w-4" />
                                Meer jaren tonen (
                                {data.history.length - mobileLimit})
                            </>
                        )}
                    </Button>
                </div>
            )}
        </>
    )
}
