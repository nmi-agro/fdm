/**
 * Summarises the BLN3 indicator impact of measures for a single field.
 *
 * Shows aggregation cards per ecosysteemdienst (score vs. without-measures index)
 * plus the three weakest indicators by current score, with a link to the
 * full indicators page.
 */
import type { Bln3IndicatorResult } from "@nmi-agro/fdm-calculator"
import { AggregationCard } from "~/components/blocks/indicators/aggregation-card"
import {
    ECOSYSTEEMDIENST_FULL_NAME,
    ECOSYSTEEMDIENST_INDICATOR_IDS,
    ECOSYSTEEMDIENSTEN,
} from "~/lib/indicators"

type ImpactSummaryProps = {
    indicators: Bln3IndicatorResult[]
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
    const dienstScores = ECOSYSTEEMDIENSTEN.map((dienst) => ({
        dienst,
        score: avg01(
            indicators,
            ECOSYSTEEMDIENST_INDICATOR_IDS[dienst],
            "score",
        ),
        index: avg01(
            indicators,
            ECOSYSTEEMDIENST_INDICATOR_IDS[dienst],
            "index",
        ),
    }))

    if (dienstScores.every((d) => d.score === null)) return null

    return (
        <div className="space-y-4">
            <div className="flex gap-3">
                {dienstScores.map(({ dienst, score, index }) =>
                    score !== null ? (
                        <AggregationCard
                            key={dienst}
                            label={dienst}
                            name={ECOSYSTEEMDIENST_FULL_NAME[dienst]}
                            score01={score}
                            index01={index}
                        />
                    ) : null,
                )}
            </div>
        </div>
    )
}
