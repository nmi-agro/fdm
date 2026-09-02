import type { Dose, NutrientAdviceCut } from "@nmi-agro/fdm-calculator"
import type { FertilizerApplication, Harvest } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { Check } from "lucide-react"
import { useState } from "react"
import { NavLink } from "react-router"
import {
  buildCutSeason,
  CUT_YIELD_CLASS_LABELS,
  type CutSeasonRow,
} from "~/components/blocks/nutrient-advice/cuts"
import {
  AdviceProgressBar,
  formatSignedDifference,
} from "~/components/blocks/nutrient-advice/progress-bar"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { cn } from "~/lib/utils"

export type CutAdviceCardProps = {
  cuts: NutrientAdviceCut[]
  harvests: Harvest[]
  fertilizerApplications: FertilizerApplication[]
  doses: Dose[]
  /** ISO date string for "today", computed server-side so hydration cannot drift. */
  today: string
  isCurrentYear: boolean
  /** Link target builder for a recorded harvest. */
  harvestTo: (b_id_harvesting: string) => string
}

function formatAdviceValue(value: number) {
  return value > 1 ? Math.round(value).toLocaleString("nl-NL") : value.toPrecision(2)
}

/**
 * Default scenario per snede: "Maaien" is the reference most advisors plan around; fall back to
 * the first variant the API returned when mowing is not among the options.
 */
function defaultYieldClass(variants: NutrientAdviceCut[]): NutrientAdviceCut["yieldclass"] {
  return (
    variants.find((variant) => variant.yieldclass === "M")?.yieldclass ?? variants[0].yieldclass
  )
}

/**
 * The "Advies per snede" card: one row per grassland snede. The NMI API returns the advice per
 * snede for every possible snedezwaarte (scenario); the advisor picks the applicable scenario
 * per row and the advice and nitrogen filling follow that choice.
 */
export function CutAdviceCard({
  cuts,
  harvests,
  fertilizerApplications,
  doses,
  today,
  isCurrentYear,
  harvestTo,
}: CutAdviceCardProps) {
  const season = buildCutSeason({
    cuts,
    harvests,
    fertilizerApplications,
    doses,
    isCurrentYear,
    today: new Date(today),
  })

  const [selectedYieldClass, setSelectedYieldClass] = useState<
    Record<number, NutrientAdviceCut["yieldclass"]>
  >(() =>
    Object.fromEntries(
      season.rows.map((row) => [row.cut, row.derivedYieldClass ?? defaultYieldClass(row.variants)]),
    ),
  )

  const showSeasonColumns = season.hasHarvests

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advies per snede</CardTitle>
        <CardDescription>
          Het advies verschilt per snede en per snedezwaarte. Kies per snede de verwachte
          snedezwaarte; bij een geregistreerde oogst volgt de snedezwaarte uit de
          droge-stofopbrengst. Alle waarden in kg/ha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Snede</TableHead>
              <TableHead>Snedezwaarte</TableHead>
              <TableHead className="text-right">N</TableHead>
              <TableHead className="text-right">P₂O₅</TableHead>
              <TableHead className="text-right">K₂O</TableHead>
              <TableHead className="text-right">S</TableHead>
              {showSeasonColumns ? <TableHead>Oogst</TableHead> : null}
              {showSeasonColumns ? <TableHead>Vulling N</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {season.rows.map((row) => (
              <CutSeasonTableRow
                key={row.cut}
                row={row}
                selectedYieldClass={selectedYieldClass[row.cut]}
                onSelectYieldClass={(yieldclass) =>
                  setSelectedYieldClass((current) => ({ ...current, [row.cut]: yieldclass }))
                }
                showSeasonColumns={showSeasonColumns}
                harvestTo={harvestTo}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CutSeasonTableRow({
  row,
  selectedYieldClass,
  onSelectYieldClass,
  showSeasonColumns,
  harvestTo,
}: {
  row: CutSeasonRow
  selectedYieldClass: NutrientAdviceCut["yieldclass"]
  onSelectYieldClass: (yieldclass: NutrientAdviceCut["yieldclass"]) => void
  showSeasonColumns: boolean
  harvestTo: (b_id_harvesting: string) => string
}) {
  const variant =
    row.variants.find(
      (entry) => entry.yieldclass === (row.derivedYieldClass ?? selectedYieldClass),
    ) ?? row.variants[0]

  return (
    <TableRow
      className={cn(row.state === "next" && "bg-primary/5 hover:bg-primary/5")}
      aria-current={row.state === "next" ? "true" : undefined}
    >
      <TableCell>
        <div className="flex items-center gap-1.5">
          {row.state === "realised" ? (
            <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
          ) : null}
          <span className="font-medium whitespace-nowrap">Snede {row.cut}</span>
          {row.state === "next" ? <Badge className="text-xs">Komende snede</Badge> : null}
        </div>
      </TableCell>
      <TableCell>
        {row.derivedYieldClass ? (
          <span className="text-sm">{CUT_YIELD_CLASS_LABELS[row.derivedYieldClass]}</span>
        ) : (
          <Select value={variant.yieldclass} onValueChange={onSelectYieldClass}>
            <SelectTrigger className="h-8 w-48" aria-label={`Snedezwaarte voor snede ${row.cut}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {row.variants.map((entry) => (
                <SelectItem key={entry.yieldclass} value={entry.yieldclass}>
                  {CUT_YIELD_CLASS_LABELS[entry.yieldclass]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatAdviceValue(variant.d_n_req)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatAdviceValue(variant.d_p_req)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatAdviceValue(variant.d_k_req)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatAdviceValue(variant.d_s_req)}
      </TableCell>
      {showSeasonColumns ? (
        <TableCell>
          {row.harvest ? (
            <div className="text-sm">
              <NavLink
                to={harvestTo(row.harvest.b_id_harvesting)}
                className="hover:text-foreground underline-offset-4 hover:underline"
              >
                {format(row.harvest.date, "d MMM", { locale: nl })}
              </NavLink>
              {row.harvest.dmYield !== null ? (
                <div className="text-muted-foreground text-xs tabular-nums">
                  {Math.round(row.harvest.dmYield).toLocaleString("nl-NL")} kg DS/ha
                </div>
              ) : null}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      ) : null}
      {showSeasonColumns ? (
        <TableCell>
          {row.nitrogenDose !== null ? (
            <div className="flex items-center gap-2">
              <AdviceProgressBar
                current={row.nitrogenDose}
                target={variant.d_n_req}
                className="h-1.5 w-20"
              />
              <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                {formatAdviceValue(row.nitrogenDose)} kg (
                {formatSignedDifference(row.nitrogenDose - variant.d_n_req)})
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      ) : null}
    </TableRow>
  )
}
