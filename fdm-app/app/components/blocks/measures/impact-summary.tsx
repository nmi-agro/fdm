/**
 * Summarises the BLN3 indicator impact of measures for a single field.
 *
 * Shows the indicators that are directly improved by the selected measures,
 * displaying their pre-measure vs post-measure scores and the positive delta.
 */
import type { Bln3IndicatorResult } from "@nmi-agro/fdm-calculator"
import { Sparkles, TrendingUp } from "lucide-react"
import { getIndicatorInfo, scoreToDisplay } from "~/lib/indicators"
import { Badge } from "~/components/ui/badge"

type ImpactSummaryProps = {
    indicators: Bln3IndicatorResult[]
}

export function ImpactSummary({ indicators }: ImpactSummaryProps) {
    // Filter and rank indicators that have positive measure impact
    const improvedIndicators = indicators
        .map((ind) => {
            const info = getIndicatorInfo(ind.indicator_id)
            const impactValue = scoreToDisplay(ind.impact)
            return {
                id: ind.indicator_id,
                name: info?.name ?? ind.indicator_id,
                impact: impactValue,
                score: scoreToDisplay(ind.score),
                index: scoreToDisplay(ind.index),
            }
        })
        .filter((ind) => ind.impact > 0)
        // Sort by highest impact first
        .sort((a, b) => b.impact - a.impact)

    if (improvedIndicators.length === 0) {
        return (
            <div className="rounded-lg border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                De geselecteerde maatregelen hebben op dit moment geen directe invloed op de BLN3 bodemkwaliteitsindicatoren van dit perceel.
            </div>
        )
    }

    return (
        <div className="space-y-3 bg-card p-4 rounded-xl border shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span>Invloed op Bodemindicatoren</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
                De geselecteerde maatregelen zorgen voor een directe verbetering van de volgende bodemindicatoren op dit perceel:
            </p>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {improvedIndicators.map((ind) => (
                    <div
                        key={ind.id}
                        className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/30 border border-border text-xs"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Sparkles className="h-3 w-3 text-teal-500 shrink-0" />
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
                                {ind.id}
                            </span>
                            <span className="font-medium truncate text-foreground">
                                {ind.name}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-muted-foreground">
                                {ind.index} → {ind.score}
                            </span>
                            <Badge className="bg-teal-500 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                                +{ind.impact}
                            </Badge>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
