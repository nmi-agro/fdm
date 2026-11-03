import { getFarm, getField } from "@nmi-agro/fdm-core"
import { TriangleAlert } from "lucide-react"
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
  PhosphateSaturationCard,
  PhosphateStockCard,
} from "~/components/blocks/balance/phosphate-soil"
import { NitrogenBalanceFallback } from "~/components/blocks/balance/skeletons"
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
import { getPhosphateBalanceForField } from "~/integrations/calculator"
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
 * calendar year. The calculation is skipped when the field is not in use in that year.
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

    const phosphateBalanceResult = getPhosphateBalanceForField({
      fdm,
      principal_id: session.principal_id,
      b_id_farm,
      b_id,
      timeframe,
    }).then(({ fieldResult, fieldInput }) => {
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
      return { fieldResult: { ...fieldResult, errorId }, fieldInput }
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
        fallback={<NitrogenBalanceFallback />}
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
  const { fieldResult, fieldInput } = use(phosphateBalanceResult)
  const location = useLocation()
  const page = location.pathname
  const calendar = useCalendarStore((state) => state.calendar)
  // Computed once, not on every render: only shown in the error branch's debug dump below.
  const [errorTimestamp] = useState(() => new Date())

  if (field.b_bufferstrip) {
    return <BufferStripWarning b_id={field.b_id} />
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

  const warnings = [...(result.warnings ?? []), ...result.supply.mineralization.warnings]

  return (
    <>
      {warnings.map((warning) => (
        <p key={warning} className="text-muted-foreground flex items-start gap-2 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden />
          {warning}
        </p>
      ))}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Left: the soil, with the PSD as the main indicator and P-AL as extra information */}
        <div className="space-y-4">
          <PhosphateSaturationCard balance={result} />
          <PhosphateStockCard
            balance={result}
            soilAnalyses={fieldInput.soilAnalyses}
            calendarYear={Number(calendar)}
          />
        </div>
        {/* Right: the balance */}
        <div className="space-y-4">
          <PhosphateBalanceCard
            description={`De fosfaatbalans voor ${field.b_name} van ${farm.b_name_farm}: aanvoer met bemesting, mineralisatie en depositie min afvoer met oogst en gewasresten.`}
            year={calendar}
            balance={result.balance}
            supply={result.supply.total}
            removal={result.removal.total}
            leaching={result.leaching.total}
            longTerm={result.long_term}
          >
            <PhosphateBalanceChart type="field" balance={result} fieldInput={fieldInput} />
          </PhosphateBalanceCard>
          <Card>
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
    </>
  )
}
