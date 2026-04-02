import {
    calculateNitrogenBalanceForFarms,
    calculateNitrogenBalancesFieldToFarm,
    collectInputForNitrogenBalanceForFarms,
    type NitrogenBalanceFieldResultNumeric,
    type NitrogenBalanceNumeric,
} from "@nmi-agro/fdm-calculator"
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
} from "react-router"
import { BufferStripInfo } from "~/components/blocks/balance/buffer-strip-info"
import { NitrogenBalanceChart } from "~/components/blocks/balance/nitrogen-chart"
import { NitrogenBalanceFallback } from "~/components/blocks/balance/skeletons"
import { NoFarmsMessage } from "~/components/blocks/organization/no-farms-message"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { auth, getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { FarmSelectDialog } from "../components/blocks/balance/farm-select-dialog"

type Farm = Awaited<ReturnType<typeof getFarms>>[number]
type Organization = Awaited<
    ReturnType<typeof auth.api.listOrganizations>
>[number]
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

export async function loader({
    request,
    params,
}: LoaderFunctionArgs): Promise<LoaderData> {
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
            searchParamFarmIds = url.searchParams
                .get("farmIds")
                ?.split(",")
                .filter(Boolean)
            if (!searchParamFarmIds || searchParamFarmIds.length === 0) {
                throw data("invalid: farmIds", {
                    status: 400,
                    statusText: "invalid: farmIds",
                })
            }
        }

        // Get timeframe from calendar store
        const timeframe = getTimeframe(params)

        // Get the user's session too (for error reporting)
        const session = await getSession(request)

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

        if (
            searchParamFarmIds?.some((b_id_farm) => !allFarmIds.has(b_id_farm))
        ) {
            const statusText =
                "You do not have permission to compute nitrogen balance for these farms"
            throw data(statusText, {
                status: 403,
                statusText: statusText,
            })
        }

        async function getAsyncData(principal_id: string) {
            const farmIdsSet = new Set(searchParamFarmIds ?? [])

            // Compute farms
            const farmsExtended = await Promise.all(
                farms.map(async (farm) => {
                    const fields = await getFields(
                        fdm,
                        principal_id,
                        farm.b_id_farm,
                    )

                    const b_area_farm = fields.reduce(
                        (totalArea, field) => totalArea + (field.b_area ?? 0),
                        0,
                    )

                    return {
                        ...farm,
                        hasFields: fields.length > 0,
                        b_area_farm: b_area_farm,
                    }
                }),
            )

            // Sort farms by descending area, which will in turn also cause the results to be sorted
            farmsExtended.sort((f1, f2) => f2.b_area_farm - f1.b_area_farm)

            // Update farmIds selection if it was missing
            if (farmIdsSet.size === 0) {
                for (const farm of farmsExtended) {
                    if (farm.hasFields) {
                        farmIdsSet.add(farm.b_id_farm)
                    }
                }
            }

            const farmIds = farmsExtended
                .filter((farm) => farmIdsSet.has(farm.b_id_farm))
                .map((farm) => farm.b_id_farm)

            const inputs = await collectInputForNitrogenBalanceForFarms(
                fdm,
                principal_id,
                farmIds,
                timeframe,
            )
            const fieldToFarmMap: Record<string, string> = {}
            for (const farmInput of inputs) {
                for (const fieldInput of farmInput.fields) {
                    fieldToFarmMap[fieldInput.field.b_id] = farmInput.b_id_farm
                }
            }

            const combinedResult = await calculateNitrogenBalanceForFarms(
                fdm,
                inputs,
            )
            const rawFarmResultsMap: Record<
                string,
                NitrogenBalanceFieldResultNumeric[]
            > = {}
            for (const result of combinedResult.fields) {
                const b_id_farm = fieldToFarmMap[result.b_id]
                if (!b_id_farm) {
                    console.warn(
                        `Field ${result.b_id} not found in fieldToFarmMap, skipping`,
                    )
                    continue
                }
                rawFarmResultsMap[b_id_farm] ??= []
                rawFarmResultsMap[b_id_farm].push(result)
            }

            const selectedFarmIds = new Set(farmIds)
            const farmResults = await Promise.all(
                farmsExtended
                    .filter((farm) => selectedFarmIds.has(farm.b_id_farm))
                    .map(async (farm) => {
                        const fieldResults = rawFarmResultsMap[farm.b_id_farm]
                        if (!fieldResults || fieldResults.length === 0) {
                            return {
                                farm: farm,
                                totalArea: farm.b_area_farm,
                                nitrogenBalanceResult: {
                                    hasErrors: true,
                                    errorMessage: "No fields in input",
                                } as NitrogenBalanceNumeric & {
                                    errorMessage?: string
                                },
                            }
                        }
                        try {
                            const nitrogenBalanceResult =
                                calculateNitrogenBalancesFieldToFarm(
                                    fieldResults,
                                    fieldResults.some(
                                        (result) => result.errorMessage,
                                    ),
                                    fieldResults
                                        .filter((result) => result.errorMessage)
                                        .map(
                                            (result) => result.errorMessage,
                                        ) as string[],
                                )
                            if (nitrogenBalanceResult.hasErrors) {
                                reportError(
                                    nitrogenBalanceResult.fieldErrorMessages.join(
                                        ",\n",
                                    ),
                                    {
                                        page: "organization/{slug}/{calendar}/balance/nitrogen/_index",
                                        scope: "loader",
                                    },
                                    {
                                        b_id_farm: farm.b_id_farm,
                                        timeframe,
                                        userId: session.principal_id,
                                    },
                                )
                            }

                            return {
                                farm: farm,
                                totalArea: farm.b_area_farm,
                                nitrogenBalanceResult:
                                    nitrogenBalanceResult as NitrogenBalanceNumeric & {
                                        errorMessage?: string
                                    },
                            }
                        } catch (error) {
                            return {
                                farm: farm,
                                totalArea: farm.b_area_farm,
                                nitrogenBalanceResult: {
                                    hasErrors: true,
                                    errorMessage:
                                        error instanceof Error
                                            ? error.message
                                            : String(error),
                                } as NitrogenBalanceNumeric & {
                                    errorMessage?: string
                                },
                            }
                        }
                    }),
            )

            return {
                farmIds: farmIds,
                farms: farmsExtended,
                farmResults: farmResults,
                combinedResult: combinedResult,
            }
        }

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
        <main className="p-8 space-y-4">
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

    const { combinedResult: resolvedNitrogenBalanceResult, farmResults } =
        asyncData
    const farmChartBalanceData = resolvedNitrogenBalanceResult
    const hasErrors = farmResults.some(
        ({ nitrogenBalanceResult }) => nitrogenBalanceResult.hasErrors,
    )

    const orgAverage = Number.isFinite(resolvedNitrogenBalanceResult.balance)
        ? (resolvedNitrogenBalanceResult.balance as number)
        : undefined

    const createFarmRow = (farmResult: (typeof farmResults)[number]) => {
        const balanceResult = farmResult.nitrogenBalanceResult
        const farmBalance = Number.isFinite(balanceResult.balance)
            ? (balanceResult.balance as number)
            : undefined
        const delta =
            farmBalance !== undefined && orgAverage !== undefined
                ? farmBalance - orgAverage
                : undefined
        const deltaFormatted =
            delta !== undefined
                ? `${delta >= 0 ? "+" : ""}${(Math.round(delta * 10) / 10).toFixed(1)}`
                : undefined
        const deltaClass =
            delta === undefined
                ? "text-orange-500"
                : delta < 0
                  ? "text-green-600"
                  : "text-red-600"
        return (
            <div
                className="flex items-center grow"
                key={farmResult.farm.b_id_farm}
            >
                {balanceResult.hasErrors ? (
                    <CircleAlert className="text-orange-500 bg-orange-100 p-0 rounded-full w-6 h-6" />
                ) : Number.isFinite(balanceResult.balance) ? (
                    balanceResult.balance <= balanceResult.target ? (
                        <CircleCheck className="text-green-500 bg-green-100 p-0 rounded-full w-6 h-6" />
                    ) : (
                        <CircleX className="text-red-500 bg-red-100 p-0 rounded-full w-6 h-6" />
                    )
                ) : (
                    <CircleAlert className="text-orange-500 bg-orange-100 p-0 rounded-full w-6 h-6" />
                )}

                <div className="ml-4 space-y-1">
                    <NavLink
                        to={`/farm/${farmResult.farm.b_id_farm}/${params.calendar}/balance/nitrogen`}
                    >
                        <p className="text-sm font-medium leading-none hover:underline">
                            {farmResult.farm.b_name_farm ?? "Onbekende bedrijf"}
                        </p>
                    </NavLink>
                    <p className="text-sm text-muted-foreground">
                        {Math.round(farmResult.totalArea * 10) / 10} ha
                    </p>
                </div>
                <div className="ml-auto font-medium text-right">
                    {!balanceResult.hasErrors ? (
                        <>
                            <span>{`${balanceResult.balance} / ${balanceResult.target}`}</span>
                            {deltaFormatted !== undefined && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span
                                            className={`block text-xs cursor-default ${deltaClass}`}
                                        >
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
                        <NavLink
                            to={`/farm/${farmResult.farm.b_id_farm}/${params.calendar}/balance/nitrogen`}
                        >
                            <p className="text-sm text-end text-orange-500 hover:underline">
                                {balanceResult.errorMessage ===
                                "No fields in input"
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Overschot / Doel (Alle bedrijven)
                        </CardTitle>
                        <ArrowRightLeft className="text-xs text-muted-foreground" />
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
                                            <CircleAlert className="text-orange-500 bg-orange-100 rounded-full" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Niet alle bedrijven konden worden
                                            berekend
                                        </TooltipContent>
                                    </Tooltip>
                                ) : resolvedNitrogenBalanceResult.balance <=
                                  resolvedNitrogenBalanceResult.target ? (
                                    <CircleCheck className="text-green-500 bg-green-100 p-0 rounded-full " />
                                ) : (
                                    <CircleX className="text-red-500 bg-red-100 rounded-full " />
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            kg N / ha
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Aanvoer
                        </CardTitle>
                        <ArrowDown className="text-xs text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {resolvedNitrogenBalanceResult.supply.total}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            kg N / ha
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Afvoer
                        </CardTitle>
                        <ArrowRight className="text-xs text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {resolvedNitrogenBalanceResult.removal.total}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            kg N / ha
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Ammoniakemissie
                        </CardTitle>
                        <ArrowUpFromLine className="text-xs text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {
                                resolvedNitrogenBalanceResult.emission.ammonia
                                    .total
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">
                            kg N / ha
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Nitraatuitspoeling
                        </CardTitle>
                        <ArrowRightFromLine className="text-xs text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {resolvedNitrogenBalanceResult.emission.nitrate}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            kg N / ha
                        </p>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Balans</CardTitle>
                        <CardDescription>
                            De gemiddelde stikstofbalans voor de geselecteerde
                            bedrijven. De balans is het verschil tussen de
                            totale aanvoer, afvoer en emissie van stikstof. Een
                            positieve balans betekent een overschot aan
                            stikstof, een negatieve balans een tekort. U kunt de
                            selectie van de bedrijven wijzigen om de
                            uitschieters te identificeren.
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
                        <div className="space-y-8">
                            {farmResults.map(createFarmRow)}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
