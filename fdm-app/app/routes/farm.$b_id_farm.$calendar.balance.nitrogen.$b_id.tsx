import {
    calculateNitrogenBalance,
    collectInputForNitrogenBalance,
} from "@nmi-agro/fdm-calculator"
import { getFarm, getField } from "@nmi-agro/fdm-core"
import {
    ArrowDown,
    ArrowRight,
    ArrowRightFromLine,
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
import { NitrogenBalanceChart } from "~/components/blocks/balance/nitrogen-chart"
import NitrogenBalanceDetails from "~/components/blocks/balance/nitrogen-details"
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
            title: `Stikstof | Perceel | Nutriëntenbalans| ${clientConfig.name}`,
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

        // Get the field id
        const b_id = params.b_id
        if (!b_id) {
            throw data("invalid: b_id", {
                status: 400,
                statusText: "invalid: b_id",
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

        // Get details of field
        const field = await getField(fdm, session.principal_id, b_id)

        // Return promise directly for React Router v7 Suspense pattern
        const nitrogenBalancePromise = collectInputForNitrogenBalance(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
            b_id,
        ).then(async (input) => {
            const nitrogenBalanceResult = await calculateNitrogenBalance(
                fdm,
                input,
            )
            let fieldResult = nitrogenBalanceResult.fields.find(
                (field: { b_id: string }) => field.b_id === b_id,
            )

            if (!fieldResult) {
                throw new Error(
                    `Nitrogen balance data not found for field ${b_id}`,
                )
            }

            if (fieldResult.errorMessage) {
                const errorId = reportError(
                    fieldResult.errorMessage,
                    {
                        page: "farm/{b_id_farm}/{calendar}/balance/nitrogen/{b_id}",
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

                fieldResult = {
                    b_id: b_id,
                    b_area: field?.b_area ?? 0,
                    errorMessage: fieldResult.errorMessage,
                    errorId: errorId,
                }
            }
            const inputForField = input.fields.find(
                (field: { field: { b_id: string } }) =>
                    field.field.b_id === b_id,
            )

            return {
                fieldResult: fieldResult,
                fieldInput: inputForField,
            }
        })

        return {
            nitrogenBalanceResult: nitrogenBalancePromise,
            field: field,
            farm: farm,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function FarmBalanceNitrogenFieldBlock() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <div className="space-y-4">
            <Suspense
                key={`${loaderData.farm.b_id_farm}#${loaderData.field.b_id}`}
                fallback={<NitrogenBalanceFallback />}
            >
                <NitrogenBalance {...loaderData} />
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
 * If `use(...)` was added to `FarmBalanceNitrogenFieldBlock` instead, the Suspense
 * would not render until `asyncData` resolves and the fallback would never be shown.
 */
function NitrogenBalance({
    farm,
    field,
    nitrogenBalanceResult,
}: Awaited<ReturnType<typeof loader>>) {
    const { fieldResult, fieldInput } = use(nitrogenBalanceResult)

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
                                        /a_n_rt/,
                                    ) ? (
                                        <li>Totaal stikstofgehalte</li>
                                    ) : null}
                                    {fieldResult.errorMessage.match(
                                        /b_soiltype_agr/,
                                    ) ? (
                                        <li>Agrarisch bodemtype</li>
                                    ) : null}
                                    {fieldResult.errorMessage.match(
                                        /a_c_of|a_som_loi/,
                                    ) ? (
                                        <li>Organische stofgehalte</li>
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
                                                // message:
                                                //     fieldResult.errorMessage,
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

    // If fieldResult.balance is undefined, it means there was an error that was caught
    // and handled by returning an errorMessage, which is handled above.
    // If it's still undefined here, it's an unexpected state, so we can return a generic error.
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
                        <NavLink to={`../../${calendar}/field/${field.b_id}/`}>
                            <Button>Naar perceelsinstelling</Button>
                        </NavLink>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    const result = fieldResult.balance // Use the actual balance data

    return (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Overschot / Doel (Perceel)
                        </CardTitle>
                        <ArrowRightLeft className="text-xs text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            <div className="flex items-center gap-4">
                                <p>{`${result.balance} / ${result.target}`}</p>
                                {result.balance <= result.target ? (
                                    <CircleCheck className="text-green-500 bg-green-100 p-0 rounded-full " />
                                ) : (
                                    <CircleAlert className="text-red-500 bg-red-100 rounded-full " />
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
                            {result.supply.total}
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
                            {result.removal.total}
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
                            {result.emission.ammonia.total}
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
                            {result.emission.nitrate.total}
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
                            De stikstofbalans voor {field.b_name} van{" "}
                            {farm.b_name_farm}. De balans is het verschil tussen
                            de totale aanvoer, afvoer en emissie van stikstof.
                            Een positieve balans betekent een overschot aan
                            stikstof, een negatieve balans een tekort.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <NitrogenBalanceChart
                            type="field"
                            balanceData={result}
                            fieldInput={fieldInput}
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
                            <NitrogenBalanceDetails
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
