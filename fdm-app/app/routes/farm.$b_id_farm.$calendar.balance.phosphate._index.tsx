import type { PhosphateBalanceFieldResult } from "@nmi-agro/fdm-calculator"
import type { Cultivation, Harvest } from "@nmi-agro/fdm-core"
import { getCultivationsForFarm, getFarm, getFields, getHarvestsForFarm } from "@nmi-agro/fdm-core"
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  CircleAlert,
  TriangleAlert,
} from "lucide-react"
import { Suspense, use, useEffect, useState } from "react"
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
import { PhosphateBalanceChart } from "~/components/blocks/balance/phosphate-chart"
import {
  formatNumberNl,
  getPhosphateTrendStatus,
  PHOSPHATE_UNIT,
} from "~/components/blocks/balance/phosphate-format"
import { PhosphateStatusIcon } from "~/components/blocks/balance/phosphate-soil"
import { NitrogenBalanceFallback } from "~/components/blocks/balance/skeletons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
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
      <Suspense key={loaderData.farm.b_id_farm} fallback={<NitrogenBalanceFallback />}>
        <FarmBalancePhosphateOverview {...loaderData} />
      </Suspense>
    </div>
  )
}

function FarmBalancePhosphateOverview({
  farm,
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
      return fieldData ? !fieldData.b_bufferstrip : false
    },
  )

  const incompleteCount = filteredFields.filter(
    (fieldResult) => (fieldResult.balance?.warnings ?? []).length > 0,
  ).length

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo (Bedrijf)</CardTitle>
            <ArrowRightLeft className="text-muted-foreground text-xs" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumberNl(phosphateBalanceResult.balance)}
            </div>
            <p className="text-muted-foreground text-xs">{PHOSPHATE_UNIT}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aanvoer</CardTitle>
            <ArrowDownToLine className="text-muted-foreground text-xs" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumberNl(phosphateBalanceResult.supply)}
            </div>
            <p className="text-muted-foreground text-xs">{PHOSPHATE_UNIT}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Afvoer</CardTitle>
            <ArrowUpFromLine className="text-muted-foreground text-xs" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumberNl(phosphateBalanceResult.removal)}
            </div>
            <p className="text-muted-foreground text-xs">{PHOSPHATE_UNIT}</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Balans</CardTitle>
            <CardDescription>
              De fosfaatbalans voor alle percelen van {farm.b_name_farm}: aanvoer met bemesting min
              afvoer met oogst en gewasresten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pl-2">
            <PhosphateBalanceChart
              supply={phosphateBalanceResult.supply}
              removal={phosphateBalanceResult.removal}
            />
            {incompleteCount > 0 ? (
              <p className="text-muted-foreground flex items-center gap-1.5 pl-4 text-sm">
                <TriangleAlert className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                Bij {incompleteCount}{" "}
                {incompleteCount === 1 ? "perceel ontbreken" : "percelen ontbreken"} gegevens voor
                de afvoer (oogst of fosfaatgehalte). Open het perceel voor details.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex flex-row items-center justify-between space-y-0 pb-2">
              <p>Percelen</p>
              <BufferStripInfo />
            </CardTitle>
            <CardDescription />
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {filteredFields.map((fieldResult: PhosphateBalanceFieldResult) => {
                const fieldData = fieldsMap.get(fieldResult.b_id)
                return (
                  <div className="flex items-center" key={fieldResult.b_id}>
                    {fieldResult.balance ? (
                      <PhosphateStatusIcon
                        status={getPhosphateTrendStatus(fieldResult.balance)}
                        className="h-8 w-8"
                      />
                    ) : (
                      <CircleAlert className="h-8 w-8 rounded-full bg-orange-100 p-0 text-orange-500" />
                    )}

                    <div className="ml-4 space-y-1">
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
                    </div>
                    <div className="ml-auto font-medium">
                      {fieldResult.balance ? (
                        formatNumberNl(fieldResult.balance.balance)
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
          </CardContent>
        </Card>
      </div>
    </>
  )
}
