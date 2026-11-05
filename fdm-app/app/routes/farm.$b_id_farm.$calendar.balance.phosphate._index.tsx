import type {
  FieldExclusionReason,
  PhosphateBalance,
  PhosphateBalanceFieldResult,
} from "@nmi-agro/fdm-calculator"
import type { Cultivation, Harvest } from "@nmi-agro/fdm-core"
import {
  PHOSPHATE_VERDICT_ORDER,
  type PhosphateBalanceField,
  type PhosphateStatus,
  type PhosphateVerdict,
} from "@nmi-agro/fdm-calculator/browser"
import { getCultivationsForFarm, getFarm, getFields, getHarvestsForFarm } from "@nmi-agro/fdm-core"
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  ChevronDown,
  Info,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react"
import { type ReactNode, Suspense, use, useEffect, useState } from "react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
  useParams,
} from "react-router"
import { BufferStripInfo } from "~/components/blocks/balance/buffer-strip-info"
import { FieldCultivationsBadge } from "~/components/blocks/balance/field-cultivations-badge"
import { PhosphateBalanceCard } from "~/components/blocks/balance/phosphate-balance-card"
import { PhosphateBalanceChart } from "~/components/blocks/balance/phosphate-chart"
import {
  describePhosphateDirection,
  formatAreaHa,
  formatNumberNl,
  formatPhosphateAim,
  formatYearsBand,
  formatYearsClass,
  getPhosphateStatus,
  PHOSPHATE_EXCLUSION_GROUP,
  PHOSPHATE_HORIZON_YEARS,
  PHOSPHATE_UNIT,
  PHOSPHATE_VERDICT_TEXT,
} from "~/components/blocks/balance/phosphate-format"
import { PhosphateFarmFallback } from "~/components/blocks/balance/phosphate-skeletons"
import {
  PhosphateCardHeading,
  PhosphateStatusIcon,
} from "~/components/blocks/balance/phosphate-soil"
import { PhosphateCalculationError } from "~/components/blocks/balance/phosphate-states"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { useAnalytics } from "~/hooks/use-analytics"
import { getPhosphateBalanceForFarm } from "~/integrations/calculator"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { cn } from "~/lib/utils"

