import type { PlanNormsSummary } from "~/lib/season-plan.server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"

/** Formats an amount with Dutch number formatting. */
function formatNumber(value: number): string {
  return value.toLocaleString("nl-NL", { maximumFractionDigits: 0 })
}

/** The filling of the legal norms of the farm, with a provisional label when needed. */
export function PlanNextNormsCard({
  year,
  norms,
}: {
  year: number
  norms: PlanNormsSummary | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gebruiksruimte {year}</CardTitle>
        <CardDescription>
          {norms?.provisional
            ? `Voorlopig, gebaseerd op normen ${norms.normsYear}: voor ${year} zijn nog geen gebruiksnormen gepubliceerd.`
            : "Vulling van de gebruiksnormen van het bedrijf met de bemesting die nu is vastgelegd."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {norms ? (
          norms.bars.map((bar) => {
            const percentage = bar.norm > 0 ? Math.round((bar.filling / bar.norm) * 100) : 0
            const over = bar.filling > bar.norm
            return (
              <div key={bar.key} className="space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span>{bar.label}</span>
                  <span
                    key={over ? "over" : "ok"}
                    className={
                      over ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"
                    }
                  >
                    {`${formatNumber(bar.filling)} van ${formatNumber(bar.norm)} ${bar.unit} (${percentage}%)${over ? " – boven de norm" : ""}`}
                  </span>
                </div>
                <Progress
                  value={Math.min(percentage, 100)}
                  indicatorClassName={over ? "bg-red-600" : undefined}
                />
              </div>
            )
          })
        ) : (
          <p className="text-muted-foreground text-sm">
            De gebruiksruimte kon niet worden berekend. Controleer de bodemanalyses en gewassen op
            de pagina Gebruiksruimte.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
