/**
 * Summarises the BLN3 indicator impact of measures for a single field.
 *
 * Shows the indicators that are directly improved by the selected measures,
 * displaying their pre-measure vs post-measure scores and the positive delta.
 */
import type { Bln3IndicatorResult } from "@nmi-agro/fdm-calculator"
import { Plus, TrendingUp } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { ScrollArea } from "~/components/ui/scroll-area"
import { getIndicatorInfo, scoreToDisplay } from "~/lib/indicators"

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
                De geselecteerde maatregelen hebben op dit moment geen directe
                invloed op de BLN3 bodemkwaliteitsindicatoren van dit perceel.
            </div>
        )
    }

    return (
        <Card className="shadow-sm border-border">
            <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base font-bold">
                        Invloed op bodemindicatoren
                    </CardTitle>
                </div>
                <CardDescription className="text-xs">
                    De geselecteerde maatregelen zorgen voor een directe
                    verbetering van de volgende bodemindicatoren op dit perceel.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <ScrollArea className="h-[220px] w-full pr-3">
                    <div className="space-y-2">
                        {improvedIndicators.map((ind) => (
                            <div
                                key={ind.id}
                                className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/30 border border-border text-xs"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Badge
                                        variant="secondary"
                                        className="font-mono text-[10px] px-1.5 py-0 h-5"
                                    >
                                        {ind.id}
                                    </Badge>
                                    <span className="font-medium truncate text-foreground">
                                        {ind.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] text-muted-foreground">
                                        {ind.index} → {ind.score}
                                    </span>
                                    <Badge
                                        variant="default"
                                        className="font-bold text-[10px] px-1.5 py-0 h-5"
                                    >
                                        <Plus className="w-3 h-3 mr-0.5" />
                                        {ind.impact}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    )
}
