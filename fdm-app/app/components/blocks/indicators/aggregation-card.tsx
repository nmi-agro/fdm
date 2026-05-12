import { Info } from "lucide-react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { getScoreColor, getScoreTier, scoreToDisplay } from "~/lib/indicators"
import { ScoreBadge } from "./score-badge"

type AggregationCardProps = {
    /** Aggregation label, e.g. "OBI" or "BBWP" */
    label: string
    /** Full Dutch name for the aggregation */
    name: string
    /** Score on a 0–1 scale (from API). Null when unavailable. */
    score01: number | null
    /**
     * Optional "without measures" score on a 0–1 scale.
     * When provided together with `score01`, a delta is shown.
     */
    index01?: number | null
    /** When true, show the index (without measures) instead of the score. */
    showIndex?: boolean
}

/**
 * A card summarising one BLN3 aggregation (OBI, BBWP) for the farm.
 *
 * Shows the farm-average score (0–100), a colour-coded progress bar,
 * a text verdict badge, and optionally a delta between score and index.
 */
export function AggregationCard({
    label,
    name,
    score01,
    index01,
    showIndex = false,
}: AggregationCardProps) {
    const activeScore01 = showIndex ? (index01 ?? score01) : score01
    const display =
        activeScore01 !== null ? scoreToDisplay(activeScore01) : null
    const color = display !== null ? getScoreColor(display) : "#d1d5db"
    const tier = display !== null ? getScoreTier(display) : null

    // Delta: how much do measures improve the score?
    const hasDelta =
        score01 !== null &&
        index01 !== null &&
        index01 !== undefined &&
        score01 !== index01
    const delta =
        hasDelta && score01 !== null && index01 !== null
            ? scoreToDisplay(score01) - scoreToDisplay(index01)
            : null

    return (
        <TooltipProvider>
        <Card className="min-w-[160px]">
            <CardHeader className="pb-1 pt-4 px-4">
                <div className="flex items-center gap-1.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        {label}
                    </p>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground/60 cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px] text-center text-xs">
                            Berekend als gemiddelde van de afzonderlijke relevante indicatoren. De aggregatiescore is nog niet beschikbaar.
                        </TooltipContent>
                    </Tooltip>
                </div>
                <CardTitle className="text-3xl font-bold tabular-nums">
                    {display !== null ? display : "—"}
                </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4 space-y-2">
                {/* Colour-coded progress bar */}
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${display ?? 0}%`,
                            backgroundColor: color,
                        }}
                    />
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                    {tier !== null && display !== null && (
                        <ScoreBadge score={display} />
                    )}
                    {!showIndex && delta !== null && delta > 0 && (
                        <span className="text-xs text-muted-foreground">
                            {name}: {scoreToDisplay(index01!)} → {scoreToDisplay(score01!)} (
                            <span className="text-green-600 font-medium">
                                +{delta}
                            </span>
                            )
                        </span>
                    )}
                </div>

                <p className="text-xs text-muted-foreground">{name}</p>
            </CardContent>
        </Card>
        </TooltipProvider>
    )
}
