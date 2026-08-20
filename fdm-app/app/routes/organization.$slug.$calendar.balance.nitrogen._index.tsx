import type { NitrogenBalanceNumeric } from "@nmi-agro/fdm-calculator"
import { getFarms, getFields } from "@nmi-agro/fdm-core"
import {
  ArrowDown,
  ArrowRight,
  ArrowRightFromLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  CircleAlert,
  CircleCheck,
  CircleX,
} from "lucide-react"
import { Suspense, use } from "react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
  useLocation,
  useParams,
  useRevalidator,
} from "react-router"
import { BufferStripInfo } from "~/components/blocks/balance/buffer-strip-info"
import { NitrogenBalanceChart } from "~/components/blocks/balance/nitrogen-chart"
import { NitrogenBalanceFallback } from "~/components/blocks/balance/skeletons"
import { NoFarmsMessage } from "~/components/blocks/organization/no-farms-message"
import { CalculationRefreshBanner } from "~/components/blocks/calculation-refresh-banner"
import { CalculationRefreshSpinner } from "~/components/blocks/calculation-refresh-spinner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { useCalculationRefresh } from "~/hooks/use-calculation-refresh"
import { auth, getSession } from "~/lib/auth.server"
import { getCalculationJobKey } from "~/lib/calculation-jobs"
import { getNitrogenBalanceForFarmsCached } from "~/lib/calculation-jobs.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { FarmSelectDialog } from "../components/blocks/balance/farm-select-dialog"

type Farm = Awaited<ReturnType<typeof getFarms>>[number]
type Organization = Awaited<ReturnType<typeof auth.api.listOrganizations>>[number]
type FarmResult = {
  farm: Farm
  totalArea: number
  nitrogenBalanceResult: NitrogenBalanceNumeric & {
    errorMessage?: string
  }
}
type FarmExtended = Farm & { b_area_farm: number }
type AsyncData = {
  farmIds: string[]
  farmResults: FarmResult[]
  combinedResult: NitrogenBalanceNumeric
  farms: FarmExtended[]
  calendar: string
  staleJobs: import("~/lib/calculation-jobs").CalculationJobRequest[]
}
type LoaderData =
  | {
      organization: Organization
      noFarms: true
    }
  | {
      organization: Organization
      noFarms: false
      asyncData: Promise<AsyncData>
    }
