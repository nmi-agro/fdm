import {
    BCS_COLOR_CLASSES,
    BCS_SCORE_DOT,
    type BcsColor,
    type BcsScores,
    indicatorScoreColor,
} from "~/components/blocks/soil-visual/bcs-color-utils"
import { BCS_INDICATORS } from "~/lib/bcs"
import { Badge } from "~/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { cn } from "~/lib/utils"
import type { ReactNode } from "react"

interface BcsScoreCardProps {
    scores: BcsScores
    a_ph_bcs?: number | null
    a_som_bcs?: number | null
    d_bcs: number
    i_bcs: number
    scoreColor: BcsColor
    scoreLabel: string
    measuredAt?: string | null
    actions?: ReactNode
}

export function BcsScoreCard({
    scores,
    a_ph_bcs,
    a_som_bcs,
    d_bcs,
    i_bcs,
    scoreColor,
    scoreLabel,
    measuredAt,
    actions,
}: BcsScoreCardProps) {
    return (
        <Card>
            <CardHeader className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-xl">Overzicht</CardTitle>
                        <CardDescription>
                            {measuredAt
                                ? measuredAt
                                : "BodemConditieScore met alle visuele indicatoren en afgeleide labindicatoren."}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className={cn(
                                "w-fit border px-4 py-2 text-sm font-semibold",
                                BCS_COLOR_CLASSES[scoreColor],
                            )}
                        >
                            {scoreLabel}
                        </Badge>
                        {actions}
                    </div>
                </div>
                <div className={cn("rounded-xl border p-4", BCS_COLOR_CLASSES[scoreColor])}>
                    <div className="text-sm font-medium opacity-80">BodemConditieScore</div>
                    <div className="mt-1 text-4xl font-bold">{d_bcs.toFixed(0)}</div>
                    <div className="mt-2 text-sm">
                        {(i_bcs * 100).toFixed(0)}% van de maximale score
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {BCS_INDICATORS.map((indicator) => {
                    const score =
                        indicator.key === "a_ph_bcs"
                            ? a_ph_bcs ?? null
                            : indicator.key === "a_som_bcs"
                              ? a_som_bcs ?? null
                              : scores[indicator.key] ?? null

                    const color =
                        score == null
                            ? null
                            : indicatorScoreColor(score, indicator.direction)

                    return (
                        <div
                            key={indicator.key}
                            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border p-3"
                        >
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{indicator.name}</span>
                                    {indicator.source === "lab" ? (
                                        <span className="text-xs text-muted-foreground">
                                            (afgeleid)
                                        </span>
                                    ) : null}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Weging x{indicator.weight}
                                </div>
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">
                                {score == null ? "Onbekend" : `Score ${score}`}
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <span
                                    className={cn(
                                        "size-3 rounded-full",
                                        color ? BCS_SCORE_DOT[color] : "bg-muted-foreground/30",
                                    )}
                                />
                            </div>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
