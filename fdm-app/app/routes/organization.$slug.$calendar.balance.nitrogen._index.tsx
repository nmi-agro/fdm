import {
    calculateNitrogenBalanceForPrincipal,
    collectInputForNitrogenBalanceForPrincipal,
    type NitrogenBalanceNumeric,
} from "@nmi-agro/fdm-calculator"
import { getFarms, getFields, listPrincipalsForFarm } from "@nmi-agro/fdm-core"
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
import { Suspense, use, useEffect, useMemo } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    NavLink,
    useLoaderData,
    useParams,
} from "react-router"
import { BufferStripInfo } from "~/components/blocks/balance/buffer-strip-info"
import { NitrogenBalanceChart } from "~/components/blocks/balance/nitrogen-chart"
import { NitrogenBalanceFallback } from "~/components/blocks/balance/skeletons"
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
    DialogClose,
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
import { useOrganizationFarmSelectionStore } from "~/store/organization-farm-selection"
import { Button } from "../components/ui/button"

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Stikstof | Bedrijf | Nutriëntenbalans| ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk stikstof voor je nutriëntenbalans.",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the organization
        const slug = params.slug
        if (!slug) {
            throw data("missing: slug", {
                status: 404,
                statusText: "missing: slug",
            })
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

        const farmsMap = Object.fromEntries(
            farms.map((farm) => [farm.b_id_farm, farm]),
        )

        async function getAsyncData(principal_id: string) {
            const inputs = await collectInputForNitrogenBalanceForPrincipal({
                fdm,
                principal_id,
                timeframe,
            })
            const results = await calculateNitrogenBalanceForPrincipal(
                fdm,
                inputs,
            )
            return Promise.all(
                results.map(async (nitrogenBalanceResult) => {
                    const farm = farmsMap[nitrogenBalanceResult.b_id_farm]
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
                        (totalArea, field) => totalArea + (field.b_area ?? 0),
                        0,
                    )
                    try {
                        if (nitrogenBalanceResult.hasErrors) {
                            reportError(
                                nitrogenBalanceResult.fieldErrorMessages.join(
                                    ",\n",
                                ),
                                {
                                    page: "organization/{slug}/{calendar}/farms/balance/nitrogen/_index",
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
                            nitrogenBalanceResult:
                                nitrogenBalanceResult as NitrogenBalanceNumeric & {
                                    errorMessage?: undefined
                                },
                        }
                    } catch (error) {
                        return {
                            farm: farm,
                            owner: owner,
                            fields: fields,
                            totalArea: totalArea,
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
        }

        const asyncData = getAsyncData(organization.id)

        return {
            organization: organization,
            asyncData: asyncData,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FarmBalanceNitrogenOverviewBlock() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <div className="space-y-4">
            <Suspense
                key={loaderData.organization.id}
                fallback={<NitrogenBalanceFallback />}
            >
                <OrganizationFarmBalanceNitrogenOverview {...loaderData} />
            </Suspense>
        </div>
    )
}

type FarmResult = Awaited<
    Awaited<ReturnType<typeof loader>>["asyncData"]
>[number]
/**
 * Renders the page elements with asynchronously loaded data
 *
 * This has to be extracted into a separate component because of the `use(...)` hook.
 * React will not render the component until `asyncData` resolves, but React Router
 * handles it nicely via the `Suspense` component and server-to-client data streaming.
 * If `use(...)` was added to `FarmBalanceNitrogenOverviewBlock` instead, the Suspense
 * would not render until `asyncData` resolves and the fallback would never be shown.
 */
function OrganizationFarmBalanceNitrogenOverview({
    organization,
    asyncData,
}: Awaited<ReturnType<typeof loader>>) {
    const farmResults = use(asyncData)
    const farm = farmResults[0].farm
    const params = useParams()

    const { syncOrganization, farmIds, setFarmIds } =
        useOrganizationFarmSelectionStore()

    useEffect(() => {
        syncOrganization(
            organization.id,
            farmResults.map((result) => result.farm.b_id_farm),
        )
    }, [organization.id, syncOrganization, farmResults])

    const resultByFarmId = useMemo(
        () =>
            Object.fromEntries(
                farmResults.map((result) => [result.farm.b_id_farm, result]),
            ),
        [farmResults],
    )

    const allResults = farmIds
        .map((b_id_farm) => resultByFarmId[b_id_farm])
        .filter(Boolean)

    const resolvedNitrogenBalanceResult = useMemo(() => {
        const results = allResults.filter(
            (result) => !result.nitrogenBalanceResult.hasErrors,
        )

        const totalArea = results.reduce(
            (totalArea, result) => totalArea + result.totalArea,
            0,
        )

        const fertilizerResultKeys = [
            "total",
            "mineral",
            "manure",
            "compost",
            "other",
        ] as const
        type FertilizerResult = {
            [k in (typeof fertilizerResultKeys)[number]]: number
        }
        function weightedAvg(
            accessor: (result: NitrogenBalanceNumeric) => number,
        ) {
            return Math.round(
                results.reduce(
                    (total, result) =>
                        total +
                        accessor(result.nitrogenBalanceResult) *
                            result.totalArea,
                    0,
                ) / totalArea,
            )
        }

        function weightedFertilizerAvg(
            accessor: (result: NitrogenBalanceNumeric) => FertilizerResult,
        ) {
            return Object.fromEntries(
                fertilizerResultKeys.map((key) => [
                    key,
                    weightedAvg((result) => accessor(result)[key]),
                ]),
            ) as FertilizerResult
        }

        return {
            balance: weightedAvg((result) => result.balance),
            target: weightedAvg((result) => result.target),
            supply: {
                total: weightedAvg((result) => result.supply.total),
                deposition: weightedAvg((result) => result.supply.deposition),
                fixation: weightedAvg((result) => result.supply.fixation),
                mineralisation: weightedAvg(
                    (result) => result.supply.mineralisation,
                ),
                fertilizers: weightedFertilizerAvg(
                    (result) => result.supply.fertilizers,
                ),
            },
            removal: {
                total: weightedAvg((result) => result.removal.total),
                harvests: weightedAvg((result) => result.removal.harvests),
                residues: weightedAvg((result) => result.removal.residues),
            },
            emission: {
                total: weightedAvg((result) => result.emission.total),
                ammonia: {
                    total: weightedAvg(
                        (result) => result.emission.ammonia.total,
                    ),
                    fertilizers: weightedFertilizerAvg(
                        (result) => result.emission.ammonia.fertilizers,
                    ),
                    residues: weightedAvg(
                        (result) => result.emission.ammonia.residues,
                    ),
                },
                nitrate: weightedAvg((result) => result.emission.nitrate),
            },
            fields: allResults.flatMap(
                (result) => result.nitrogenBalanceResult.fields,
            ),
            hasErrors: allResults.some(
                (result) => result.nitrogenBalanceResult.hasErrors,
            ),
            fieldErrorMessages: allResults.flatMap(
                (result) => result.nitrogenBalanceResult.fieldErrorMessages,
            ),
            errorMessage: allResults.find(
                (result) => result.nitrogenBalanceResult.errorMessage,
            )?.nitrogenBalanceResult.errorMessage as string | undefined,
        }
    }, [allResults])

    if (resolvedNitrogenBalanceResult.errorMessage) {
        return (
            <div className="flex items-center justify-center">
                <Card className="w-[350px]">
                    <CardHeader>
                        <CardTitle>
                            Helaas is het niet mogelijk om je balans uit te
                            rekenen
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-muted-foreground">
                            <p>
                                Er is helaas wat misgegaan. Probeer opnieuw of
                                neem contact op met Ondersteuning en deel de
                                volgende foutmelding:
                            </p>
                            <div className="mt-8 w-full max-w-2xl">
                                <pre className="bg-gray-200 dark:bg-gray-800 p-4 rounded-md overflow-x-auto text-sm text-gray-800 dark:text-gray-200">
                                    {JSON.stringify(
                                        {
                                            message:
                                                resolvedNitrogenBalanceResult.errorMessage,
                                            timestamp: new Date(),
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

    const { hasErrors } = resolvedNitrogenBalanceResult

    const createFarmRow = (farmResult: FarmResult) => {
        const balanceResult = farmResult.nitrogenBalanceResult
        return (
            <div
                className="flex items-center grow"
                key={farmResult.farm.b_id_farm}
            >
                {balanceResult.balance ? (
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
                <div className="ml-auto font-medium">
                    {!balanceResult.hasErrors ? (
                        `${balanceResult.balance} / ${balanceResult.target}`
                    ) : (
                        <NavLink
                            to={`/farm/${farmResult.farm.b_id_farm}/${params.calendar}/balance/nitrogen`}
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
            <h2 className="text-2xl font-bold tracking-tight">Stikstof</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Overschot / Doel (Alle Bedrijven)
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
                            De stikstofbalans voor alle percelen van{" "}
                            {farm.b_name_farm}. De balans is het verschil tussen
                            de totale aanvoer, afvoer en emissie van stikstof.
                            Een positieve balans betekent een overschot aan
                            stikstof, een negatieve balans een tekort.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <NitrogenBalanceChart
                            type="farm"
                            balanceData={resolvedNitrogenBalanceResult}
                        />
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle className="flex flex-row items-center gap-2 space-y-0 pb-2">
                            <p className="grow">Bedrijven</p>
                            <Dialog>
                                <DialogTrigger>
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
                                    <div className="space-y-8">
                                        {farmResults.map((result) => {
                                            const b_id_farm =
                                                result.farm.b_id_farm
                                            return (
                                                <div
                                                    key={result.farm.b_id_farm}
                                                    className="flex flex-row items-center gap-4"
                                                >
                                                    <Checkbox
                                                        checked={farmIds.includes(
                                                            result.farm
                                                                .b_id_farm,
                                                        )}
                                                        onCheckedChange={(
                                                            value,
                                                        ) => {
                                                            if (
                                                                value &&
                                                                !farmIds.includes(
                                                                    result.farm
                                                                        .b_id_farm,
                                                                )
                                                            ) {
                                                                setFarmIds([
                                                                    ...farmIds,
                                                                    result.farm
                                                                        .b_id_farm,
                                                                ])
                                                            } else if (
                                                                farmIds.includes(
                                                                    result.farm
                                                                        .b_id_farm,
                                                                )
                                                            ) {
                                                                setFarmIds(
                                                                    farmIds.filter(
                                                                        (
                                                                            current_b_id_farm,
                                                                        ) =>
                                                                            current_b_id_farm !==
                                                                            b_id_farm,
                                                                    ),
                                                                )
                                                            }
                                                        }}
                                                    />
                                                    {createFarmRow(result)}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline">
                                                Sluiten
                                            </Button>
                                        </DialogClose>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <BufferStripInfo />
                        </CardTitle>
                        <CardDescription />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {allResults.map(createFarmRow)}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
