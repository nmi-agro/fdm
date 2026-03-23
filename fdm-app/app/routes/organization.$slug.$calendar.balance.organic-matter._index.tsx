import {
    calculateOrganicMatterBalanceForFarms,
    calculateOrganicMatterBalancesFieldToFarm,
    collectInputForOrganicMatterBalanceForFarms,
    type OrganicMatterBalanceFieldResultNumeric,
    type OrganicMatterBalanceNumeric,
} from "@nmi-agro/fdm-calculator"
import { getFarms, getFields, listPrincipalsForFarm } from "@nmi-agro/fdm-core"
import {
    ArrowDownToLine,
    ArrowRightLeft,
    ArrowUpFromLine,
    CircleAlert,
    CircleCheck,
    CircleX,
} from "lucide-react"
import { Suspense, use, useRef } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    NavLink,
    useLoaderData,
    useParams,
    useSearchParams,
} from "react-router"
import { BufferStripInfo } from "~/components/blocks/balance/buffer-strip-info"
import { OrganicMatterBalanceChart } from "~/components/blocks/balance/organic-matter-chart"
import { NitrogenBalanceFallback } from "~/components/blocks/balance/skeletons" // Can be reused
import { NoFarmsMessage } from "~/components/blocks/organization/no-farms-message"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog"
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

type Farm = Awaited<ReturnType<typeof getFarms>>[number]
type Organization = Awaited<
    ReturnType<typeof auth.api.listOrganizations>
