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
import type { FarmTotals } from "./types"
import { GerritFeedback } from "./feedback"
import { NormBar } from "./norm-bar"

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
            <CardTitle className="text-sm font-semibold">Bedrijfsnormen</CardTitle>
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
              <div className="space-y-1.5 border-t pt-2">
                <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                  Stikstofbalans
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-xs">Balans op bedrijfsniveau</span>
                  <span
                    className={`text-xs font-semibold tabular-nums ${farmTotals.nBalance.balance <= farmTotals.nBalance.target ? "text-green-600" : "text-red-600"}`}
                  >
                    {Math.round(farmTotals.nBalance.balance)} kg N/ha
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-xs">Doel</span>
                  <span className="text-xs font-semibold tabular-nums">
                    {Math.round(farmTotals.nBalance.target)} kg N/ha
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-t pt-0.5">
                  <span className="text-xs font-medium">Status</span>
                  <span
                    className={`text-xs font-bold tabular-nums ${farmTotals.nBalance.balance <= farmTotals.nBalance.target ? "text-green-600" : "text-red-600"}`}
                  >
                    {farmTotals.nBalance.balance <= farmTotals.nBalance.target
                      ? "Binnen doel"
                      : "Boven doel"}
                  </span>
                </div>
                {farmTotals.nBalance.emission && (
                  <div className="space-y-1.5 border-t pt-2">
                    <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                      Emissies
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground text-xs">Ammoniakemissie</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {Math.round(Math.abs(farmTotals.nBalance.emission.ammonia.total))} kg N/ha
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground text-xs">Nitraatuitspoeling</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {Math.round(Math.abs(farmTotals.nBalance.emission.nitrate))} kg N/ha
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gerrit's narrative summary */}
      {planSummary && (
        <Card className="bg-primary/5 border-primary/20 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary flex items-center gap-2 text-sm font-semibold">
              <Info className="h-4 w-4" />
              Toelichting van Gerrit
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <p className="text-muted-foreground mb-6 text-sm leading-relaxed whitespace-pre-wrap italic">
              "{planSummary}"
            </p>
            {traceId && (
              <div className="border-primary/10 mt-auto border-t pt-4">
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
            <Bot className="text-primary h-5 w-5" />
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
            <p className="text-muted-foreground text-sm">Geen specifieke strategie geselecteerd.</p>
          )}
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={onEditStrategy}>
            <Pencil className="h-3.5 w-3.5" />
            Wijzig & herbereken
          </Button>
        </CardFooter>
      </Card>
    </>
  )
}
