import { Bot, Info, Pencil } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { GerritFeedback } from "./feedback"
import type { FarmTotals } from "./types"

// ---------------------------------------------------------------------------
// NormStatusCard — compact single card: norm bars + N-balance + strategy
// ---------------------------------------------------------------------------

interface NormStatusCardProps {
    farmTotals?: FarmTotals
    activeStrategyLabels: string[]
    onEditStrategy: () => void
}

function InlineNormBar({
    label,
    filling,
    norm,
}: {
    label: string
    filling: number
    norm: number
}) {
    const over = norm > 0 ? filling > norm : filling > 0
    const pct = norm > 0 ? (filling / norm) * 100 : filling > 0 ? 100 : 0
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center gap-1">
                <span className="text-[11px] font-medium text-muted-foreground truncate">
                    {label}
                </span>
                <span
                    className={`text-[11px] font-bold tabular-nums shrink-0 ${over ? "text-red-600" : "text-foreground"}`}
                >
                    {Math.round(filling)}/{Math.round(norm)}
                </span>
            </div>
            <Progress
                value={Math.max(0, Math.min(pct, 100))}
                colorBar={over ? "red-500" : "green-500"}
                className="h-1.5"
            />
        </div>
    )
}

export function NormStatusCard({
    farmTotals,
    activeStrategyLabels,
    onEditStrategy,
}: NormStatusCardProps) {
    return (
        <Card className="shadow-sm">
            <CardContent className="pt-4 pb-3 space-y-3">
                {/* Norm bars — 3 columns */}
                {farmTotals && (
                    <div className="grid grid-cols-3 gap-4">
                        <InlineNormBar
                            label="Dierlijke N"
                            filling={farmTotals.normsFilling.manure}
                            norm={farmTotals.norms.manure}
                        />
                        <InlineNormBar
                            label="Werkzame N"
                            filling={farmTotals.normsFilling.nitrogen}
                            norm={farmTotals.norms.nitrogen}
                        />
                        <InlineNormBar
                            label="Fosfaat P₂O₅"
                            filling={farmTotals.normsFilling.phosphate}
                            norm={farmTotals.norms.phosphate}
                        />
                    </div>
                )}

                {/* N-balance + strategy + edit — single row */}
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t">
                    {farmTotals?.nBalance && (
                        <span
                            className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                                farmTotals.nBalance.balance <= farmTotals.nBalance.target
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                            }`}
                        >
                            N-balans {Math.round(farmTotals.nBalance.balance)}/{Math.round(farmTotals.nBalance.target)} kg/ha
                        </span>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap flex-1">
                        <Bot className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {activeStrategyLabels.length > 0 ? (
                            activeStrategyLabels.map((label) => (
                                <Badge key={label} variant="secondary" className="text-[10px] py-0 h-5">
                                    {label}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-[11px] text-muted-foreground">Standaard strategie</span>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={onEditStrategy}
                    >
                        <Pencil className="h-3 w-3" />
                        Wijzig
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

// ---------------------------------------------------------------------------
// GerritExplanationCard — Gerrit's narrative summary + feedback
// ---------------------------------------------------------------------------

interface GerritExplanationCardProps {
    planSummary?: string
    traceId?: string
}

export function GerritExplanationCard({
    planSummary,
    traceId,
}: GerritExplanationCardProps) {
    if (!planSummary) return null
    return (
        <Card className="bg-primary/5 border-primary/20 flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Info className="w-4 h-4" />
                    Toelichting van Gerrit
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground italic mb-6">
                    "{planSummary}"
                </p>
                {traceId && (
                    <div className="mt-auto pt-4 border-t border-primary/10">
                        <GerritFeedback traceId={traceId} />
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ---------------------------------------------------------------------------
// SummaryCards — kept for backwards compatibility
// ---------------------------------------------------------------------------

interface SummaryCardsProps {
    farmTotals?: FarmTotals
    planSummary?: string
    activeStrategyLabels: string[]
    onEditStrategy: () => void
    traceId?: string
}

export function SummaryCards({
    farmTotals,
    planSummary,
    activeStrategyLabels,
    onEditStrategy,
    traceId,
}: SummaryCardsProps) {
    return (
        <>
            <NormStatusCard
                farmTotals={farmTotals}
                activeStrategyLabels={activeStrategyLabels}
                onEditStrategy={onEditStrategy}
            />
            <GerritExplanationCard planSummary={planSummary} traceId={traceId} />
        </>
    )
}
