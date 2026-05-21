/**
 * Summarises the BLN3 indicator impact of measures for a single field.
 *
 * Shows OBI and BBWP aggregation cards (score vs. without-measures index)
 * plus the three weakest indicators by current score, with a link to the
 * full indicators page.
 */
import type { Bln3IndicatorResult } from "@nmi-agro/fdm-calculator"
import { AggregationCard } from "~/components/blocks/indicators/aggregation-card"
import {
    BBWP_INDICATOR_IDS,
    OBI_INDICATOR_IDS,
} from "~/lib/indicators"

type ImpactSummaryProps = {
    indicators: Bln3IndicatorResult[]
    indicatorsHref: string
}

function avg01(
    indicators: Bln3IndicatorResult[],
    ids: string[],
    key: "score" | "index",
): number | null {
    const vals = ids.flatMap((id) => {
        const r = indicators.find((i) => i.indicator_id === id)
        return r ? [r[key]] : []
    })
    return vals.length > 0
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : null
}

export function ImpactSummary({ indicators }: ImpactSummaryProps) {
    const obiScore = avg01(indicators, OBI_INDICATOR_IDS, "score")
    const obiIndex = avg01(indicators, OBI_INDICATOR_IDS, "index")
    const bbwpScore = avg01(indicators, BBWP_INDICATOR_IDS, "score")
    const bbwpIndex = avg01(indicators, BBWP_INDICATOR_IDS, "index")

    if (obiScore === null && bbwpScore === null) return null

    return (
        <div className="space-y-4">
            {/* OBI / BBWP aggregation cards */}
            <div className="flex flex-wrap gap-3">
                {obiScore !== null && (
                    <AggregationCard
                        label="OBI"
                        name="Open Bodem Index"
                        score01={obiScore}
                        index01={obiIndex}
                    />
                )}
                {bbwpScore !== null && (
                    <AggregationCard
                        label="BBWP"
                        name="BedrijfsBodemWaterPlan"
                        score01={bbwpScore}
                        index01={bbwpIndex}
                    />
                )}
            </div>            
        </div>
    )
}
