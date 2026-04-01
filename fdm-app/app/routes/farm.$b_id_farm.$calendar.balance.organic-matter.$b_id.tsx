import { getFarm, getField } from "@nmi-agro/fdm-core"
import {
    ArrowDownToLine,
    ArrowRightLeft,
    ArrowUpFromLine,
    CircleAlert,
    CircleCheck,
} from "lucide-react"
import { Suspense, use } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    NavLink,
    useLoaderData,
    useLocation,
} from "react-router"
import { BufferStripWarning } from "~/components/blocks/balance/buffer-strip-warning"
import { OrganicMatterBalanceChart } from "~/components/blocks/balance/organic-matter-chart"
import OrganicMatterBalanceDetails from "~/components/blocks/balance/organic-matter-details"
import { NitrogenBalanceFallback } from "~/components/blocks/balance/skeletons"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { getOrganicMatterBalanceForField } from "~/integrations/calculator"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { useCalendarStore } from "~/store/calendar"

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Organische stof | Perceel | Nutriëntenbalans| ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk de organische stofbalans van dit perceel.",
        },
    ]
}

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

        const organicMatterBalancePromise = (async () => {
            const result = await getOrganicMatterBalanceForField({
                fdm,
                principal_id: session.principal_id,
                b_id_farm,
                b_id,
                timeframe,
            })
            let { fieldResult, fieldInput } = result

            if (!fieldResult) {
                throw new Error(
                    `Organic matter balance data not found for field ${b_id}`,
                )
            }
            if (fieldResult.errorMessage) {
                const errorId = reportError(
                    fieldResult.errorMessage,
                    {
                        page: "farm/{b_id_farm}/{calendar}/balance/organic-matter/{b_id}",
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
                fieldResult = { ...fieldResult, errorId }
            }

            return {
                fieldResult: fieldResult,
                fieldInput: fieldInput,
            }
        })()

        return {
            organicMatterBalanceResult: organicMatterBalancePromise,
            field: field,
            farm: farm,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FarmBalanceOrganicMatterFieldBlock() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <div className="space-y-4">
            <Suspense
                key={`${loaderData.farm.b_id_farm}#${loaderData.field.b_id}`}
                fallback={<NitrogenBalanceFallback />}
            >
                <OrganicMatterBalance {...loaderData} />
            </Suspense>
        </div>
    )
}

function OrganicMatterBalance({
    farm,
    field,
    organicMatterBalanceResult,
}: Awaited<ReturnType<typeof loader>>) {
    const { fieldResult, fieldInput } = use(organicMatterBalanceResult)
    const location = useLocation()
    const page = location.pathname
    const calendar = useCalendarStore((state) => state.calendar)

    if (field.b_bufferstrip) {
        return <BufferStripWarning b_id={field.b_id} />
    }

    if (fieldResult.errorMessage) {
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
                        {fieldResult.errorMessage.match(
                            /Missing required soil parameters/,
                        ) ? (
                            <div className="text-muted-foreground">
                                <p>
                                    Voor dit perceel zijn de benodigde
                                    bodemparameters niet bekend:
                                </p>
                                <br />
                                <ul className="list-disc list-inside">
                                    {fieldResult.errorMessage.match(
                                        /a_som_loi|a_density_sa/,
                                    ) ? (
                                        <li>
                                            Organische stofgehalte of
                                            bulkdichtheid
                                        </li>
                                    ) : null}
                                </ul>
                            </div>
                        ) : (
                            <div className="text-muted-foreground">
                                <p>
                                    Er is helaas wat misgegaan. Probeer opnieuw
                                    of neem contact op met Ondersteuning en deel
                                    de volgende foutmelding:
                                </p>
                                <div className="mt-8 w-full max-w-2xl">
                                    <pre className="bg-gray-200 dark:bg-gray-800 p-4 rounded-md overflow-x-auto text-sm text-gray-800 dark:text-gray-200">
                                        {JSON.stringify(
                                            {
                                                errorId: fieldResult.errorId,
                                                page: page,
                                                timestamp: new Date(),
                                            },
                                            null,
                                            2,
                                        )}
                                    </pre>
                                </div>
                            </div>
                        )}
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
                                Dit perceel was niet in gebruik voor dit jaar of
                                er is een onbekende fout opgetreden. Als dit
                                perceel wel in gebruik was, werk dan de
                                startdatum bij in de perceelsinstelling.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <NavLink
                            to={`/farm/${farm.b_id_farm}/${calendar}/field/${field.b_id}`}
                        >
                            <Button>Naar perceelsinstelling</Button>
                        </NavLink>
                    </CardFooter>
                </Card>
            </div>
        )
    }
    const result = fieldResult.balance

    return (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Balans (Perceel)
                        </CardTitle>
                        <ArrowRightLeft className="text-xs text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            <div className="flex items-center gap-4">
                                <p>{result.balance}</p>
                                {result.balance > 0 ? (
                                    <CircleCheck className="text-green-500 bg-green-100 p-0 rounded-full " />
                                ) : (
                                    <CircleAlert className="text-red-500 bg-red-100 rounded-full " />
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
                            {result.supply.total}
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
                            {result.degradation.total}
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
                            De organische stofbalans voor {field.b_name} van{" "}
                            {farm.b_name_farm}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <OrganicMatterBalanceChart
                            supply={result.supply.total}
                            degradation={result.degradation.total}
                        />
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Posten</CardTitle>
                        <CardDescription />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            <OrganicMatterBalanceDetails
                                balanceData={fieldResult.balance}
                                fieldInput={fieldInput}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
