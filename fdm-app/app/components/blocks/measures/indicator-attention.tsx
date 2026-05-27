/**
 * Collapsible block surfacing indicators that need attention (red or yellow
 * score) on a field. When all indicators are green, shows a compliment.
 * Always includes a link to the full indicators page.
 */
import { useState } from "react"
import {
    ChevronDown,
    ChevronUp,
    Plus,
    BarChart2,
    CheckCircle2,
} from "lucide-react"
import { Link } from "react-router"
import type { Bln3IndicatorResult } from "@nmi-agro/fdm-calculator"
import { Button } from "~/components/ui/button"
import { ScoreBadge } from "~/components/blocks/indicators/score-badge"
import {
    getIndicatorInfo,
    getScoreColor,
    getScoreTier,
    scoreToDisplay,
    type IndicatorInfo,
} from "~/lib/indicators"

type AttentionItem = {
    result: Bln3IndicatorResult
    info: IndicatorInfo
    display: number
}

const CATEGORY_COLORS: Record<string, string> = {
    Gewasproductie: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
    Koolstofvastlegging: "bg-stone-100 text-stone-700 dark:bg-stone-950/30 dark:text-stone-400",
    Waterkwaliteit: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    "Nutriëntenkringloop": "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
}

type IndicatorAttentionProps = {
    indicators: Bln3IndicatorResult[]
    onAddMeasure: () => void
    indicatorsHref: string
}

export function IndicatorAttention({
    indicators,
    onAddMeasure,
    indicatorsHref,
}: IndicatorAttentionProps) {
    const [expanded, setExpanded] = useState(false)

    const needsAttention: AttentionItem[] = indicators
        .filter((r) => getScoreTier(scoreToDisplay(r.score)) !== "green")
        .sort((a, b) => a.score - b.score)
        .map((r) => ({
            result: r,
            info: getIndicatorInfo(r.indicator_id),
            display: scoreToDisplay(r.score),
        }))
        .filter((x): x is AttentionItem => x.info !== undefined)

    // All green — show a compliment with a link to the indicators page
    if (needsAttention.length === 0) {
        return (
            <div className="rounded-lg border border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-950/20 px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-green-900 dark:text-green-200">
                            Alle indicatoren scoren voldoende
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                            Goed bezig! De bodemkwaliteit van dit perceel ziet
                            er goed uit.
                        </p>
                    </div>
                </div>
                <Link
                    to={indicatorsHref}
                    className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200 transition-colors shrink-0"
                >
                    <BarChart2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Alle indicatoren</span>
                </Link>
            </div>
        )
    }

    const redCount = needsAttention.filter(
        (x) => getScoreTier(x.display) === "red",
    ).length

    return (
        <div className="rounded-lg border border-orange-200 dark:border-orange-900/40 overflow-hidden">
            <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-colors text-left"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
            >
                <div>
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                        {needsAttention.length}{" "}
                        {needsAttention.length === 1
                            ? "indicator vraagt"
                            : "indicatoren vragen"}{" "}
                        aandacht
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                        {redCount > 0
                            ? `${redCount} met onvoldoende score — overweeg een maatregel`
                            : "Matige scores — overweeg een maatregel"}
                    </p>
                </div>
                {expanded ? (
                    <ChevronUp className="h-4 w-4 text-orange-600 shrink-0" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-orange-600 shrink-0" />
                )}
            </button>

            {expanded && (
                <div className="px-4 py-3 space-y-2.5 bg-background">
                    {needsAttention.map(({ result, info, display }) => (
                        <div
                            key={result.indicator_id}
                            className="flex items-center gap-3"
                        >
                            <div
                                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{
                                    backgroundColor: getScoreColor(display),
                                }}
                            >
                                {display}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">
                                    {info.name}
                                </p>
                                <span
                                    className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${CATEGORY_COLORS[info.ecosysteemdienst] ?? "bg-muted text-muted-foreground"}`}
                                >
                                    {info.ecosysteemdienst}
                                </span>
                            </div>
                            <ScoreBadge score={display} className="shrink-0" />
                        </div>
                    ))}

                    <div className="pt-2 border-t flex items-center justify-between gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onAddMeasure}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Maatregel toevoegen
                        </Button>
                        <Link
                            to={indicatorsHref}
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <BarChart2 className="h-4 w-4" />
                            <span className="hidden sm:inline">
                                Alle indicatoren
                            </span>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}
