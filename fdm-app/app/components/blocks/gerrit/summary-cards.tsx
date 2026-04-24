import { Bot, CircleCheck, CircleX, Info, Pencil } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { Separator } from "~/components/ui/separator"
import { GerritFeedback } from "./feedback"
import type { FarmTotals } from "./types"

interface StrategySummaryCardProps {
    activeStrategyLabels: string[]
    onEditStrategy: () => void
}

export function StrategySummaryCard({
    activeStrategyLabels,
    onEditStrategy,
}: StrategySummaryCardProps) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex-row gap-4">
                <Bot className="text-lg text-muted-foreground shrink-0" />
                <div>
                    <CardTitle className="text-lg">
                        De bemestingsplan door Gerrit staat klaar.
                    </CardTitle>
                    <CardDescription>
                        Gerrit heeft the onderstande strategie gevolgd.
                    </CardDescription>
                </div>
                <Button
                    variant="outline"
                    className="ms-auto gap-2 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={onEditStrategy}
                >
                    <Pencil className="h-4 w-4" />
                    Wijzig strategie
                </Button>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                    {activeStrategyLabels.length > 0 ? (
                        activeStrategyLabels.map((label) => (
                            <Badge
                                key={label}
                                variant="secondary"
                                className="text-[10px] py-0 h-5"
                            >
                                {label}
                            </Badge>
                        ))
                    ) : (
                        <span className="text-[11px] text-muted-foreground">
                            Standaard strategie
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

// ---------------------------------------------------------------------------
// NormStatusCard — compact single card: norm bars + N-balance + strategy
// ---------------------------------------------------------------------------

interface NormStatusCardProps {
    calendar: string
    farmTotals?: FarmTotals
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

export function NormStatusCard({ calendar, farmTotals }: NormStatusCardProps) {
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>
                    Gebruiksruimte in {calendar} na de voorgestelde bemestingen
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
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
            </CardContent>
            <Separator />
            <CardHeader>
                <CardTitle>Stikstofbalans (Overschot / Doel)</CardTitle>
            </CardHeader>
            {/* N-balance + strategy + edit — single row */}
            <CardContent className="flex items-center gap-4">
                <p>
                    {Math.round(farmTotals.nBalance.balance)}/
                    {Math.round(farmTotals.nBalance.target)} kg/ha
                </p>
                {farmTotals.nBalance.balance <= farmTotals.nBalance.target ? (
                    <CircleCheck className="text-green-500 bg-green-100 p-0 rounded-full " />
                ) : (
                    <CircleX className="text-red-500 bg-red-100 rounded-full " />
                )}
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
                    <Button
                        asChild
                        variant="link"
                        className="ms-auto px-0 text-muted-foreground underline hover:text-primary"
                    >
                        <a href="#chat">Stel er een vraag over...</a>
                    </Button>
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
            <GerritExplanationCard
                planSummary={planSummary}
                traceId={traceId}
            />
        </>
    )
}
