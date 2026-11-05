import { getFarm, getField } from "@nmi-agro/fdm-core"
import { ChevronDown, TriangleAlert } from "lucide-react"
import { Suspense, use, useState } from "react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
  useLocation,
} from "react-router"
import { BufferStripWarning } from "~/components/blocks/balance/buffer-strip-warning"
import { PhosphateBalanceCard } from "~/components/blocks/balance/phosphate-balance-card"
import { PhosphateBalanceChart } from "~/components/blocks/balance/phosphate-chart"
import { PhosphateBalanceDetails } from "~/components/blocks/balance/phosphate-details"
import {
  formatLongTermYears,
  PHOSPHATE_EXCLUSION_LABEL,
} from "~/components/blocks/balance/phosphate-format"
import { PhosphateFieldFallback } from "~/components/blocks/balance/phosphate-skeletons"
import {
  PhosphateSaturationCard,
  PhosphateStockCard,
} from "~/components/blocks/balance/phosphate-soil"
import { PhosphateStatusCard } from "~/components/blocks/balance/phosphate-status-card"
import { FieldNotAvailableForYear } from "~/components/blocks/field/not-available-for-year"
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
import { getFieldNormValues, getPhosphateBalanceForField } from "~/integrations/calculator"
import { isNormsCalendar } from "~/integrations/farm-norms.server"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getFieldAvailability } from "~/lib/field-availability"
import { useCalendarStore } from "~/store/calendar"

