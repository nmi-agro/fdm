import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  CircleAlert,
  CircleCheck,
} from "lucide-react"
import { useId, useState } from "react"
import { NavLink, useRevalidator } from "react-router"
import { Line, LineChart, ReferenceLine, Tooltip as ChartTooltip, YAxis } from "recharts"
import { getHarvestTerm } from "~/components/blocks/harvest/utils"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import {
  type AttentionItem,
  type FieldMineralizationOk,
  type FieldMineralizationOutcome,
  formatKg,
  formatKgN,
  formatLongDate,
  getAttentionItems,
  getAttentionPriority,
  getNotCalculatedReason,
  type MineralizationMainCultivation,
  seriesInYear,
} from "~/lib/mineralization"
import { SignalChips } from "./signal-chips"

/** Field row of the farm overview. */
export interface FarmOverviewField {
  b_id: string
  b_name: string | null
  b_area: number | null
}

interface FarmOverviewProps {
  fields: FarmOverviewField[]
  outcomes: Record<string, FieldMineralizationOutcome>
  year: number
  isCurrentYear: boolean
  fieldHref: (b_id: string) => string
  /** Link to the bulk harvest form for one crop and the given fields. */
  harvestHref: (b_lu_catalogue: string, fieldIds: string[]) => string
}

function cropName(outcome: FieldMineralizationOutcome | undefined): string | null {
  if (outcome?.status === "ok" || outcome?.status === "missing_harvest") {
    return outcome.mainCultivation.b_lu_name ?? outcome.mainCultivation.b_lu_catalogue
  }
  return null
}

/** Main crop as the colored crop badge used in the crop rotation and field tables. */
function CropBadge({ outcome }: { outcome: FieldMineralizationOutcome }) {
  if (outcome.status !== "ok" && outcome.status !== "missing_harvest") {
    return <span className="text-muted-foreground">–</span>
  }
  const { mainCultivation } = outcome
  return (
    <Badge
      variant="default"
      className="max-w-56 whitespace-normal text-white"
      style={{
        backgroundColor: getCultivationColor(mainCultivation.b_lu_croprotation ?? undefined),
      }}
    >
      {mainCultivation.b_lu_name ?? mainCultivation.b_lu_catalogue}
    </Badge>
  )
}

function plural(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Counts the outcomes per status. */
function countOutcomes(fields: FarmOverviewField[], outcomes: FarmOverviewProps["outcomes"]) {
  const counts = { pending: 0, ok: 0, missingHarvest: 0, error: 0, attention: 0 }
  for (const field of fields) {
    const outcome = outcomes[field.b_id]
    if (!outcome) counts.pending++
    else if (outcome.status === "ok") {
      counts.ok++
      // Same items as the attention list, including cuts that could not be calculated
      if (getAttentionItems(outcome).length > 0) counts.attention++
    } else if (outcome.status === "missing_harvest") counts.missingHarvest++
    else if (outcome.status === "error") counts.error++
  }
  return counts
}

/**
 * One line summary of the calculation: how many fields have a result, how many wait for a harvest
 * and how many show a signal.
 */
export function FarmSummary({ fields, outcomes }: Pick<FarmOverviewProps, "fields" | "outcomes">) {
  const counts = countOutcomes(fields, outcomes)
  const calculable = counts.ok + counts.missingHarvest + counts.error + counts.pending

  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-foreground inline-flex items-center gap-1.5">
        {counts.pending > 0 ? <Spinner /> : null}
        {counts.ok === calculable
          ? `${plural(calculable, "perceel", "percelen")} berekend`
          : `${counts.ok} van ${plural(calculable, "perceel", "percelen")} berekend`}
      </span>
      {counts.missingHarvest > 0 ? (
        <>
          <span aria-hidden>·</span>
          <span>{counts.missingHarvest} wachten op een oogst</span>
        </>
      ) : null}
      {counts.error > 0 ? (
        <>
          <span aria-hidden>·</span>
          <span>{counts.error} niet gelukt</span>
        </>
      ) : null}
      <span aria-hidden>·</span>
      <span>
        {counts.attention === 1 ? "1 perceel vraagt" : `${counts.attention} percelen vragen`}{" "}
        aandacht
      </span>
    </p>
  )
}

interface MissingHarvestGroup {
  mainCultivation: MineralizationMainCultivation
  fields: FarmOverviewField[]
}

/** Groups the fields without a harvest by the crop of their main cultivation. */
function groupMissingHarvests(
  fields: FarmOverviewField[],
  outcomes: FarmOverviewProps["outcomes"],
): MissingHarvestGroup[] {
  const groups = new Map<string, MissingHarvestGroup>()
  for (const field of fields) {
    const outcome = outcomes[field.b_id]
    if (outcome?.status !== "missing_harvest") continue
    const key = outcome.mainCultivation.b_lu_catalogue
    const group = groups.get(key) ?? { mainCultivation: outcome.mainCultivation, fields: [] }
    group.fields.push(field)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.fields.length - a.fields.length)
}

