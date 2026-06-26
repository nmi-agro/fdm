/**
 * Summarises the BLN3 indicator impact of measures for a single field.
 *
 * Shows the indicators that are directly improved by the selected measures,
 * displaying their pre-measure vs post-measure scores and the positive delta.
 */
import type { Bln3IndicatorResult } from "@nmi-agro/fdm-calculator"
import { Plus, TrendingUp } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
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
      <div className="bg-muted/20 text-muted-foreground rounded-lg border p-4 text-center text-xs">
        De geselecteerde maatregelen hebben op dit moment geen directe invloed op de BLN3
        bodemkwaliteitsindicatoren van dit perceel.
      </div>
    )
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="border-b pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-muted-foreground h-4 w-4" />
          <CardTitle className="text-base font-bold">Invloed op bodemindicatoren</CardTitle>
        </div>
        <CardDescription className="text-xs">
          De geselecteerde maatregelen zorgen voor een directe verbetering van de volgende
          bodemindicatoren op dit perceel.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ScrollArea className="h-[220px] w-full pr-3">
          <div className="space-y-2">
            {improvedIndicators.map((ind) => (
              <div
                key={ind.id}
                className="bg-muted/30 border-border flex items-center justify-between gap-3 rounded-md border p-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="secondary" className="h-5 px-1.5 py-0 font-mono text-[10px]">
                    {ind.id}
                  </Badge>
                  <span className="text-foreground truncate font-medium">{ind.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-muted-foreground text-[10px]">
                    {ind.index} → {ind.score}
                  </span>
                  <Badge variant="default" className="h-5 px-1.5 py-0 text-[10px] font-bold">
                    <Plus className="mr-0.5 h-3 w-3" />
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
