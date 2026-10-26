import type {
  DynaV2NitrogenBalance,
  MineralizationInsights,
  SeasonPhase,
} from "@nmi-agro/fdm-calculator"
import { ArrowRight, ChevronDown, Lightbulb } from "lucide-react"
import { NavLink } from "react-router"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { formatKgN, formatNumber, type SeasonTiming } from "~/lib/mineralization"
import { cn } from "~/lib/utils"

/**
 * Key figures shown above the chart. Which figures, and whether they are called expected, depends
 * on the phase and on where today lies relative to the harvest.
 */
export function KeyFigures({
  insights,
  phase,
  timing,
}: {
  insights: MineralizationInsights
  phase: SeasonPhase
  timing: SeasonTiming
}) {
  const { kpis } = insights
  const efficiency = {
    label: "Benutting",
    value: kpis.nUseEfficiency === null ? "–" : `${formatNumber(kpis.nUseEfficiency * 100)}%`,
  }
  let figures: { label: string; value: string }[]
  if (phase === "evaluation" || timing === "past") {
    figures = [
      { label: "N-opname gewas", value: formatKgN(kpis.totalUptake) },
      efficiency,
      { label: "Uitspoeling", value: formatKgN(kpis.totalLeaching) },
      { label: "Beschikbaar bij oogst", value: formatKgN(kpis.residualNAtHarvest) },
    ]
  } else if (timing === "future") {
    figures = [
      { label: "Verwachte opname", value: formatKgN(kpis.totalUptake) },
      efficiency,
      { label: "Verwachte uitspoeling", value: formatKgN(kpis.totalLeaching) },
      { label: "Verwacht bij oogst", value: formatKgN(kpis.residualNAtHarvest) },
    ]
  } else if (timing === "after_harvest") {
    figures = [
      { label: "Beschikbare N nu", value: formatKgN(kpis.availableNNow) },
      { label: "N-opname gewas", value: formatKgN(kpis.totalUptake) },
      { label: "Beschikbaar bij oogst", value: formatKgN(kpis.residualNAtHarvest) },
      { label: "Uitspoeling tot eind jaar", value: formatKgN(kpis.totalLeaching) },
    ]
  } else {
    figures = [
      { label: "Beschikbare N nu", value: formatKgN(kpis.availableNNow) },
      { label: "N-opname tot nu", value: formatKgN(kpis.uptakeToDate) },
      { label: "Verwachte opname seizoen", value: formatKgN(kpis.totalUptake) },
      { label: "Verwachte uitspoeling", value: formatKgN(kpis.totalLeaching) },
    ]
  }

  return (
    // Four in a row only when the card is wide enough, not when the viewport is
    <div className="@container">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 @lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt className="text-muted-foreground text-xs">{figure.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Plain-language explanation of the chart. */
export function ChartExplainer() {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group text-muted-foreground -ml-2">
          <ChevronDown
            className="transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
          Wat zie ik?
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <dl className="text-muted-foreground max-w-prose space-y-2 text-sm">
          <div>
            <dt className="text-foreground inline font-medium">N-aanbod: </dt>
            <dd className="inline">
              stikstof die sinds de start van de berekening vrijkomt uit bodem, mest en gewasresten
              en voor het gewas beschikbaar komt.
            </dd>
          </div>
          <div>
            <dt className="text-foreground inline font-medium">N-opname: </dt>
            <dd className="inline">stikstof die het gewas tot die dag heeft opgenomen.</dd>
          </div>
          <div>
            <dt className="text-foreground inline font-medium">Beschikbare N: </dt>
            <dd className="inline">
              het verschil tussen aanbod en opname: wat er nog voor het gewas in de bodem zit.
              Blijft er na de oogst veel over, dan kan dat uitspoelen.
            </dd>
          </div>
          <div>
            <dt className="text-foreground inline font-medium">Nitraatuitspoeling: </dt>
            <dd className="inline">stikstof die als nitraat naar het grondwater verdwijnt.</dd>
          </div>
          <p>
            Tot vandaag rekent het model met gemeten weer (doorgetrokken lijnen), daarna met de
            weersverwachting en na afloop van de verwachting met het langjarig klimaatgemiddelde
            (gestreepte lijnen, grijs gearceerd). In het groeiseizoen zie je de afgelopen 30 en
            komende 14 dagen; bij planning en evaluatie het hele jaar. De iconen boven de grafiek
            tonen zaai, bemesting (met dezelfde vormen als bij Bemestingen) en oogst, met een lijn
            naar de datum: gestreept betekent gepland, gestippeld een gift uit je scenario.
          </p>
        </dl>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Tint of the N-supply color of the chart. */
function supplyTint(percent: number): string {
  return `color-mix(in oklab, var(--chart-3) ${percent}%, var(--color-background))`
}

// The sources of supply are tints of the chart's N-aanbod color and uptake uses the N-opname
// color, so the balance reads the same as the chart; the labels tell the sources apart.
const BALANCE_PARTS: {
  key: keyof DynaV2NitrogenBalance | "soil"
  label: string
  color: string
}[] = [
  { key: "soil", label: "Bodem", color: supplyTint(100) },
  { key: "b_n_fertilizer_mineral", label: "Kunstmest", color: supplyTint(78) },
  { key: "b_n_fertilizer_organic", label: "Organische mest", color: supplyTint(58) },
  { key: "b_n_fertilizer_preceeding", label: "Nawerking eerdere bemesting", color: supplyTint(42) },
  { key: "b_n_greenmanure", label: "Groenbemester", color: supplyTint(28) },
]

/** Workable nitrogen balance: where the available nitrogen comes from, against crop uptake. */
export function NitrogenBalanceCard({
  balance,
  hasFertilizerApplications,
}: {
  balance: DynaV2NitrogenBalance
  /** Whether fertilizer applications were part of the calculation. */
  hasFertilizerApplications: boolean
}) {
  const fromFertilizers =
    balance.b_n_fertilizer_mineral +
    balance.b_n_fertilizer_organic +
    balance.b_n_fertilizer_preceeding +
    balance.b_n_greenmanure
  const values: Record<string, number> = {
    soil: Math.max(balance.b_nw - fromFertilizers, 0),
    b_n_fertilizer_mineral: balance.b_n_fertilizer_mineral,
    b_n_fertilizer_organic: balance.b_n_fertilizer_organic,
    b_n_fertilizer_preceeding: balance.b_n_fertilizer_preceeding,
    b_n_greenmanure: balance.b_n_greenmanure,
  }
  const supply = Object.values(values).reduce((sum, v) => sum + v, 0)
  const scale = Math.max(supply, balance.b_n_uptake, 1)
  const parts = BALANCE_PARTS.filter((p) => values[p.key] > 0)
  const surplus = supply - balance.b_n_uptake
  // Applications were sent, but the result attributes no nitrogen to them: say so rather than
  // silently showing all supply as soil
  const fertilizerNotAttributed =
    hasFertilizerApplications &&
    balance.b_n_fertilizer_mineral + balance.b_n_fertilizer_organic === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Werkzame stikstofbalans</CardTitle>
        <CardDescription>
          Hoeveel werkzame stikstof er beschikbaar kwam en hoeveel het gewas daarvan opnam.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Aanbod</span>
            <span className="tabular-nums">{formatKgN(supply)}</span>
          </div>
          <div className="bg-muted flex h-3 gap-[2px] overflow-hidden rounded-sm" aria-hidden>
            {parts.map((part) => (
              <div
                key={part.key}
                style={{ width: `${(values[part.key] / scale) * 100}%`, background: part.color }}
              />
            ))}
          </div>
          <div className="flex items-baseline justify-between pt-1 text-sm">
            <span className="font-medium">Opname door het gewas</span>
            <span className="tabular-nums">{formatKgN(balance.b_n_uptake)}</span>
          </div>
          <div className="bg-muted h-3 overflow-hidden rounded-sm" aria-hidden>
            <div
              className="h-full"
              style={{
                width: `${(balance.b_n_uptake / scale) * 100}%`,
                background: "var(--chart-2)",
              }}
            />
          </div>
        </div>
        <ul className={cn("grid gap-1.5 text-sm", parts.length > 1 && "sm:grid-cols-2")}>
          {parts.map((part) => (
            <li key={part.key} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <span
                  className="size-2.5 shrink-0 rounded-[2px]"
                  style={{ background: part.color }}
                  aria-hidden
                />
                {part.label}
              </span>
              <span className="tabular-nums">{formatKgN(values[part.key])}</span>
            </li>
          ))}
        </ul>
        <p className="border-t pt-3 text-sm">
          {surplus >= 0
            ? `Er bleef ${formatKgN(surplus)} meer beschikbaar dan het gewas opnam.`
            : `Het gewas nam ${formatKgN(-surplus)} meer op dan er beschikbaar kwam.`}
        </p>
        {fertilizerNotAttributed ? (
          <p className="text-muted-foreground text-xs">
            Let op: dit perceel heeft bemestingen, maar de berekening wijst er geen stikstof aan
            toe. Het aanbod staat daardoor volledig onder Bodem.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Season evaluation: what went well and what can be improved, with a link to plan next year. */
export function EvaluationCard({
  insights,
  nextYear,
  nextYearHref,
}: {
  insights: MineralizationInsights
  nextYear: number
  /** Planning view of the same field in the next year. */
  nextYearHref: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evaluatie van het seizoen</CardTitle>
        <CardDescription>Aandachtspunten voor het bemestingsplan van volgend jaar.</CardDescription>
      </CardHeader>
      <CardContent>
        {insights.improvementPoints.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Geen opvallende punten: aanbod en opname sloten goed op elkaar aan.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {insights.improvementPoints.map((point) => (
              <li key={point} className="flex gap-2">
                <Lightbulb className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" size="sm">
          <NavLink to={nextYearHref}>
            Plan {nextYear}
            <ArrowRight aria-hidden />
          </NavLink>
        </Button>
      </CardFooter>
    </Card>
  )
}