// Meta
export const meta: MetaFunction = () => {
  return [
    {
      title: `Stikstof | Organisatie | Nutriëntenbalans| ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk stikstof voor je nutriëntenbalans.",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs): Promise<LoaderData> {
  try {
    // Get the organization
    const slug = params.slug
    if (!slug) {
      throw data("missing: slug", {
        status: 404,
        statusText: "missing: slug",
      })
    }

    const url = new URL(request.url)

    let searchParamFarmIds: string[] | undefined
    if (url.searchParams.has("farmIds")) {
      searchParamFarmIds = url.searchParams.get("farmIds")?.split(",").filter(Boolean)
      if (!searchParamFarmIds || searchParamFarmIds.length === 0) {
        throw data("invalid: farmIds", {
          status: 400,
          statusText: "invalid: farmIds",
        })
      }
    }

    // Get timeframe from calendar store
    const timeframe = getTimeframe(params)

    // Ensure the caller is authenticated
    await getSession(request)

    const allOrganizations = await auth.api.listOrganizations({
      headers: request.headers,
    })
    const organization = allOrganizations.find((org) => org.slug === slug)
    if (!organization) {
      throw data(`not found: ${slug}`, {
        status: 404,
        statusText: `not found: ${slug}`,
      })
    }

    const farms = await getFarms(fdm, organization.id)

    // If the organization has no access to any farms, render the empty message
    if (farms.length === 0) {
      return {
        organization: organization,
        noFarms: true,
      }
    }

    const allFarmIds = new Set(farms.map((farm) => farm.b_id_farm))

    if (searchParamFarmIds?.some((b_id_farm) => !allFarmIds.has(b_id_farm))) {
      const statusText = "You do not have permission to compute nitrogen balance for these farms"
      throw data(statusText, {
        status: 403,
        statusText: statusText,
      })
    }

    async function getAsyncData(principal_id: string) {
      const farmIdsSet = new Set(searchParamFarmIds ?? [])

      // Compute farms, keeping each farm's fields around for the cached per-field pass below.
      const farmsWithFields = await Promise.all(
        farms.map(async (farm) => {
          const fields = await getFields(fdm, principal_id, farm.b_id_farm)

          const b_area_farm = fields.reduce(
            (totalArea, field) => totalArea + (field.b_area ?? 0),
            0,
          )

          return {
            ...farm,
            fields,
            hasFields: fields.length > 0,
            b_area_farm: b_area_farm,
          }
        }),
      )

      // Sort farms by descending area, which will in turn also cause the results to be sorted
      farmsWithFields.sort((f1, f2) => f2.b_area_farm - f1.b_area_farm)

      // Update farmIds selection if it was missing
      if (farmIdsSet.size === 0) {
        for (const farm of farmsWithFields) {
          if (farm.hasFields) {
            farmIdsSet.add(farm.b_id_farm)
          }
        }

        // If farmIds is still empty (none of the farms have fields) add all farm IDs
        if (farmIdsSet.size === 0) {
          for (const farm of farmsWithFields) {
            farmIdsSet.add(farm.b_id_farm)
          }
        }
      }

      const farmIds = farmsWithFields
        .filter((farm) => farmIdsSet.has(farm.b_id_farm))
        .map((farm) => farm.b_id_farm)
      const selectedFarmIds = new Set(farmIds)
      const selectedFarms = farmsWithFields.filter((farm) => selectedFarmIds.has(farm.b_id_farm))

      // Build the organization-level (and per-farm) nitrogen balance from each field's cached
      // result instead of blocking on a full recompute. Stale/missing fields are returned in
      // `staleJobs` for the client to hand off to the background `/api/calculation-refresh` route.
      const { combinedResult, farmResultsMap, staleJobs } = await getNitrogenBalanceForFarmsCached(
        {
          fdm,
          principal_id,
          farms: selectedFarms,
          calendar,
          timeframe,
        },
      )

      const farmsExtended: FarmExtended[] = farmsWithFields.map(
        ({ fields: _fields, hasFields: _hasFields, ...farm }) => farm,
      )

      const farmResults: FarmResult[] = selectedFarms.map((farm) => {
        const nitrogenBalanceResult = farmResultsMap.get(farm.b_id_farm)
        if (!nitrogenBalanceResult) {
          throw new Error(`Missing nitrogen balance result for farm ${farm.b_id_farm}`)
        }
        return {
          farm,
          totalArea: farm.b_area_farm,
          nitrogenBalanceResult,
        }
      })

      return {
        farmIds: farmIds,
        farms: farmsExtended,
        farmResults: farmResults,
        combinedResult: combinedResult,
        calendar,
        staleJobs,
      }
    }

    const calendar = getCalendar(params)
    const asyncData = getAsyncData(organization.id)

    return {
      organization: organization,
      noFarms: false,
      asyncData: asyncData,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function FarmBalanceNitrogenOverviewBlock() {
  const loaderData = useLoaderData<typeof loader>()
  const location = useLocation()
  return (
    <main className="space-y-4 p-8">
      <h2 className="text-2xl font-bold tracking-tight">Stikstof</h2>
      <Suspense
        key={`${loaderData.organization.id},${location.search}`}
        fallback={<NitrogenBalanceFallback />}
      >
        <OrganizationFarmBalanceNitrogenOverview {...loaderData} />
      </Suspense>
    </main>
  )
}

/**
 * Renders the page elements with asynchronously loaded data
 *
 * This has to be extracted into a separate component because of the `use(...)` hook.
 * React will not render the component until `asyncData` resolves, but React Router
 * handles it nicely via the `Suspense` component and server-to-client data streaming.
 * If `use(...)` was added to `FarmBalanceNitrogenOverviewBlock` instead, the Suspense
 * would not render until `asyncData` resolves and the fallback would never be shown.
 */
function OrganizationFarmBalanceNitrogenOverview(loaderData: LoaderData) {
  const params = useParams()

  if (loaderData.noFarms) {
    return (
      <div className="lg:mt-20">
        <NoFarmsMessage
          action={{
            label: "Naar dashboard",
            to: `/organization/${loaderData.organization.slug}`,
          }}
        />
      </div>
    )
  }

  const { asyncData: asyncDataPromise } = loaderData

  // Unlike most React hooks `use` may be called conditionally
  const asyncData = use(asyncDataPromise)

  const {
    combinedResult: resolvedNitrogenBalanceResult,
    farmResults,
    staleJobs,
  } = asyncData
  const { jobStates, refreshReady } = useCalculationRefresh(staleJobs)
  const revalidator = useRevalidator()

  const pendingKeys = new Set(
    [...jobStates.entries()].filter(([, state]) => state === "pending").map(([key]) => key),
  )
  const isFarmRecomputing = (b_id_farm: string) =>
    staleJobs.some(
      (job) => job.b_id_farm === b_id_farm && pendingKeys.has(getCalculationJobKey(job)),
    )

  const farmChartBalanceData = resolvedNitrogenBalanceResult
  const hasErrors = farmResults.some(({ nitrogenBalanceResult }) => nitrogenBalanceResult.hasErrors)

  const orgAverage = Number.isFinite(resolvedNitrogenBalanceResult.balance)
    ? (resolvedNitrogenBalanceResult.balance as number)
    : undefined

  const createFarmRow = (farmResult: (typeof farmResults)[number]) => {
    const balanceResult = farmResult.nitrogenBalanceResult
    const recomputing = isFarmRecomputing(farmResult.farm.b_id_farm)
    const farmBalance = Number.isFinite(balanceResult.balance)
      ? (balanceResult.balance as number)
      : undefined
    const delta =
      farmBalance !== undefined && orgAverage !== undefined ? farmBalance - orgAverage : undefined
    const deltaFormatted =
      delta !== undefined
        ? `${delta >= 0 ? "+" : ""}${(Math.round(delta * 10) / 10).toFixed(1)}`
        : undefined
    const deltaClass =
      delta === undefined ? "text-orange-500" : delta < 0 ? "text-green-600" : "text-red-600"
    return (
      <div className="flex grow items-center" key={farmResult.farm.b_id_farm}>
        {recomputing ? (
          <CalculationRefreshSpinner label="Stikstofbalans wordt opnieuw berekend..." />
        ) : balanceResult.hasErrors ? (
          <CircleAlert className="h-6 w-6 rounded-full bg-orange-100 p-0 text-orange-500" />
        ) : Number.isFinite(balanceResult.balance) ? (
          balanceResult.balance <= balanceResult.target ? (
            <CircleCheck className="h-6 w-6 rounded-full bg-green-100 p-0 text-green-500" />
          ) : (
            <CircleX className="h-6 w-6 rounded-full bg-red-100 p-0 text-red-500" />
          )
        ) : (
          <CircleAlert className="h-6 w-6 rounded-full bg-orange-100 p-0 text-orange-500" />
        )}

        <div className="ml-4 space-y-1">
          <NavLink to={`/farm/${farmResult.farm.b_id_farm}/${params.calendar}/balance/nitrogen`}>
            <p className="text-sm leading-none font-medium hover:underline">
              {farmResult.farm.b_name_farm ?? "Onbekende bedrijf"}
            </p>
          </NavLink>
          <p className="text-muted-foreground text-sm">
            {Math.round(farmResult.totalArea * 10) / 10} ha
          </p>
        </div>
        <div className="ml-auto text-right font-medium">
          {!balanceResult.hasErrors ? (
            <>
              <span>{`${balanceResult.balance} / ${balanceResult.target}`}</span>
              {deltaFormatted !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`block cursor-default text-xs ${deltaClass}`}>
                      {deltaFormatted}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {`Verschil t.o.v. het organisatiegemiddelde (${(Math.round((orgAverage ?? 0) * 10) / 10).toFixed(1)} kg N / ha)`}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          ) : (
            <NavLink to={`/farm/${farmResult.farm.b_id_farm}/${params.calendar}/balance/nitrogen`}>
              <p className="text-end text-sm text-orange-500 hover:underline">
                {balanceResult.errorMessage === "No fields in input"
                  ? "Geen percelen"
                  : "Bekijk foutmelding"}
              </p>
            </NavLink>
          )}
        </div>
      </div>
    )
  }
  return (
    <>
      {refreshReady && <CalculationRefreshBanner onRefresh={() => revalidator.revalidate()} />}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overschot / Doel (Alle bedrijven)</CardTitle>
            <ArrowRightLeft className="text-muted-foreground text-xs" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <div className="flex items-center gap-4">
                <p>
                  {`${resolvedNitrogenBalanceResult.balance} / ${resolvedNitrogenBalanceResult.target}`}
                </p>
                {hasErrors ? (
                  <Tooltip>
                    <TooltipTrigger>
                      <CircleAlert className="rounded-full bg-orange-100 text-orange-500" />
                    </TooltipTrigger>
                    <TooltipContent>Niet alle bedrijven konden worden berekend</TooltipContent>
                  </Tooltip>
                ) : resolvedNitrogenBalanceResult.balance <=
                  resolvedNitrogenBalanceResult.target ? (
                  <CircleCheck className="rounded-full bg-green-100 p-0 text-green-500 " />
                ) : (
                  <CircleX className="rounded-full bg-red-100 text-red-500 " />
                )}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">kg N / ha</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aanvoer</CardTitle>
            <ArrowDown className="text-muted-foreground text-xs" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedNitrogenBalanceResult.supply.total}</div>
            <p className="text-muted-foreground text-xs">kg N / ha</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Afvoer</CardTitle>
            <ArrowRight className="text-muted-foreground text-xs" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedNitrogenBalanceResult.removal.total}</div>
            <p className="text-muted-foreground text-xs">kg N / ha</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ammoniakemissie</CardTitle>
            <ArrowUpFromLine className="text-muted-foreground text-xs" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {resolvedNitrogenBalanceResult.emission.ammonia.total}
            </div>
            <p className="text-muted-foreground text-xs">kg N / ha</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nitraatuitspoeling</CardTitle>
            <ArrowRightFromLine className="text-muted-foreground text-xs" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {resolvedNitrogenBalanceResult.emission.nitrate}
            </div>
            <p className="text-muted-foreground text-xs">kg N / ha</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Balans</CardTitle>
            <CardDescription>
              De gemiddelde stikstofbalans voor de geselecteerde bedrijven. De balans is het
              verschil tussen de totale aanvoer, afvoer en emissie van stikstof. Een positieve
              balans betekent een overschot aan stikstof, een negatieve balans een tekort. U kunt de
              selectie van de bedrijven wijzigen om de uitschieters te identificeren.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <NitrogenBalanceChart
              type="farm"
              balanceData={farmChartBalanceData}
              fieldInput={undefined}
            />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <p className="grow">Bedrijven</p>
              <FarmSelectDialog
                farms={asyncData.farms}
                defaultSelectedFarmIds={asyncData.farmIds}
              />
              <BufferStripInfo />
            </CardTitle>
            <CardDescription />
          </CardHeader>
          <CardContent>
            <div className="space-y-8">{farmResults.map(createFarmRow)}</div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