// Meta
export const meta: MetaFunction = () => {
  return [
    {
      title: `Fosfaat | Bedrijf | Nutriëntenbalans| ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk de fosfaatbalans van je bedrijf.",
    },
  ]
}

/**
 * Loads the farm, its fields, cultivations and harvests, and (deferred) the phosphate balance of
 * the farm for the selected calendar year.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("invalid: b_id_farm", {
        status: 400,
        statusText: "invalid: b_id_farm",
      })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)
    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
    if (!farm) {
      throw data("not found: b_id_farm", {
        status: 404,
        statusText: "not found: b_id_farm",
      })
    }

    const fields = await getFields(fdm, session.principal_id, b_id_farm)

    const [cultivationsMap, harvestsMap] = await Promise.all([
      getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getHarvestsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
    ])

    const asyncData = (async () => {
      const phosphateBalanceResult = await getPhosphateBalanceForFarm({
        fdm,
        principal_id: session.principal_id,
        b_id_farm,
        timeframe,
      })

      if (phosphateBalanceResult.hasErrors) {
        reportError(
          phosphateBalanceResult.fieldErrorMessages.join(",\n"),
          {
            page: "farm/{b_id_farm}/{calendar}/balance/phosphate/_index",
            scope: "loader",
          },
          {
            b_id_farm,
            timeframe,
            userId: session.principal_id,
          },
        )
      }

      return { phosphateBalanceResult }
    })()

    const calendar = getCalendar(params)
    const mainCultivationEntries = fields.map(
      (field) =>
        [field.b_id, getMainCultivation(cultivationsMap.get(field.b_id) ?? [], calendar)] as const,
    )

    return {
      farm: farm,
      fields: fields,
      calendar: calendar,
      cultivationsEntries: [...cultivationsMap.entries()] as [string, Cultivation[]][],
      harvestsEntries: [...harvestsMap.entries()] as [string, Harvest[]][],
      mainCultivationEntries: mainCultivationEntries as [string, Cultivation | undefined][],
      asyncData: asyncData,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function FarmBalancePhosphateOverviewBlock() {
  const loaderData = useLoaderData<typeof loader>()
  const params = useParams()
  const { capture } = useAnalytics()

  useEffect(() => {
    capture("balance_viewed", {
      b_id_farm: params.b_id_farm,
      calendar: params.calendar,
      balance_type: "phosphate",
    })
  }, [capture, params.b_id_farm, params.calendar])

  return (
    <div className="space-y-4">
      <Suspense key={loaderData.farm.b_id_farm} fallback={<PhosphateFarmFallback />}>
        <FarmBalancePhosphateOverview {...loaderData} />
      </Suspense>
    </div>
  )
}

/** Columns of the field table that can be sorted. */
type SortKey = "verdict" | "name" | "area" | "saldo"

/** One field in the table: its result, status and name. */
type FieldRow = {
  fieldResult: PhosphateBalanceFieldResult
  status: PhosphateStatus | null
  name: string
  area: number
}

/** Sorts the rows of the field table; within equal values, the most urgent and largest first. */
function sortRows(rows: FieldRow[], key: SortKey, dir: "asc" | "desc"): FieldRow[] {
  const rank = (row: FieldRow) =>
    row.status
      ? PHOSPHATE_VERDICT_ORDER.indexOf(row.status.verdict)
      : PHOSPHATE_VERDICT_ORDER.length
  const sign = dir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    let diff = 0
    if (key === "verdict") diff = rank(a) - rank(b)
    if (key === "name") diff = a.name.localeCompare(b.name, "nl")
    if (key === "area") diff = a.area - b.area
    if (key === "saldo") {
      diff =
        (a.fieldResult.balance?.long_term.balance ?? Number.NEGATIVE_INFINITY) -
        (b.fieldResult.balance?.long_term.balance ?? Number.NEGATIVE_INFINITY)
    }
    return sign * diff || rank(a) - rank(b) || b.area - a.area
  })
}

function FarmBalancePhosphateOverview({
  farm,
  calendar,
  fields,
  cultivationsEntries,
  harvestsEntries,
  mainCultivationEntries,
  asyncData,
}: Awaited<ReturnType<typeof loader>>) {
  const { phosphateBalanceResult } = use(asyncData)
  const [filter, setFilter] = useState<PhosphateVerdict | "all">("all")
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "verdict",
    dir: "asc",
  })

  const cultivationsMap = new Map(cultivationsEntries)
  const harvestsMap = new Map(harvestsEntries)
  const mainCultivationMap = new Map(mainCultivationEntries)

  if (phosphateBalanceResult.errorMessage) {
    return phosphateBalanceResult.errorMessage === "No fields in input" ? (
      <div className="flex justify-center py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <PhosphateCardHeading>Nog geen percelen</PhosphateCardHeading>
          </CardHeader>
          <CardContent className="text-sm">
            Dit bedrijf heeft in {calendar} nog geen percelen, dus er is geen fosfaatbalans.
          </CardContent>
        </Card>
      </div>
    ) : (
      <PhosphateCalculationError message="De fosfaatbalans van dit bedrijf kon niet worden berekend." />
    )
  }

  const fieldsMap = new Map(fields.map((f) => [f.b_id, f]))
  const excluded = phosphateBalanceResult.fields.filter(
    (fieldResult) =>
      fieldResult.exclusion !== undefined || fieldsMap.get(fieldResult.b_id)?.b_bufferstrip,
  )
  const rows: FieldRow[] = phosphateBalanceResult.fields
    .filter((fieldResult) => !excluded.includes(fieldResult) && fieldsMap.has(fieldResult.b_id))
    .map((fieldResult) => ({
      fieldResult,
      status: fieldResult.balance ? getPhosphateStatus(fieldResult.balance) : null,
      name: fieldsMap.get(fieldResult.b_id)?.b_name ?? "Onbekend perceel",
      area: fieldResult.b_area,
    }))
  const counts = new Map<PhosphateVerdict, number>()
  for (const row of rows) {
    if (row.status) counts.set(row.status.verdict, (counts.get(row.status.verdict) ?? 0) + 1)
  }
  const visible = sortRows(
    rows.filter((row) => filter === "all" || row.status?.verdict === filter),
    sort.key,
    sort.dir,
  )
  const judged = rows.filter((row) => row.status && row.status.verdict !== "unknown")
  const allIndicative = judged.length > 0 && judged.every((row) => row.status?.indicative)
  const incompleteCount = rows.filter(
    (row) => (row.fieldResult.balance?.warnings ?? []).length > 0,
  ).length
  const failedCount = rows.filter((row) => row.fieldResult.errorMessage !== undefined).length

  const sortHeader = (key: SortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort.key === key
    return (
      <TableHead
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={cn(align === "right" && "text-right")}
      >
        <button
          type="button"
          onClick={() =>
            setSort((current) => ({
              key,
              dir: current.key === key && current.dir === "asc" ? "desc" : "asc",
            }))
          }
          className={cn(
            "hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-sm whitespace-nowrap outline-none focus-visible:ring-[3px]",
            active && "text-foreground",
          )}
        >
          {label}
          <ArrowUpDown className="size-3.5" aria-hidden="true" />
        </button>
      </TableHead>
    )
  }

  return (
    <div className="space-y-4">
      <StatusDistributionCard
        statusArea={phosphateBalanceResult.status_area}
        failedCount={failedCount}
      />

      <Card className="@container/fields">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PhosphateCardHeading>Percelen</PhosphateCardHeading>
            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">Toon percelen met oordeel</legend>
              {(["all", ...PHOSPHATE_VERDICT_ORDER] as const)
                .filter((v) => v === "all" || (counts.get(v) ?? 0) > 0)
                .map((v) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    className="pointer-coarse:h-10"
                    variant={filter === v ? "secondary" : "ghost"}
                    aria-pressed={filter === v}
                    onClick={() => setFilter(v)}
                  >
                    {v === "all" ? "Alle" : PHOSPHATE_VERDICT_TEXT[v].label}
                    <span className="text-muted-foreground tabular-nums">
                      {v === "all" ? rows.length : counts.get(v)}
                    </span>
                  </Button>
                ))}
            </fieldset>
          </div>
          {allIndicative ? (
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Alle oordelen zijn indicatief: de bodemgegevens zijn (deels) geschat of de
              fosfaatverzadiging is voor deze grond minder betrouwbaar. Open een perceel voor de
              toelichting.
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          {/* Narrow cards (phones, tablets, a laptop with the sidebar open): a compact list with a
              sort menu; wide cards: the sortable table */}
          <div className="space-y-3 @4xl/fields:hidden">
            <label className="text-muted-foreground flex flex-col gap-1.5 text-sm @md/fields:flex-row @md/fields:items-center @md/fields:gap-2">
              Sorteer op
              <select
                value={`${sort.key}:${sort.dir}`}
                onChange={(event) => {
                  const [key, dir] = event.target.value.split(":") as [SortKey, "asc" | "desc"]
                  setSort({ key, dir })
                }}
                className="border-input bg-background text-foreground focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-md border px-2 text-sm outline-none focus-visible:ring-[3px] @md/fields:w-auto pointer-coarse:h-11"
              >
                <option value="verdict:asc">Oordeel (meest urgent eerst)</option>
                <option value="area:desc">Oppervlakte (grootste eerst)</option>
                <option value="saldo:desc">Gemiddeld saldo (hoogste eerst)</option>
                <option value="saldo:asc">Gemiddeld saldo (laagste eerst)</option>
                <option value="name:asc">Naam (A–Z)</option>
              </select>
            </label>
            <ul className="divide-y">
              {visible.map(({ fieldResult, status, name, area }) => (
                <FieldListItem
                  key={fieldResult.b_id}
                  fieldResult={fieldResult}
                  status={status}
                  name={name}
                  area={area}
                  showIndicative={!allIndicative}
                />
              ))}
            </ul>
          </div>
          <div className="hidden @4xl/fields:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {sortHeader("verdict", "Oordeel")}
                  {sortHeader("name", "Perceel")}
                  {sortHeader("area", "Oppervlakte", "right")}
                  <TableHead>Doel</TableHead>
                  <TableHead>Waar</TableHead>
                  <TableHead>Richting</TableHead>
                  <TableHead>Hoe lang</TableHead>
                  {sortHeader("saldo", "Gem. saldo", "right")}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(({ fieldResult, status, name, area }) => (
                  <FieldTableRow
                    key={fieldResult.b_id}
                    fieldResult={fieldResult}
                    status={status}
                    name={name}
                    area={area}
                    showIndicative={!allIndicative}
                    cultivations={
                      <FieldCultivationsBadge
                        cultivations={cultivationsMap.get(fieldResult.b_id) ?? []}
                        mainCultivation={mainCultivationMap.get(fieldResult.b_id)}
                        harvestsMap={harvestsMap}
                        fieldName={name}
                      />
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Gemiddeld saldo in {PHOSPHATE_UNIT} per jaar over de afgelopen jaren; dat bepaalt
            richting en tijd.
          </p>
        </CardContent>
      </Card>

      <div className="@container/bottom">
        <div className="grid items-start gap-4 @3xl/bottom:grid-cols-2">
          <PhosphateBalanceCard
            year={calendar}
            balance={phosphateBalanceResult.balance}
            leaching={phosphateBalanceResult.leaching}
            supply={phosphateBalanceResult.supply}
            removal={phosphateBalanceResult.removal}
            longTerm={{ balance: phosphateBalanceResult.long_term_balance, years: "" }}
            description={`Gemiddelde per ha over de percelen van ${farm.b_name_farm}. Percelen kunnen verschillende doelen hebben; beoordeel de toestand per perceel.`}
          >
            <PhosphateBalanceChart type="farm" balance={phosphateBalanceResult} />
            {incompleteCount > 0 ? (
              <p className="text-muted-foreground flex items-center gap-1.5 pt-2 pl-4 text-sm">
                <TriangleAlert className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                Bij {incompleteCount}{" "}
                {incompleteCount === 1 ? "perceel ontbreken" : "percelen ontbreken"} gegevens voor
                de afvoer (oogst of fosfaatgehalte). Open het perceel voor details.
              </p>
            ) : null}
          </PhosphateBalanceCard>
          {excluded.length > 0 ? (
            <ExcludedFieldsCard
              excluded={excluded.map((fieldResult) => ({
                name: fieldsMap.get(fieldResult.b_id)?.b_name ?? "Onbekend perceel",
                reason: fieldResult.exclusion ?? "bufferstrip",
              }))}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * One field in the compact list (narrow screens): the whole row is a link with a large tap target;
 * verdict, name and saldo on the first line, aim and the deciding value on the second, direction
 * and time on the third.
 */
function FieldListItem({
  fieldResult,
  status,
  name,
  area,
  showIndicative,
}: {
  fieldResult: PhosphateBalanceFieldResult
  status: PhosphateStatus | null
  name: string
  area: number
  showIndicative: boolean
}) {
  const balance = fieldResult.balance
  const inside = status?.aim === "onderhouden" && !status.conflict
  const years = status ? formatYearsBand(status.years) : null
  const direction = status ? describePhosphateDirection(status) : null
  return (
    <li>
      <NavLink
        to={`./${fieldResult.b_id}`}
        className="hover:bg-muted/50 focus-visible:ring-ring/50 -mx-2 block space-y-1 rounded-md px-2 py-3 outline-none focus-visible:ring-[3px]"
      >
        <div className="flex items-start gap-2">
          {status ? (
            <PhosphateStatusIcon verdict={status.verdict} className="mt-0.5 size-5" />
          ) : (
            <OctagonAlert className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">{name}</p>
            <p className="text-muted-foreground text-xs">
              {status ? PHOSPHATE_VERDICT_TEXT[status.verdict].label : "Fout"}
              {showIndicative && status?.indicative && status.verdict !== "unknown"
                ? " · indicatief"
                : ""}{" "}
              · {formatAreaHa(area)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-medium tabular-nums">
              {balance ? formatNumberNl(balance.long_term.balance) : "–"}
            </p>
            <p className="text-muted-foreground text-xs">gem. saldo</p>
          </div>
        </div>
        {balance && status && status.verdict !== "unknown" ? (
          <div className="text-muted-foreground space-y-0.5 pl-7 text-sm">
            <p>
              <span className="text-foreground">{formatPhosphateAim(status)}</span> ·{" "}
              <span className="whitespace-nowrap">{formatDecidingValue(balance, status)}</span>
            </p>
            <p>
              {direction?.verb}
              {direction?.meaning ? ` · ${direction.meaning}` : ""} ·{" "}
              {inside
                ? (years ?? `> ${PHOSPHATE_HORIZON_YEARS} jaar`)
                : (years ?? formatYearsClass(status.years_class))}
            </p>
          </div>
        ) : !balance ? (
          <p className="text-muted-foreground pl-7 text-sm">
            De balans kon niet worden berekend. Open het perceel om opnieuw te proberen.
          </p>
        ) : null}
      </NavLink>
    </li>
  )
}

/** Arrow icon per direction (shown next to the direction text, never on its own). */
const DIRECTION_ICON = { up: ArrowUpRight, down: ArrowDownRight, stable: ArrowRight } as const

/**
 * One field in the table: verdict, name with area and crop, aim, the value of the indicator that
 * decides, the direction against the aim, how long, and the long-term average saldo.
 */
function FieldTableRow({
  fieldResult,
  status,
  name,
  area,
  showIndicative,
  cultivations,
}: {
  fieldResult: PhosphateBalanceFieldResult
  status: PhosphateStatus | null
  name: string
  area: number
  showIndicative: boolean
  cultivations: ReactNode
}) {
  const balance = fieldResult.balance
  const link = (
    <NavLink
      to={`./${fieldResult.b_id}`}
      className="font-medium underline-offset-4 hover:underline"
    >
      {name}
    </NavLink>
  )
  if (!balance || !status) {
    return (
      <TableRow>
        <TableCell>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <OctagonAlert className="size-4 shrink-0 text-red-700" aria-hidden="true" />
            Fout
          </span>
        </TableCell>
        <TableCell>{link}</TableCell>
        <TableCell className="text-right whitespace-nowrap tabular-nums">
          {formatAreaHa(area)}
        </TableCell>
        <TableCell colSpan={5} className="text-muted-foreground text-sm">
          De balans kon niet worden berekend.{" "}
          <NavLink
            to={`./${fieldResult.b_id}`}
            className="text-foreground underline underline-offset-4"
          >
            Opnieuw proberen
          </NavLink>
        </TableCell>
      </TableRow>
    )
  }
  const direction = describePhosphateDirection(status)
  const DirectionIcon = DIRECTION_ICON[status.direction]
  const inside = status.aim === "onderhouden" && !status.conflict
  const years = formatYearsBand(status.years)
  return (
    <TableRow>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <PhosphateStatusIcon verdict={status.verdict} className="size-5" />
          {PHOSPHATE_VERDICT_TEXT[status.verdict].label}
        </span>
        {showIndicative && status.indicative && status.verdict !== "unknown" ? (
          <span className="text-muted-foreground block pl-6.5 text-xs">indicatief</span>
        ) : null}
      </TableCell>
      <TableCell className="space-y-1">
        <div>{link}</div>
        {cultivations}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap tabular-nums">
        {formatAreaHa(area)}
      </TableCell>
      <TableCell className="text-sm">{formatPhosphateAim(status)}</TableCell>
      <TableCell className="text-sm whitespace-nowrap tabular-nums">
        {formatDecidingValue(balance, status)}
      </TableCell>
      <TableCell className="text-sm">
        {status.verdict === "unknown" ? (
          "–"
        ) : (
          <span className="inline-flex items-start gap-1">
            <DirectionIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {direction.verb}
              {direction.meaning ? (
                <span className="text-muted-foreground block text-xs">{direction.meaning}</span>
              ) : null}
            </span>
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {status.verdict === "unknown"
          ? "–"
          : inside
            ? (years ?? `> ${PHOSPHATE_HORIZON_YEARS} jaar`)
            : (years ?? formatYearsClass(status.years_class))}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatNumberNl(balance.long_term.balance)}
      </TableCell>
    </TableRow>
  )
}

/**
 * The value of the indicator that decides the status, e.g. "PSD 29 / 19 %" or "P-AL 18". Inside the
 * zone without a deciding bound: the PSD with its threshold when usable, otherwise P-AL.
 */
function formatDecidingValue(balance: PhosphateBalanceField, status: PhosphateStatus): string {
  const psd = balance.projection?.psd
  const pAl = balance.projection?.p_al?.current
  const psdText =
    psd && psd.threshold.value !== null && balance.saturation.psd_valid
      ? `PSD ${formatNumberNl(psd.current.value)} / ${formatNumberNl(psd.threshold.value)} %`
      : null
  const pAlText = pAl !== undefined ? `P-AL ${formatNumberNl(pAl)}` : null
  if (status.binding === "p_al") return pAlText ?? "–"
  if (status.binding === "psd") return psdText ?? "–"
  return psdText ?? pAlText ?? "–"
}

/** Colour of the bar segment per verdict (paired with icon and label in the legend). */
const VERDICT_BAR: Record<PhosphateVerdict, string> = {
  adjust: "bg-red-600",
  attention: "bg-amber-500",
  good: "bg-green-600",
  unknown: "bg-muted-foreground/40",
}

/**
 * Area of the farm per verdict as a bar plus a legend with icon, label, hectares and number of
 * fields: the first answer on the farm page, because the farm saldo averages fields with different
 * aims.
 *
 * @param statusArea - Area and count per verdict.
 * @param failedCount - Number of fields whose balance could not be calculated.
 */
function StatusDistributionCard({
  statusArea,
  failedCount,
}: {
  statusArea: PhosphateBalance["status_area"]
  failedCount: number
}) {
  const total = PHOSPHATE_VERDICT_ORDER.reduce((sum, v) => sum + statusArea[v].area, 0)
  const verdicts = PHOSPHATE_VERDICT_ORDER.filter((v) => statusArea[v].count > 0)
  return (
    <Card>
      <CardHeader className="space-y-1.5 pb-3">
        <PhosphateCardHeading>Fosfaattoestand van de percelen</PhosphateCardHeading>
        <CardDescription>
          Oppervlakte per oordeel. Elk perceel wordt beoordeeld tegen zijn eigen streefzone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {total > 0 ? (
          <div className="flex h-3 w-full overflow-hidden rounded-full" aria-hidden="true">
            {verdicts.map((v) => (
              <div
                key={v}
                className={VERDICT_BAR[v]}
                style={{ width: `${(statusArea[v].area / total) * 100}%` }}
              />
            ))}
          </div>
        ) : null}
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {verdicts.map((v) => (
            <li key={v} className="flex items-center gap-1.5">
              <PhosphateStatusIcon verdict={v} className="size-4" />
              <span className="font-medium">{PHOSPHATE_VERDICT_TEXT[v].label}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatAreaHa(statusArea[v].area)} · {statusArea[v].count}{" "}
                {statusArea[v].count === 1 ? "perceel" : "percelen"}
              </span>
            </li>
          ))}
          {verdicts.length === 0 ? (
            <li className="text-muted-foreground">Geen percelen beoordeeld</li>
          ) : null}
        </ul>
        {failedCount > 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-red-800">
            <OctagonAlert className="size-4 shrink-0" aria-hidden="true" />
            {failedCount === 1
              ? "1 perceel kon niet worden berekend."
              : `${failedCount} percelen konden niet worden berekend.`}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * Fields left out of the phosphate balance, grouped by reason and collapsed per group, so a farm
 * with many landscape elements does not bury the fields that count.
 *
 * @param excluded - Name and reason of each excluded field.
 */
function ExcludedFieldsCard({
  excluded,
}: {
  excluded: { name: string; reason: FieldExclusionReason }[]
}) {
  const groups = (["nature", "landscape_element", "bufferstrip"] as const)
    .map((reason) => ({
      reason,
      names: excluded
        .filter((e) => e.reason === reason)
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b, "nl")),
    }))
    .filter((group) => group.names.length > 0)
  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <PhosphateCardHeading>Niet meegenomen ({excluded.length})</PhosphateCardHeading>
          <BufferStripInfo />
        </div>
        <CardDescription>
          Natuur, landschapselementen en bufferstroken worden niet voor productie bemest of geoogst.
          Ze tellen niet mee in de balans en het bedrijfsgemiddelde.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {groups.map((group) => (
          <Collapsible key={group.reason}>
            <CollapsibleTrigger className="hover:bg-muted focus-visible:ring-ring/50 group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm outline-none focus-visible:ring-[3px] pointer-coarse:py-3">
              <span>
                {PHOSPHATE_EXCLUSION_GROUP[group.reason]}{" "}
                <span className="text-muted-foreground tabular-nums">({group.names.length})</span>
              </span>
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="text-muted-foreground px-2 pb-2 text-sm">
              {group.names.join(", ")}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  )
}