function fieldNames(fields: FarmOverviewField[], max = 4): string {
  const names = fields.map((f) => f.b_name ?? "Perceel")
  if (names.length <= max) return names.join(", ")
  return `${names.slice(0, max).join(", ")} en ${names.length - max} andere`
}

/**
 * Fields that need attention: agronomic signals first, then the fields that wait for a harvest,
 * grouped per crop so they can be completed at once.
 */
export function FarmAttentionList({ fields, outcomes, fieldHref, harvestHref }: FarmOverviewProps) {
  const revalidator = useRevalidator()
  const pending = fields.some((f) => !outcomes[f.b_id])
  const items = fields
    .map((field) => {
      const outcome = outcomes[field.b_id]
      const attention =
        outcome && outcome.status !== "missing_harvest" ? getAttentionItems(outcome) : []
      return { field, outcome, attention }
    })
    .filter((row) => row.attention.length > 0)
    .sort(
      (a, b) =>
        getAttentionPriority(a.attention[0] as AttentionItem) -
        getAttentionPriority(b.attention[0] as AttentionItem),
    )
  const missingHarvests = groupMissingHarvests(fields, outcomes)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aandacht nodig</CardTitle>
        <CardDescription>
          Percelen waar een stikstoftekort dreigt, regen rond een geplande gift valt, veel stikstof
          verloren kan gaan of de berekening niet lukte.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {items.length === 0 ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            {pending ? (
              <>
                <Spinner /> Percelen worden berekend…
              </>
            ) : (
              <>
                <CircleCheck className="size-4" aria-hidden />
                {missingHarvests.length > 0
                  ? "Geen signalen bij de berekende percelen."
                  : "Geen percelen die nu aandacht vragen."}
              </>
            )}
          </p>
        ) : (
          <ul className="divide-y">
            {items.map(({ field, outcome, attention }) => (
              <li
                key={field.b_id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm font-medium">
                    {field.b_name ?? "Perceel"}
                    {cropName(outcome) ? (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {cropName(outcome)}
                      </span>
                    ) : null}
                  </p>
                  <SignalChips items={attention} />
                </div>
                {attention[0]?.kind === "error" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto sm:self-center pointer-coarse:h-10"
                    onClick={() => revalidator.revalidate()}
                    disabled={revalidator.state !== "idle"}
                  >
                    {revalidator.state !== "idle" ? <Spinner /> : null}
                    Opnieuw berekenen
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto sm:self-center pointer-coarse:h-10"
                    nativeButton={false}
                    render={
                      <NavLink to={fieldHref(field.b_id)}>
                        Bekijk perceel
                        <ArrowRight aria-hidden />
                      </NavLink>
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {missingHarvests.length > 0 ? (
          <section className="space-y-3 border-t pt-5" aria-labelledby="ontbrekende-oogsten">
            <div className="space-y-1">
              <h3 id="ontbrekende-oogsten" className="text-sm font-semibold">
                Oogst ontbreekt
              </h3>
              <p className="text-muted-foreground text-sm">
                Zonder gemeten of geplande oogst kan de mineralisatie niet worden berekend. Vul ze
                per gewas in één keer in.
              </p>
            </div>
            <ul className="divide-y">
              {missingHarvests.map(({ mainCultivation, fields: groupFields }) => {
                const term = getHarvestTerm(
                  mainCultivation.b_lu_croprotation,
                  true,
                  mainCultivation.b_lu_harvestable,
                  true,
                )
                return (
                  <li
                    key={mainCultivation.b_lu_catalogue}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium">
                        {mainCultivation.b_lu_name ?? mainCultivation.b_lu_catalogue}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {plural(groupFields.length, "perceel", "percelen")}
                        </span>
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {fieldNames(groupFields)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto sm:self-center pointer-coarse:h-10"
                      nativeButton={false}
                      render={
                        <NavLink
                          to={harvestHref(
                            mainCultivation.b_lu_catalogue,
                            groupFields.map((f) => f.b_id),
                          )}
                        >
                          {term} invullen
                          <ArrowRight aria-hidden />
                        </NavLink>
                      }
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Sparkline colors: green while nitrogen is available, orange where uptake exceeds the supply. */
const SPARK_POSITIVE = "var(--color-green-600, #16a34a)"
const SPARK_NEGATIVE = "var(--color-orange-500, #f97316)"

type SparkPoint = FieldMineralizationOk["result"]["series"][number]

function AvailableNSparkline({ outcome, year }: { outcome: FieldMineralizationOk; year: number }) {
  const gradientId = `spark-${useId().replace(/:/g, "")}`
  const data = seriesInYear(outcome.result.series, year).filter((_, i) => i % 3 === 0)
  if (data.length < 2) return null
  const values = data.map((p) => p.b_n_available)
  const max = Math.max(...values)
  const min = Math.min(...values)
  // Where zero lies in the gradient, from the top (max) to the bottom (min) of the line
  const zero = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min)
  return (
    // The values are in the row as text; the tooltip is a mouse aid, hidden from screen readers
    <LineChart width={96} height={28} data={data} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset={zero} stopColor={SPARK_POSITIVE} />
          <stop offset={zero} stopColor={SPARK_NEGATIVE} />
        </linearGradient>
      </defs>
      <YAxis hide domain={["dataMin", "dataMax"]} />
      {min < 0 && max > 0 ? (
        <ReferenceLine
          y={0}
          stroke="var(--color-muted-foreground)"
          strokeOpacity={0.4}
          strokeDasharray="2 2"
        />
      ) : null}
      <Line
        type="monotone"
        dataKey="b_n_available"
        // A gradient on a flat line has no height to work with; use a plain color then
        stroke={max === min ? (max < 0 ? SPARK_NEGATIVE : SPARK_POSITIVE) : `url(#${gradientId})`}
        strokeWidth={1.5}
        dot={false}
        activeDot={({ cx, cy, payload }: { cx?: number; cy?: number; payload?: SparkPoint }) => (
          <circle
            cx={cx}
            cy={cy}
            r={2.5}
            fill={(payload?.b_n_available ?? 0) < 0 ? SPARK_NEGATIVE : SPARK_POSITIVE}
          />
        )}
        isAnimationActive={false}
      />
      <ChartTooltip
        // Fixed to the left of the sparkline, so it stays within the table row
        position={{ x: -132, y: -8 }}
        allowEscapeViewBox={{ x: true, y: true }}
        wrapperStyle={{ zIndex: 20, pointerEvents: "none" }}
        cursor={{ stroke: "var(--color-muted-foreground)", strokeOpacity: 0.4 }}
        isAnimationActive={false}
        content={({ active, payload }) => {
          const point = payload?.[0]?.payload as SparkPoint | undefined
          if (!active || !point) return null
          return (
            <div className="bg-background w-32 rounded-md border px-2 py-1 text-xs shadow-md">
              <p className="text-muted-foreground">{formatLongDate(point.b_date_calculation)}</p>
              <p className="font-medium tabular-nums">{formatKgN(point.b_n_available)}</p>
            </div>
          )
        }}
      />
    </LineChart>
  )
}

type SortKey = "available" | "uptake" | "leaching"

/** Values of the sortable columns of a calculated field. */
function tableValues(outcome: FieldMineralizationOk, isCurrentYear: boolean) {
  const { kpis } = outcome.insights
  return {
    available: isCurrentYear ? kpis.availableNNow : kpis.residualNAtHarvest,
    uptake: kpis.uptakeToDate,
    leaching: kpis.leachingToDate,
  } satisfies Record<SortKey, number | null>
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; dir: "asc" | "desc" } | null
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = sort?.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Button
        variant="ghost"
        size="sm"
        className="-mr-2 h-8 gap-1 px-2 font-medium pointer-coarse:h-10"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon className={active ? "" : "text-muted-foreground"} aria-hidden />
      </Button>
    </TableHead>
  )
}

/** Available nitrogen; a negative value is flagged, because uptake then exceeds the supply. */
function AvailableNCell({ value }: { value: number | null }) {
  if (value === null || value >= 0) return <>{formatKg(value)}</>
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-4">
        <CircleAlert className="text-muted-foreground size-3.5" aria-hidden />
        {formatKg(value)}
        <span className="sr-only">: opname groter dan aanbod</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        Het gewas nam meer stikstof op dan er volgens de berekening beschikbaar kwam, bijvoorbeeld
        door stikstofbinding van vlinderbloemigen. Controleer de gegevens van dit perceel.
      </TooltipContent>
    </Tooltip>
  )
}

/** Sortable table with the key figures of every calculable field. */
export function FarmFieldTable({
  fields,
  outcomes,
  year,
  isCurrentYear,
  fieldHref,
}: FarmOverviewProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null)
  const onSort = (key: SortKey) =>
    setSort((prev) =>
      prev?.key !== key ? { key, dir: "desc" } : prev.dir === "desc" ? { key, dir: "asc" } : null,
    )

  const rows = fields.filter((f) => {
    const status = outcomes[f.b_id]?.status
    return (
      status === undefined || status === "ok" || status === "missing_harvest" || status === "error"
    )
  })
  if (!sort) {
    // Calculated fields first; fields waiting for a harvest or with an error below them
    const rank = (field: FarmOverviewField) => {
      const status = outcomes[field.b_id]?.status
      return status === "ok" || status === undefined ? 0 : 1
    }
    rows.sort((a, b) => rank(a) - rank(b))
  } else {
    const value = (field: FarmOverviewField) => {
      const outcome = outcomes[field.b_id]
      return outcome?.status === "ok" ? tableValues(outcome, isCurrentYear)[sort.key] : null
    }
    // Fields without a value stay at the bottom in both directions
    rows.sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return sort.dir === "asc" ? va - vb : vb - va
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alle percelen</CardTitle>
        <CardDescription>
          {isCurrentYear
            ? "Beschikbare stikstof vandaag, en opname en uitspoeling tot nu toe, in kg N/ha."
            : `Beschikbare stikstof bij de oogst, en opname en uitspoeling over ${year}, in kg N/ha.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Perceel</TableHead>
              <TableHead className="hidden md:table-cell">Hoofdteelt</TableHead>
              <SortableHead
                label={isCurrentYear ? "Beschikbaar nu" : "Bij oogst"}
                sortKey="available"
                sort={sort}
                onSort={onSort}
                className="text-right"
              />
              <SortableHead
                label="N-opname"
                sortKey="uptake"
                sort={sort}
                onSort={onSort}
                className="hidden text-right sm:table-cell"
              />
              <SortableHead
                label="Uitspoeling"
                sortKey="leaching"
                sort={sort}
                onSort={onSort}
                className="hidden text-right sm:table-cell"
              />
              <TableHead className="hidden whitespace-nowrap xl:table-cell">
                Beschikbare N<span className="sr-only"> door het jaar</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                  Geen percelen om te berekenen.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((field) => {
              const outcome = outcomes[field.b_id]
              const name = (
                <NavLink
                  to={fieldHref(field.b_id)}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {field.b_name ?? "Perceel"}
                </NavLink>
              )
              if (!outcome) {
                return (
                  <TableRow key={field.b_id}>
                    <TableCell>{name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="ml-auto h-4 w-10" />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                  </TableRow>
                )
              }
              if (outcome.status !== "ok") {
                return (
                  <TableRow key={field.b_id}>
                    {/* The reason sits under the name, so the number columns stay aligned */}
                    <TableCell>
                      {name}
                      <span className="text-muted-foreground block text-xs">
                        {outcome.status === "missing_harvest"
                          ? `Wacht op ${getHarvestTerm(
                              outcome.mainCultivation.b_lu_croprotation,
                              true,
                              outcome.mainCultivation.b_lu_harvestable,
                            )}`
                          : "Berekening niet gelukt"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <CropBadge outcome={outcome} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">–</TableCell>
                    <TableCell className="text-muted-foreground hidden text-right sm:table-cell">
                      –
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-right sm:table-cell">
                      –
                    </TableCell>
                    <TableCell className="hidden xl:table-cell" />
                  </TableRow>
                )
              }
              const values = tableValues(outcome, isCurrentYear)
              return (
                <TableRow key={field.b_id}>
                  <TableCell>{name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <CropBadge outcome={outcome} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <AvailableNCell value={values.available} />
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatKg(values.uptake)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatKg(values.leaching)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <AvailableNSparkline outcome={outcome} year={year} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
      <NotCalculatedFields
        fields={fields}
        outcomes={outcomes}
        year={year}
        open={rows.length === 0}
      />
    </Card>
  )
}

/**
 * Footer of the field table with the fields that are not calculated and why, collapsed unless
 * `open` is set.
 */
function NotCalculatedFields({
  fields,
  outcomes,
  year,
  open,
}: Pick<FarmOverviewProps, "fields" | "outcomes" | "year"> & { open: boolean }) {
  const rows = fields.flatMap((field) => {
    const outcome = outcomes[field.b_id]
    if (
      outcome?.status === "excluded" ||
      outcome?.status === "missing_location" ||
      outcome?.status === "no_cultivation"
    ) {
      return [{ field, reason: getNotCalculatedReason(outcome, year) }]
    }
    return []
  })
  if (rows.length === 0) return null

  return (
    // Remounts when `open` changes, so it follows the table once the outcomes are in
    <CardFooter key={String(open)} className="block border-t pt-4">
      <Collapsible defaultOpen={open}>
        <CollapsibleTrigger
          render={
            <Button variant="ghost" size="sm" className="group text-muted-foreground -ml-2">
              <ChevronDown
                className="transition-transform group-data-[state=open]:rotate-180"
                aria-hidden
              />
              Niet berekend ({rows.length})
            </Button>
          }
        />
        <CollapsibleContent>
          <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
            {rows.map(({ field, reason }) => (
              <li key={field.b_id}>
                <span className="text-foreground">{field.b_name ?? "Perceel"}</span> — {reason}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </CardFooter>
  )
}
