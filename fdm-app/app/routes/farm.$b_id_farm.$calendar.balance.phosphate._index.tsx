import type { Cultivation, Harvest } from "@nmi-agro/fdm-core"
import { PHOSPHATE_VERDICT_ORDER, type PhosphateVerdict } from "@nmi-agro/fdm-calculator/browser"
import { getCultivationsForFarm, getFarm, getFields, getHarvestsForFarm } from "@nmi-agro/fdm-core"
import { cn } from "cn"
import { ArrowUpDown, Info, TriangleAlert } from "lucide-react"
import { Suspense, use, useEffect, useState } from "react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
  useParams,
} from "react-router"
import { FieldCultivationsBadge } from "~/components/blocks/balance/field-cultivations-badge"
import { PhosphateBalanceCard } from "~/components/blocks/balance/phosphate-balance-card"
import { PhosphateBalanceChart } from "~/components/blocks/balance/phosphate-chart"
import {
  PhosphateExcludedFieldsCard,
  PhosphateStatusDistributionCard,
} from "~/components/blocks/balance/phosphate-farm-cards"
import {
  PhosphateFieldListItem,
  type PhosphateFieldRow,
  type PhosphateFieldSortKey,
  PhosphateFieldTableRow,
  sortPhosphateFieldRows,
} from "~/components/blocks/balance/phosphate-field-list"
import {
  getPhosphateStatus,
  PHOSPHATE_UNIT,
  PHOSPHATE_VERDICT_TEXT,
} from "~/components/blocks/balance/phosphate-format"
import { PhosphateFarmFallback } from "~/components/blocks/balance/phosphate-skeletons"
import { PhosphateCardHeading } from "~/components/blocks/balance/phosphate-soil"
import { PhosphateCalculationError } from "~/components/blocks/balance/phosphate-states"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { useAnalytics } from "~/hooks/use-analytics"
import { getPhosphateBalanceForFarm } from "~/integrations/calculator"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"

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
  const [sort, setSort] = useState<{ key: PhosphateFieldSortKey; dir: "asc" | "desc" }>({
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
  const rows: PhosphateFieldRow[] = phosphateBalanceResult.fields
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
  // A verdict without fields (e.g. after switching to another year) has no chip: show all fields
  const activeFilter = filter !== "all" && !counts.get(filter) ? "all" : filter
  const visible = sortPhosphateFieldRows(
    rows.filter((row) => activeFilter === "all" || row.status?.verdict === activeFilter),
    sort.key,
    sort.dir,
  )
  const judged = rows.filter((row) => row.status && row.status.verdict !== "unknown")
  const allIndicative = judged.length > 0 && judged.every((row) => row.status?.indicative)
  const incompleteCount = rows.filter(
    (row) => (row.fieldResult.balance?.warnings ?? []).length > 0,
  ).length
  const failedCount = rows.filter((row) => row.fieldResult.errorMessage !== undefined).length

  const sortHeader = (
    key: PhosphateFieldSortKey,
    label: string,
    align: "left" | "right" = "left",
  ) => {
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
      <PhosphateStatusDistributionCard
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
                    variant={activeFilter === v ? "secondary" : "ghost"}
                    aria-pressed={activeFilter === v}
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
                  const [key, dir] = event.target.value.split(":") as [
                    PhosphateFieldSortKey,
                    "asc" | "desc",
                  ]
                  setSort({ key, dir })
                }}
                className="border-input bg-background text-foreground focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-md border px-2 text-sm outline-none focus-visible:ring-[3px] @md/fields:w-auto pointer-coarse:h-11"
              >
                <option value="verdict:asc">Oordeel (meest urgent eerst)</option>
                <option value="area:desc">Oppervlakte (grootste eerst)</option>
                <option value="saldo:desc">Gemiddelde balans (hoogste eerst)</option>
                <option value="saldo:asc">Gemiddelde balans (laagste eerst)</option>
                <option value="name:asc">Naam (A–Z)</option>
              </select>
            </label>
            <ul className="divide-y">
              {visible.map(({ fieldResult, status, name, area }) => (
                <PhosphateFieldListItem
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
                  {sortHeader("saldo", "Gem. balans", "right")}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(({ fieldResult, status, name, area }) => (
                  <PhosphateFieldTableRow
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
            Gemiddelde balans in {PHOSPHATE_UNIT} per jaar over de afgelopen jaren met gegevens
            (zonder gegevens van eerdere jaren: de balans van {calendar}); die bepaalt richting en
            tijd.
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
            longTerm={
              // Only when at least one field averages over earlier years with data
              phosphateBalanceResult.fields.some(
                (f) => (f.balance?.long_term.years.length ?? 0) > 1,
              )
                ? { balance: phosphateBalanceResult.long_term_balance, years: "" }
                : undefined
            }
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
            <PhosphateExcludedFieldsCard
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
