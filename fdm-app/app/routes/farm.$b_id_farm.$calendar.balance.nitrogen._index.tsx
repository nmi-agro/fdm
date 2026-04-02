import type { NitrogenBalanceFieldResultNumeric } from "@nmi-agro/fdm-calculator"
import { getFarm, getFields } from "@nmi-agro/fdm-core"
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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { getNitrogenBalanceForFarm } from "~/integrations/calculator"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

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
        // Get the farm id
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("invalid: b_id_farm", {
                status: 400,
                statusText: "invalid: b_id_farm",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get timeframe from calendar store
        const timeframe = getTimeframe(params)

        // Get details of farm
        const farm = await getFarm(fdm, session.principal_id, b_id_farm)
        if (!farm) {
            throw data("not found: b_id_farm", {
                status: 404,
                statusText: "not found: b_id_farm",
            })
        }

        // Get details of fields
        const fields = await getFields(fdm, session.principal_id, b_id_farm)

        const asyncData = (async () => {
            const nitrogenBalanceResult = await getNitrogenBalanceForFarm({
                fdm,
                principal_id: session.principal_id,
                b_id_farm,
                timeframe,
            })

            if (nitrogenBalanceResult.hasErrors) {
                reportError(
                    nitrogenBalanceResult.fieldErrorMessages.join(",\n"),
                    {
                        page: "farm/{b_id_farm}/{calendar}/balance/nitrogen/_index",
                        scope: "loader",
                    },
                    {
                        b_id_farm,
                        timeframe,
                        userId: session.principal_id,
                    },
                )
            }

            return {
                nitrogenBalanceResult: nitrogenBalanceResult,
            }
        })()

        return {
            farm: farm,
            fields: fields,
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
                key={loaderData.farm.b_id_farm}
                fallback={<NitrogenBalanceFallback />}
            >
                <FarmBalanceNitrogenOverview {...loaderData} />
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
 * If `use(...)` was added to `FarmBalanceNitrogenOverviewBlock` instead, the Suspense
 * would not render until `asyncData` resolves and the fallback would never be shown.
 */
function FarmBalanceNitrogenOverview({
    farm,
    fields,
    asyncData,
}: Awaited<ReturnType<typeof loader>>) {
    const { nitrogenBalanceResult } = use(asyncData)

    const resolvedNitrogenBalanceResult = nitrogenBalanceResult

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
                                {resolvedNitrogenBalanceResult.errorMessage ===
                                "No fields in input"
                                    ? "Geen percelen gevonden in dit bedrijf."
                                    : "Er is helaas wat misgegaan."}{" "}
                                Probeer opnieuw of neem contact op met
                                Ondersteuning en deel de volgende foutmelding:
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

    const fieldsMap = new Map(fields.map((f) => [f.b_id, f]))
    const filteredFields = resolvedNitrogenBalanceResult.fields.filter(
        (fieldResult: NitrogenBalanceFieldResultNumeric) => {
            const fieldData = fieldsMap.get(fieldResult.b_id)
            return fieldData ? !fieldData.b_bufferstrip : false
        },
    )

    return (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Overschot / Doel (Bedrijf)
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
                                            Niet alle percelen konden worden
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
                        <CardTitle className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <p>Percelen</p>
                            <BufferStripInfo />
                        </CardTitle>
                        <CardDescription />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {filteredFields.map(
                                (
                                    fieldResult: NitrogenBalanceFieldResultNumeric,
                                ) => {
                                    const fieldData = fieldsMap.get(
                                        fieldResult.b_id,
                                    )
                                    return (
                                        <div
                                            className="flex items-center"
                                            key={fieldResult.b_id}
                                        >
                                            {fieldResult.balance ? (
                                                fieldResult.balance.balance <=
                                                fieldResult.balance.target ? (
                                                    <CircleCheck className="text-green-500 bg-green-100 p-0 rounded-full w-6 h-6" />
                                                ) : (
                                                    <CircleX className="text-red-500 bg-red-100 p-0 rounded-full w-6 h-6" />
                                                )
                                            ) : (
                                                <CircleAlert className="text-orange-500 bg-orange-100 p-0 rounded-full w-6 h-6" />
                                            )}

                                            <div className="ml-4 space-y-1">
                                                <NavLink
                                                    to={`./${fieldResult.b_id}`}
                                                >
                                                    <p className="text-sm font-medium leading-none hover:underline">
                                                        {fieldData?.b_name}
                                                    </p>
                                                </NavLink>
                                                <p className="text-sm text-muted-foreground">
                                                    {fieldData?.b_area} ha
                                                </p>
                                            </div>
                                            <div className="ml-auto font-medium">
                                                {fieldResult.balance ? (
                                                    `${fieldResult.balance.balance} / ${fieldResult.balance.target}`
                                                ) : (
                                                    <NavLink
                                                        to={`./${fieldResult.b_id}`}
                                                    >
                                                        <p className="text-sm text-end text-orange-500 hover:underline">
                                                            {
                                                                "Bekijk foutmelding"
                                                            }
                                                        </p>
                                                    </NavLink>
                                                )}
                                            </div>
                                        </div>
                                    )
                                },
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
