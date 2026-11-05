import type { PhosphateBalance, PhosphateBalanceFieldResult } from "@nmi-agro/fdm-calculator"
import type { Cultivation, Harvest } from "@nmi-agro/fdm-core"
import {
  PHOSPHATE_VERDICT_ORDER,
  type PhosphateBalanceField,
  type PhosphateStatus,
  type PhosphateVerdict,
} from "@nmi-agro/fdm-calculator/browser"
import { getCultivationsForFarm, getFarm, getFields, getHarvestsForFarm } from "@nmi-agro/fdm-core"
import { ArrowRightLeft, CalendarRange, CircleAlert, TriangleAlert } from "lucide-react"
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
  formatNumberNl,
  formatPhosphateAim,
  formatYearsBand,
  formatYearsClass,
  getPhosphateStatus,
  PHOSPHATE_EXCLUSION_LABEL,
  PHOSPHATE_UNIT,
  PHOSPHATE_VERDICT_TEXT,
} from "~/components/blocks/balance/phosphate-format"
import { PhosphateFarmFallback } from "~/components/blocks/balance/phosphate-skeletons"
import { PhosphateStatusIcon } from "~/components/blocks/balance/phosphate-soil"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
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

/**
 * Summary card on top of the farm page, as in the other balances.
 *
 * @param title - Title of the card.
 * @param icon - Icon in the top right corner.
 * @param value - The value (kg P₂O₅ / ha).
 * @param digits - Number of decimals.
 * @param note - Text under the value (default: the unit).
 * @param alert - Optional icon next to the value.
 */