// Meta
export const meta: MetaFunction = () => {
  return [
    {
      title: `Fosfaat | Perceel | Nutriëntenbalans| ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk de fosfaatbalans van dit perceel.",
    },
  ]
}

/**
 * Loads the farm and field, and (deferred) the phosphate balance of the field for the selected
 * calendar year with its phosphate application standard (to warn when the advice needs more
 * phosphate than the standard allows). The calculation is skipped when the field is not in use in
 * that year.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("invalid: b_id_farm", { status: 400 })
    }
    const b_id = params.b_id
    if (!b_id) {
      throw data("invalid: b_id", { status: 400 })
    }
    const session = await getSession(request)
    const timeframe = getTimeframe(params)
    const farm = await getFarm(fdm, session.principal_id, b_id_farm)
    if (!farm) {
      throw data("not found: b_id_farm", { status: 404 })
    }
    const field = await getField(fdm, session.principal_id, b_id)

    // Skip the calculation when the field is not managed in the selected calendar year
    const fieldAvailability = getFieldAvailability(field, timeframe)
    if (fieldAvailability) {
      return {
        phosphateBalanceResult: null,
        field: field,
        farm: farm,
        fieldAvailability,
        calendar: params.calendar ?? "",
      }
    }

    // The standard is only used for a warning: without it (other years, missing soil data) the page
    // still works
    const calendar = params.calendar ?? ""
    const phosphateNorm: Promise<number | null> = isNormsCalendar(calendar)
      ? getFieldNormValues({ fdm, principal_id: session.principal_id, b_id, calendar })
          .then((norms) => norms.phosphate.normValue)
          .catch(() => null)
      : Promise.resolve(null)

    const phosphateBalanceResult = getPhosphateBalanceForField({
      fdm,
      principal_id: session.principal_id,
      b_id_farm,
      b_id,
      timeframe,
    }).then(async ({ fieldResult, fieldInput }) => {
      let errorId: string | undefined
      if (fieldResult.errorMessage) {
        errorId = reportError(
          fieldResult.errorMessage,
          {
            page: "farm/{b_id_farm}/{calendar}/balance/phosphate/{b_id}",
            scope: "loader",
          },
          {
            b_id,
            b_id_farm,
            timeframe,
            fieldArea: field?.b_area,
            userId: session.principal_id,
          },
        )
      }
      return {
        fieldResult: { ...fieldResult, errorId },
        fieldInput,
        phosphateNorm: await phosphateNorm,
      }
    })

    return {
      phosphateBalanceResult,
      field: field,
      farm: farm,
      fieldAvailability: null,
      calendar: params.calendar ?? "",
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function FarmBalancePhosphateFieldBlock() {
  const loaderData = useLoaderData<typeof loader>()

  if (loaderData.fieldAvailability || !loaderData.phosphateBalanceResult) {
    return (
      <FieldNotAvailableForYear
        availability={loaderData.fieldAvailability ?? "ended"}
        calendar={loaderData.calendar}
        b_name={loaderData.field.b_name}
        b_start={loaderData.field.b_start}
        b_end={loaderData.field.b_end}
        settingsHref={`/farm/${loaderData.farm.b_id_farm}/${loaderData.calendar}/field/${loaderData.field.b_id}/settings`}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Suspense
        key={`${loaderData.farm.b_id_farm}#${loaderData.field.b_id}`}
        fallback={<PhosphateFieldFallback />}
      >
        <PhosphateBalance
          {...loaderData}
          phosphateBalanceResult={loaderData.phosphateBalanceResult}
        />
      </Suspense>
    </div>
  )
}

function PhosphateBalance({
  farm,
  field,
  phosphateBalanceResult,
}: Awaited<ReturnType<typeof loader>> & {
  phosphateBalanceResult: NonNullable<Awaited<ReturnType<typeof loader>>["phosphateBalanceResult"]>
}) {
  const { fieldResult, fieldInput, phosphateNorm } = use(phosphateBalanceResult)
  const location = useLocation()
  const page = location.pathname
  const calendar = useCalendarStore((state) => state.calendar)
  // Computed once, not on every render: only shown in the error branch's debug dump below.
  const [errorTimestamp] = useState(() => new Date())

  if (field.b_bufferstrip || fieldResult.exclusion === "bufferstrip") {
    return <BufferStripWarning b_id={field.b_id} />
  }

  if (fieldResult.exclusion) {
    return (
      <div className="flex items-center justify-center">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>
              {PHOSPHATE_EXCLUSION_LABEL[fieldResult.exclusion].replace(/^./, (c) =>
                c.toUpperCase(),
              )}
              : geen fosfaatbalans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Het hoofdgewas van dit perceel in {calendar} is een{" "}
              {PHOSPHATE_EXCLUSION_LABEL[fieldResult.exclusion]}. Zo&apos;n perceel wordt niet voor
              productie bemest of geoogst, dus het telt niet mee in de fosfaatbalans en het
              bedrijfsgemiddelde.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fieldResult.errorMessage) {
    return (
      <div className="flex items-center justify-center">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Helaas is het niet mogelijk om je balans uit te rekenen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">
              <p>
                Er is helaas wat misgegaan. Probeer opnieuw of neem contact op met Ondersteuning en
                deel de volgende foutmelding:
              </p>
              <div className="mt-8 w-full max-w-2xl">
                <pre className="overflow-x-auto rounded-md bg-gray-200 p-4 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                  {JSON.stringify(
                    {
                      errorId: fieldResult.errorId,
                      page: page,
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

  if (!fieldResult.balance) {
    return (
      <div className="flex items-center justify-center">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Ongeldig jaar of onbekende fout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">
              <p>
                Dit perceel was niet in gebruik voor dit jaar of er is een onbekende fout
                opgetreden. Als dit perceel wel in gebruik was, werk dan de startdatum bij in de
                perceelsinstelling.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <NavLink to={`/farm/${farm.b_id_farm}/${calendar}/field/${field.b_id}/settings`}>
              <Button>Naar perceelsinstelling</Button>
            </NavLink>
          </CardFooter>
        </Card>
      </div>
    )
  }
  const result = fieldResult.balance

  const warnings = [
    ...(result.warnings ?? []),
    ...result.supply.mineralization.warnings,
    ...result.long_term.warnings,
  ]

  return (
    <div className="space-y-4">
      <PhosphateStatusCard balance={result} phosphateNorm={phosphateNorm} />
      {warnings.length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-center gap-2 text-sm">
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            Ontbrekende of geschatte gegevens ({warnings.length})
            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 pt-2 pl-6">
            {warnings.map((warning) => (
              <p key={warning} className="text-muted-foreground text-sm">
                {warning}
              </p>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {/* The two soil indicators side by side (same height, so they can be compared), then the
          balance and its terms. On small screens everything stacks in this order. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PhosphateSaturationCard balance={result} className="h-full" />
        <PhosphateStockCard
          balance={result}
          soilAnalyses={fieldInput.soilAnalyses}
          calendarYear={Number(calendar)}
          className="h-full"
        />
        <PhosphateBalanceCard
          year={calendar}
          balance={result.balance}
          leaching={result.leaching.total}
          longTerm={{
            balance: result.long_term.balance,
            years: formatLongTermYears(result.long_term.years),
          }}
        >
          <PhosphateBalanceChart type="field" balance={result} fieldInput={fieldInput} />
        </PhosphateBalanceCard>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Posten</CardTitle>
            <CardDescription />
          </CardHeader>
          <CardContent>
            <PhosphateBalanceDetails balanceData={result} fieldInput={fieldInput} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