>[number]
type FarmResult = {
    farm: Farm
    owner: Awaited<ReturnType<typeof listPrincipalsForFarm>>[number] | undefined
    fields: Awaited<ReturnType<typeof getFields>>
    totalArea: number
    organicMatterBalanceResult: OrganicMatterBalanceNumeric & {
        errorMessage?: string
    }
}
type AsyncData = {
    farmResults: FarmResult[]
    combinedResult: OrganicMatterBalanceNumeric
}
type LoaderData =
    | {
          organization: Organization
          noFarms: true
      }
    | {
          farms: Farm[]
          farmIds: string[]
          organization: Organization
          noFarms: false
          asyncData: Promise<AsyncData>
      }

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Organische Stof | Organisatie | Nutriëntenbalans| ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk de organische stofbalans van je organisatie.",
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

        const farmsMap = Object.fromEntries(
            farms.map((farm) => [farm.b_id_farm, farm]),
        )

        const farmIds =
            searchParamFarmIds ?? farms.map((farm) => farm.b_id_farm)

        async function getAsyncData(principal_id: string) {
            const inputs = await collectInputForOrganicMatterBalanceForFarms(
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

            const combinedResult = await calculateOrganicMatterBalanceForFarms(
                fdm,
                inputs,
            )
            const rawFarmResultsMap: Record<
                string,
                OrganicMatterBalanceFieldResultNumeric[]
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
            const farmResults = await Promise.all(
                Object.entries(rawFarmResultsMap).map(
                    async ([b_id_farm, fieldResults]) => {
                        const farm = farmsMap[b_id_farm]
                        try {
                            const organicMatterBalanceResult =
                                calculateOrganicMatterBalancesFieldToFarm(
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
                            const farmPrincipals = await listPrincipalsForFarm(
                                fdm,
                                principal_id,
                                farm.b_id_farm,
                            )
                            const owner = farmPrincipals.find(
                                (p) => p.role === "owner" && p.type === "user",
                            )

                            const fields = await getFields(
                                fdm,
                                principal_id,
                                farm.b_id_farm,
                            )

                            const totalArea = fields.reduce(
                                (totalArea, field) =>
                                    totalArea + (field.b_area ?? 0),
                                0,
                            )
                            if (organicMatterBalanceResult.hasErrors) {
                                reportError(
                                    organicMatterBalanceResult.fieldErrorMessages.join(
                                        ",\n",
                                    ),
                                    {
                                        page: "organization/{slug}/{calendar}/balance/organic-matter/_index",
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
                                owner: owner,
                                fields: fields,
                                totalArea: totalArea,
                                organicMatterBalanceResult:
                                    organicMatterBalanceResult as OrganicMatterBalanceNumeric & {
                                        errorMessage?: string
                                    },
                            }
                        } catch (error) {
                            return {
                                farm: farm,
                                owner: undefined,
                                fields: [],
                                totalArea: 0,
                                organicMatterBalanceResult: {
                                    hasErrors: true,
                                    errorMessage:
                                        error instanceof Error
                                            ? error.message
                                            : String(error),
                                } as OrganicMatterBalanceNumeric & {
                                    errorMessage?: string
                                },
                            }
                        }
                    },
                ),
            )

            return {
                farmResults: farmResults,
                combinedResult: combinedResult,
            }
        }

        const asyncData = getAsyncData(organization.id)

        return {
            farms: farms,
            farmIds: farmIds.sort(),
            organization: organization,
            noFarms: false,
            asyncData: asyncData,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FarmBalanceOrganicMatterOverviewBlock() {
    const loaderData = useLoaderData<typeof loader>()
    const farmIds = !loaderData.noFarms ? loaderData.farmIds : []
    return (
        <div className="space-y-4">
            <Suspense
                key={`loaderData.organization.id,${farmIds.join(",")}`}
                fallback={<NitrogenBalanceFallback />}
            >
                <OrganizationFarmBalanceOrganicMatterOverview {...loaderData} />
            </Suspense>
        </div>
    )
}

/**
 * Renders the page elements with asynchronously loaded data
 *
 * This has to be extracted into a separate component because of the `use(...)` hook.
 * React will not render the component until `asyncData` resolves, but React Router
 * handles it nicely via the `Suspense` component and server-to-client data streaming.
 * If `use(...)` was added to `FarmBalanceOrganicMatterOverviewBlock` instead, the Suspense
 * would not render until `asyncData` resolves and the fallback would never be shown.
 */
function OrganizationFarmBalanceOrganicMatterOverview(loaderData: LoaderData) {
    const [, setSearchParams] = useSearchParams()
    const params = useParams()
    const formRef = useRef<HTMLFormElement | null>(null)

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

    const { farms, farmIds, asyncData: asyncDataPromise } = loaderData

    // `use` is not a React hook, therefore we can call it conditionally
    const asyncData = use(asyncDataPromise)

    const { combinedResult: resolvedOrganicMatterBalanceResult, farmResults } =
        asyncData
    const farmChartBalanceData =
        resolvedOrganicMatterBalanceResult as unknown as {
            supply: number
            removal: number
        } & OrganicMatterBalanceNumeric
    const hasErrors = farmResults.some(
        ({ organicMatterBalanceResult }) =>
            organicMatterBalanceResult.hasErrors,
    )

    const createFarmRow = (farmResult: (typeof farmResults)[number]) => {
        const balanceResult = farmResult.organicMatterBalanceResult
        return (
            <div
                className="flex items-center grow"
                key={farmResult.farm.b_id_farm}
            >
                {Number.isFinite(balanceResult.balance) ? (
                    balanceResult.balance > 0 ? (
                        <CircleCheck className="text-green-500 bg-green-100 p-0 rounded-full w-6 h-6" />
                    ) : (
                        <CircleX className="text-red-500 bg-red-100 p-0 rounded-full w-6 h-6" />
                    )
                ) : (
                    <CircleAlert className="text-orange-500 bg-orange-100 p-0 rounded-full w-6 h-6" />
                )}

                <div className="ml-4 space-y-1">
                    <NavLink
                        to={`/farm/${farmResult.farm.b_id_farm}/${params.calendar}/balance/organic-matter`}
                    >
                        <p className="text-sm font-medium leading-none hover:underline">
                            {farmResult.farm.b_name_farm ?? "Onbekende bedrijf"}
                        </p>
                    </NavLink>
                    <p className="text-sm text-muted-foreground">
                        {Math.round(farmResult.totalArea * 10) / 10} ha
                    </p>
                </div>
                <div className="ml-auto font-medium">
                    {!balanceResult.hasErrors ? (
                        balanceResult.balance
                    ) : (
                        <NavLink
                            to={`/farm/${farmResult.farm.b_id_farm}/${params.calendar}/balance/organic-matter`}
                        >
                            <p className="text-sm text-end text-orange-500 hover:underline">
                                {"Bekijk foutmelding"}
                            </p>
                        </NavLink>
                    )}
                </div>
            </div>
        )
    }
    return (
        <main className="p-8 space-y-8">
            <h2 className="text-2xl font-bold tracking-tight">
                Organische Stof
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Balans (Bedrijf)
                        </CardTitle>
                        <ArrowRightLeft className="text-xs text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            <div className="flex items-center gap-4">
                                <p>
                                    {resolvedOrganicMatterBalanceResult.balance}
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
                                ) : resolvedOrganicMatterBalanceResult.balance >
                                  0 ? (
                                    <CircleCheck className="text-green-500 bg-green-100 p-0 rounded-full " />
                                ) : (
                                    <CircleX className="text-red-500 bg-red-100 rounded-full " />
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            kg OS / ha
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Aanvoer
                        </CardTitle>
                        <ArrowDownToLine className="text-xs text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {resolvedOrganicMatterBalanceResult.supply}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            kg EOS / ha
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Afbraak
                        </CardTitle>
                        <ArrowUpFromLine className="text-xs text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {resolvedOrganicMatterBalanceResult.degradation}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            kg OS / ha
                        </p>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Balans</CardTitle>
                        <CardDescription>
                            De gemiddelde organische stofbalans voor de
                            geselecteerde bedrijven. De balans is het verschil
                            tussen de effectieve organische stof aanvoer en de
                            afbraak van organische stof.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <OrganicMatterBalanceChart
                            supply={farmChartBalanceData.supply}
                            degradation={farmChartBalanceData.degradation}
                        />
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle className="flex flex-row items-center gap-2 space-y-0 pb-2">
                            <p className="grow">Bedrijven</p>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline">
                                        Wijzig selectie
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Wijzig selectie van bedrijven
                                        </DialogTitle>
                                        <DialogDescription>
                                            De geselecteerde bedrijven zijn
                                            uitgesloten in de berekening.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form ref={formRef} className="space-y-8">
                                        {farms.map((farm) => {
                                            const b_id_farm = farm.b_id_farm
                                            const currentValue =
                                                farmResults.find(
                                                    (result) =>
                                                        result.farm
                                                            .b_id_farm ===
                                                        b_id_farm,
                                                )
                                            return (
                                                <div
                                                    key={farm.b_id_farm}
                                                    className="flex flex-row items-center gap-4"
                                                >
                                                    <Checkbox
                                                        name={b_id_farm}
                                                        defaultChecked={
                                                            !!currentValue
                                                        }
                                                    />
                                                    {farm.b_name_farm ??
                                                        "Onbekend"}
                                                </div>
                                            )
                                        })}
                                    </form>
                                    <DialogFooter>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const form = formRef.current

                                                const selectedFarmIds: string[] =
                                                    []
                                                if (form) {
                                                    const formData =
                                                        new FormData(form)
                                                    for (const [
                                                        b_id_farm,
                                                        selected,
                                                    ] of formData.entries()) {
                                                        if (selected) {
                                                            selectedFarmIds.push(
                                                                b_id_farm,
                                                            )
                                                        }
                                                    }
                                                }
                                                selectedFarmIds.sort()
                                                if (
                                                    farmIds.length !==
                                                        selectedFarmIds.length ||
                                                    selectedFarmIds.find(
                                                        (selected_id, index) =>
                                                            selected_id !==
                                                            farmIds[index],
                                                    )
                                                ) {
                                                    setSearchParams(
                                                        (searchParams) => {
                                                            const newSearchParams =
                                                                new URLSearchParams(
                                                                    searchParams,
                                                                )
                                                            if (
                                                                selectedFarmIds.length >
                                                                0
                                                            ) {
                                                                newSearchParams.set(
                                                                    "farmIds",
                                                                    selectedFarmIds.join(
                                                                        ",",
                                                                    ),
                                                                )
                                                            } else {
                                                                newSearchParams.delete(
                                                                    "farmIds",
                                                                )
                                                            }
                                                            return newSearchParams
                                                        },
                                                    )
                                                }
                                            }}
                                        >
                                            Opslaan
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
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
        </main>
    )
}