function SummaryCard({
  title,
  icon,
  value,
  digits = 0,
  note = PHOSPHATE_UNIT,
  alert,
}: {
  title: string
  icon: ReactNode
  value: number
  digits?: number
  note?: string
  alert?: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-2xl font-bold">
          <p>{formatNumberNl(value, digits)}</p>
          {alert}
        </div>
        <p className="text-muted-foreground text-xs">{note}</p>
      </CardContent>
    </Card>
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
  // Computed once, not on every render: only shown in the error branch's debug dump below.
  const [errorTimestamp] = useState(() => new Date())

  const cultivationsMap = new Map(cultivationsEntries)
  const harvestsMap = new Map(harvestsEntries)
  const mainCultivationMap = new Map(mainCultivationEntries)

  if (phosphateBalanceResult.errorMessage) {
    return (
      <div className="flex items-center justify-center">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Helaas is het niet mogelijk om je balans uit te rekenen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">
              <p>
                {phosphateBalanceResult.errorMessage === "No fields in input"
                  ? "Geen percelen gevonden in dit bedrijf."
                  : "Er is helaas wat misgegaan."}{" "}
                Probeer opnieuw of neem contact op met Ondersteuning en deel de volgende
                foutmelding:
              </p>
              <div className="mt-8 w-full max-w-2xl">
                <pre className="overflow-x-auto rounded-md bg-gray-200 p-4 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                  {JSON.stringify(
                    {
                      message: phosphateBalanceResult.errorMessage,
                      timestamp: errorTimestamp,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const fieldsMap = new Map(fields.map((f) => [f.b_id, f]))
  const filteredFields = phosphateBalanceResult.fields.filter(
    (fieldResult: PhosphateBalanceFieldResult) => {
      const fieldData = fieldsMap.get(fieldResult.b_id)
      return fieldData ? !fieldData.b_bufferstrip && !fieldResult.exclusion : false
    },
  )
  // Nature and landscape elements (buffer strips are explained by the info icon)
  const excluded = phosphateBalanceResult.fields.filter(
    (fieldResult) => fieldResult.exclusion && fieldResult.exclusion !== "bufferstrip",
  )

  // Most urgent first, then the largest fields; failed fields at the end
  const rows = filteredFields
    .map((fieldResult) => ({
      fieldResult,
      status: fieldResult.balance ? getPhosphateStatus(fieldResult.balance) : null,
    }))
    .sort((a, b) => {
      const rank = (r: typeof a) =>
        r.status
          ? PHOSPHATE_VERDICT_ORDER.indexOf(r.status.verdict)
          : PHOSPHATE_VERDICT_ORDER.length
      return rank(a) - rank(b) || b.fieldResult.b_area - a.fieldResult.b_area
    })

  const incompleteCount = filteredFields.filter(
    (fieldResult) => (fieldResult.balance?.warnings ?? []).length > 0,
  ).length

  const failedCount = phosphateBalanceResult.fields.filter(
    (fieldResult) => fieldResult.errorMessage !== undefined,
  ).length
  const iconClass = "text-muted-foreground h-4 w-4"

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatusDistributionCard
          statusArea={phosphateBalanceResult.status_area}
          failedCount={failedCount}
          className="md:col-span-2"
        />
        <SummaryCard
          title="Gemiddeld saldo (bedrijf)"
          icon={<CalendarRange className={iconClass} />}
          value={phosphateBalanceResult.long_term_balance}
          note={`${PHOSPHATE_UNIT} per jaar, bepaalt de trend`}
        />
        <SummaryCard
          title={`Saldo ${calendar} (bedrijf)`}
          icon={<ArrowRightLeft className={iconClass} />}
          value={phosphateBalanceResult.balance}
        />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-7">
        {/* Left: the fields, most urgent first: the status per field is what counts */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex flex-row items-center justify-between space-y-0 pb-2">
              <p>Percelen</p>
              <BufferStripInfo />
            </CardTitle>
            <CardDescription>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {(["adjust", "attention", "good"] as const).map((verdict) => (
                  <li key={verdict} className="flex items-center gap-1.5">
                    <PhosphateStatusIcon verdict={verdict} className="h-4 w-4" />
                    <span>
                      <span className="text-foreground font-medium">
                        {PHOSPHATE_VERDICT_TEXT[verdict].label}
                      </span>
                      : {PHOSPHATE_VERDICT_TEXT[verdict].description.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground mb-3 flex justify-end text-xs">
              Gemiddeld saldo ({PHOSPHATE_UNIT} per jaar)
            </div>
            <div className="space-y-6">
              {rows.map(({ fieldResult, status }) => {
                const fieldData = fieldsMap.get(fieldResult.b_id)
                return (
                  <div className="flex items-start" key={fieldResult.b_id}>
                    {status ? (
                      <PhosphateStatusIcon verdict={status.verdict} className="mt-0.5 h-6 w-6" />
                    ) : (
                      <CircleAlert
                        aria-label="Balans kon niet worden berekend"
                        className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-orange-100 p-0 text-orange-500"
                      />
                    )}

                    <div className="ml-4 min-w-0 space-y-1">
                      <div className="flex items-baseline gap-2">
                        <NavLink to={`./${fieldResult.b_id}`}>
                          <p className="text-sm leading-none font-medium hover:underline">
                            {fieldData?.b_name}
                          </p>
                        </NavLink>
                        <p className="text-muted-foreground text-xs">{fieldData?.b_area} ha</p>
                      </div>
                      <FieldCultivationsBadge
                        cultivations={cultivationsMap.get(fieldResult.b_id) ?? []}
                        mainCultivation={mainCultivationMap.get(fieldResult.b_id)}
                        harvestsMap={harvestsMap}
                        fieldName={fieldData?.b_name ?? ""}
                      />
                      {fieldResult.balance && status ? (
                        <FieldStatusLine balance={fieldResult.balance} status={status} />
                      ) : null}
                    </div>
                    <div className="ml-auto pl-4 font-medium">
                      {fieldResult.balance ? (
                        formatNumberNl(fieldResult.balance.long_term.balance)
                      ) : (
                        <NavLink to={`./${fieldResult.b_id}`}>
                          <p className="text-end text-sm text-orange-500 hover:underline">
                            {"Bekijk foutmelding"}
                          </p>
                        </NavLink>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {excluded.length > 0 ? (
              <p className="text-muted-foreground mt-6 text-xs">
                Niet meegenomen ({excluded.length}):{" "}
                {excluded
                  .map((fieldResult) => {
                    const name = fieldsMap.get(fieldResult.b_id)?.b_name ?? "Onbekend perceel"
                    const reason = fieldResult.exclusion
                      ? PHOSPHATE_EXCLUSION_LABEL[fieldResult.exclusion]
                      : ""
                    return `${name} (${reason})`
                  })
                  .join(", ")}
                . Natuur en landschapselementen worden niet voor productie bemest of geoogst.
              </p>
            ) : null}
          </CardContent>
        </Card>
        {/* Right: the balance, as in the other balances */}
        <div className="lg:col-span-3">
          <PhosphateBalanceCard
            year={calendar}
            balance={phosphateBalanceResult.balance}
            leaching={phosphateBalanceResult.leaching}
            supply={phosphateBalanceResult.supply}
            removal={phosphateBalanceResult.removal}
            description={`Gemiddelde per ha over de percelen van ${farm.b_name_farm}. Percelen kunnen verschillende doelen hebben; beoordeel de toestand per perceel.`}
          >
            <PhosphateBalanceChart type="farm" balance={phosphateBalanceResult} />
            {incompleteCount > 0 ? (
              <p className="text-muted-foreground flex items-center gap-1.5 pt-2 pl-4 text-sm">
                <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                Bij {incompleteCount}{" "}
                {incompleteCount === 1 ? "perceel ontbreken" : "percelen ontbreken"} gegevens voor
                de afvoer (oogst of fosfaatgehalte). Open het perceel voor details.
              </p>
            ) : null}
          </PhosphateBalanceCard>
        </div>
      </div>
    </div>
  )
}

/**
 * One line under a field: the aim, where it is (PSD and threshold, or P-AL), the direction and how
 * long it takes, e.g. "Afbouwen · milieu (PSD) · PSD 26 / 20 % · ↓ 10–20 jaar".
 *
 * @param balance - The phosphate balance of the field.
 * @param status - Its status.
 */
function FieldStatusLine({
  balance,
  status,
}: {
  balance: PhosphateBalanceField
  status: PhosphateStatus
}) {
  if (status.verdict === "unknown") {
    return <p className="text-muted-foreground text-xs">Geen P-AL of fosfaatverzadiging bekend</p>
  }
  const psd = balance.projection?.psd
  const pAl = balance.projection?.p_al?.current
  const position =
    psd && psd.threshold.value !== null && balance.saturation.psd_valid
      ? `PSD ${formatNumberNl(psd.current.value)} / ${formatNumberNl(psd.threshold.value)} %`
      : `P-AL ${formatNumberNl(pAl)}`
  const arrow = { up: "↑", down: "↓", stable: "→" }[status.direction]
  const inside = status.aim === "onderhouden" && !status.conflict
  const years = formatYearsBand(status.years)
  const timing = inside
    ? years
      ? `${years} in de zone`
      : "blijft in de zone"
    : (years ?? formatYearsClass(status.years_class))
  return (
    <p className="text-muted-foreground text-xs">
      {formatPhosphateAim(status)} · {position} ·{" "}
      <span aria-label={{ up: "stijgt", down: "daalt", stable: "stabiel" }[status.direction]}>
        {arrow}
      </span>{" "}
      {timing}
      {status.indicative ? " · indicatief" : ""}
    </p>
  )
}

/** Colour of the bar segment per verdict (paired with icon and label in the legend). */
const VERDICT_BAR: Record<PhosphateVerdict, string> = {
  adjust: "bg-red-500",
  attention: "bg-amber-500",
  good: "bg-green-500",
  unknown: "bg-muted-foreground/40",
}

/**
 * Area of the farm per verdict as a bar plus a legend with icon, label, hectares and number of
 * fields: the first answer on the farm page, because the farm saldo averages fields with different
 * aims.
 *
 * @param statusArea - Area and count per verdict.
 * @param failedCount - Number of fields whose balance could not be calculated.
 * @param className - Extra classes.
 */
function StatusDistributionCard({
  statusArea,
  failedCount,
  className,
}: {
  statusArea: PhosphateBalance["status_area"]
  failedCount: number
  className?: string
}) {
  const total = PHOSPHATE_VERDICT_ORDER.reduce((sum, v) => sum + statusArea[v].area, 0)
  const verdicts = PHOSPHATE_VERDICT_ORDER.filter((v) => statusArea[v].count > 0)
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Toestand percelen</CardTitle>
        {failedCount > 0 ? (
          <Tooltip>
            <TooltipTrigger>
              <CircleAlert className="h-4 w-4 rounded-full bg-orange-100 text-orange-500" />
            </TooltipTrigger>
            <TooltipContent>Niet alle percelen konden worden berekend</TooltipContent>
          </Tooltip>
        ) : null}
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
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {verdicts.map((v) => (
            <li key={v} className="flex items-center gap-1.5">
              <PhosphateStatusIcon verdict={v} className="h-4 w-4" />
              <span className="font-medium">{PHOSPHATE_VERDICT_TEXT[v].label}</span>
              <span className="text-muted-foreground">
                {formatNumberNl(statusArea[v].area, 1)} ha ({statusArea[v].count})
              </span>
            </li>
          ))}
          {verdicts.length === 0 ? (
            <li className="text-muted-foreground">Geen percelen beoordeeld</li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  )
}
