/**
 * Summarises the BLN3 indicator impact of measures for a single field.
 *
 * Shows the indicators that are directly improved by the selected measures,
 * displaying their pre-measure vs post-measure scores and the positive delta.
 */
import type { Bln3IndicatorResult } from "@nmi-agro/fdm-calculator"
import { MoveUpRight } from "lucide-react"
import { getIndicatorInfo, scoreToDisplay } from "~/lib/indicators"

type ImpactSummaryProps = {
  indicators: Bln3IndicatorResult[]
  /** Measures currently active on this field */
  activeMeasures: { m_id: string; m_name: string }[]
  /**
   * Raw per-indicator impact per measure, used to attribute each improved
   * indicator to the active measure(s) causing it. `undefined` when advice
   * was unavailable — attribution lines are then simply omitted.
   */
  measureImpacts?: Record<string, { indicator_id: string; measure_impact: number }[]>
}

export function ImpactSummary({ indicators, activeMeasures, measureImpacts }: ImpactSummaryProps) {
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

  // Attribute each improved indicator to the active measures with known
  // impact on it (advice may include already-taken measures; impact > 0 only).
  const contributingMeasures = (indicatorId: string) =>
    activeMeasures
      .map((m) => ({
        m_id: m.m_id,
        m_name: m.m_name,
        impact:
          measureImpacts?.[m.m_id]?.find((i) => i.indicator_id === indicatorId)?.measure_impact ??
          0,
      }))
      .filter((m) => m.impact > 0)
      .sort((a, b) => b.impact - a.impact)

  if (improvedIndicators.length === 0) {
    return (
      <div className="bg-muted/20 text-muted-foreground rounded-lg border p-4 text-center text-xs">
        Genomen maatregelen hebben geen directe invloed op de indicatoren van dit perceel.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MoveUpRight className="text-muted-foreground h-4 w-4" />
          <p className="text-sm font-semibold">Invloed op bodemindicatoren</p>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Genomen maatregelen verbeteren deze indicatoren direct.
        </p>
      </div>
      <div className="px-4 py-3">
        {/* Native scroll region: max-h so the block hugs short lists and only
            scrolls when long (ScrollArea's h-full viewport requires a fixed
            height and would clip instead of scroll under max-h). */}
        <div className="max-h-[160px] w-full overflow-y-auto pr-3">
          <div className="space-y-2">
            {improvedIndicators.map((ind) => {
              const contributors = contributingMeasures(ind.id)
              return (
                <div
                  key={ind.id}
                  className="bg-muted/30 border-border rounded-md border p-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground min-w-0 truncate font-medium">{ind.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {ind.index} → {ind.score}
                    </span>
                  </div>
                  {contributors.length > 0 && (
                    <p className="text-muted-foreground mt-1 truncate">
                      Door:{" "}
                      {contributors.map((m, i) => (
                        <span key={m.m_id}>
                          {i > 0 && " · "}
                          <span className="font-mono">{m.m_id.replace("bln_", "")}</span>{" "}
                          <span className="text-foreground">{m.m_name}</span>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
