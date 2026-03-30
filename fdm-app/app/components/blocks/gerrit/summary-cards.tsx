import { Bot, Info, Pencil } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { GerritFeedback } from "./feedback"
import { NormBar } from "./norm-bar"
import type { FarmTotals } from "./types"

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
            {/* Farm-level norm compliance — first so users see compliance status immediately */}
            {farmTotals && (
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">
                            Bedrijfsnormen
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Totale invulling op bedrijfsniveau (kg)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <NormBar
                            label="Dierlijke mest N"
                            filling={farmTotals.normsFilling.manure}
                            norm={farmTotals.norms.manure}
                        />
                        <NormBar
                            label="Werkzame stikstof N"
                            filling={farmTotals.normsFilling.nitrogen}
                            norm={farmTotals.norms.nitrogen}
                        />
                        <NormBar
                            label="Fosfaat P₂O₅"
                            filling={farmTotals.normsFilling.phosphate}
                            norm={farmTotals.norms.phosphate}
                        />
                        {/* N-balance: agronomic balance vs target */}
                        {farmTotals.nBalance && (
                            <div className="pt-2 border-t space-y-1.5">
                                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                    Stikstofbalans
                                </span>
                                <div className="flex justify-between items-baseline gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        Balans op bedrijfsniveau
                                    </span>
                                    <span className={`text-xs font-semibold tabular-nums ${farmTotals.nBalance.balance <= farmTotals.nBalance.target ? "text-green-600" : "text-red-600"}`}>
                                        {Math.round(farmTotals.nBalance.balance)}{" "}
                                        kg N/ha
                                    </span>
                                </div>
                                <div className="flex justify-between items-baseline gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        Doel
                                    </span>
                                    <span className="text-xs font-semibold tabular-nums">
                                        {Math.round(farmTotals.nBalance.target)}{" "}
                                        kg N/ha
                                    </span>
                                </div>
                                <div className="flex justify-between items-baseline gap-2 pt-0.5 border-t">
                                    <span className="text-xs font-medium">
                                        Status
                                    </span>
                                    <span
                                        className={`text-xs font-bold tabular-nums ${farmTotals.nBalance.balance <= farmTotals.nBalance.target ? "text-green-600" : "text-red-600"}`}
                                    >
                                        {farmTotals.nBalance.balance <=
                                        farmTotals.nBalance.target
                                            ? "Binnen doel"
                                            : "Boven doel"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Gerrit's narrative summary */}
            {planSummary && (
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
            )}

            {/* Compact strategy summary */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Bot className="w-5 h-5 text-primary" />
                        Gehanteerde strategie
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {activeStrategyLabels.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {activeStrategyLabels.map((label) => (
                                <Badge key={label} variant="secondary">
                                    {label}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Geen specifieke strategie geselecteerd.
                        </p>
                    )}
                </CardContent>
                <CardFooter className="border-t pt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={onEditStrategy}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        Wijzig & herbereken
                    </Button>
                </CardFooter>
            </Card>
        </>
    )
}
