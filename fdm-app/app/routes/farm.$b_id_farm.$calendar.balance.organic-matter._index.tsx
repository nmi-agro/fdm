import type { OrganicMatterBalanceFieldResultNumeric } from "@nmi-agro/fdm-calculator"
import { getFarm, getFields } from "@nmi-agro/fdm-core"
import {
    ArrowDownToLine,
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
import { OrganicMatterBalanceChart } from "~/components/blocks/balance/organic-matter-chart"
import { NitrogenBalanceFallback } from "~/components/blocks/balance/skeletons" // Can be reused
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { getOrganicMatterBalanceForFarm } from "~/integrations/calculator"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Organische stof | Bedrijf | Nutriëntenbalans| ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk de organische stofbalans van je bedrijf.",
        },
    ]
}

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

        const asyncData = (async () => {
            const organicMatterBalanceResult =
                await getOrganicMatterBalanceForFarm({
                    fdm,
                    principal_id: session.principal_id,
                    b_id_farm,
                    timeframe,
                })

            if (organicMatterBalanceResult.hasErrors) {
                reportError(
                    organicMatterBalanceResult.fieldErrorMessages.join(",\n"),
                    {
                        page: "farm/{b_id_farm}/{calendar}/balance/organic-matter/_index",
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
                organicMatterBalanceResult: organicMatterBalanceResult,
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

export default function FarmBalanceOrganicMatterOverviewBlock() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <div className="space-y-4">
            <Suspense
                key={loaderData.farm.b_id_farm}
                fallback={<NitrogenBalanceFallback />}
            >
                <FarmBalanceOrganicMatterOverview {...loaderData} />
            </Suspense>
        </div>
    )
}

function FarmBalanceOrganicMatterOverview({
    farm,
    fields,
    asyncData,
}: Awaited<ReturnType<typeof loader>>) {
    const { organicMatterBalanceResult } = use(asyncData)

    if (organicMatterBalanceResult.errorMessage) {
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
                                {organicMatterBalanceResult.errorMessage ===
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
                                                organicMatterBalanceResult.errorMessage,
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

    const { hasErrors } = organicMatterBalanceResult
    const fieldsMap = new Map(fields.map((f) => [f.b_id, f]))
    const filteredFields = organicMatterBalanceResult.fields.filter(
        (fieldResult: OrganicMatterBalanceFieldResultNumeric) => {
            const fieldData = fieldsMap.get(fieldResult.b_id)
            return fieldData ? !fieldData.b_bufferstrip : false
        },
    )

    return (
        <>
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
                            {organicMatterBalanceResult.balance}
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
                            {organicMatterBalanceResult.supply}
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
                            {organicMatterBalanceResult.degradation}
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
                            De organische stofbalans voor alle percelen van{" "}
                            {farm.b_name_farm}. De balans is het verschil tussen
                            de effectieve organische stof aanvoer en de afbraak
                            van organische stof.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <OrganicMatterBalanceChart
                            supply={organicMatterBalanceResult.supply}
                            degradation={organicMatterBalanceResult.degradation}
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
                                    fieldResult: OrganicMatterBalanceFieldResultNumeric,
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
                                                fieldResult.balance.balance >
                                                0 ? (
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
                                                    `${fieldResult.balance.balance}`
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
