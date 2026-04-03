import { getFarm, getFields } from "@nmi-agro/fdm-core"
import { Suspense, use } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { FieldList } from "~/components/blocks/mineralisatie/field-list"
import { MethodSelector } from "~/components/blocks/mineralisatie/method-selector"
import { FarmMineralisatieChart } from "~/components/blocks/mineralisatie/mineralisatie-chart"
import { FarmNSupplyKpi } from "~/components/blocks/mineralisatie/nsupply-kpi"
import { MineralisatieFallback } from "~/components/blocks/mineralisatie/skeletons"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    getNSupplyForFarm,
    type NSupplyMethod,
    type NSupplyResult,
} from "~/integrations/mineralisatie.server"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export const meta: MetaFunction = () => {
    return [
        {
            title: `Mineralisatie | Bedrijfsoverzicht | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bedrijfsoverzicht stikstofmineralisatie.",
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

        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )

        // Read method from search params (default: minip)
        const url = new URL(request.url)
        const method = (url.searchParams.get("method") ??
            "minip") as NSupplyMethod

        const asyncData = (async () => {
            try {
                const results = await getNSupplyForFarm({
                    principal_id: session.principal_id,
                    b_id_farm,
                    method,
                    timeframe,
                })
                return { results }
            } catch (err) {
                reportError(
                    err instanceof Error ? err.message : String(err),
                    {
                        page: "farm/{b_id_farm}/{calendar}/mineralisatie/_index",
                        scope: "loader/asyncData",
                    },
                    { b_id_farm },
                )
                return { results: [] as NSupplyResult[] }
            }
        })()

        return {
            farm,
            fields,
            b_id_farm,
            method,
            calendar: params.calendar ?? "",
            asyncData,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function MineralisatieFarmOverview() {
    const loaderData = useLoaderData<typeof loader>()
    const { b_id_farm, method, calendar, asyncData } = loaderData

    return (
        <div className="space-y-4">
            <Suspense fallback={<MineralisatieFallback />}>
                <MineralisatieFarmContent
                    asyncData={asyncData}
                    b_id_farm={b_id_farm}
                    method={method}
                    calendar={calendar}
                />
            </Suspense>
        </div>
    )
}

function MineralisatieFarmContent({
    asyncData,
    b_id_farm,
    method,
    calendar,
}: {
    asyncData: Promise<{ results: NSupplyResult[] }>
    b_id_farm: string
    method: NSupplyMethod
    calendar: string
}) {
    const { results } = use(asyncData)

    // Compute farm-average curve (simple average per DOY across all valid results)
    const validResults = results.filter((r) => !r.error && r.data.length > 0)
    const farmAvgData = computeFarmAverageCurve(validResults)

    return (
        <>
            <div className="grid gap-4 md:grid-cols-3">
                <FarmNSupplyKpi results={results} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Mineralisatiecurve — Bedrijfsgemiddelde
                            </CardTitle>
                            <CardDescription>
                                Cumulatieve N-levering (kg N/ha) over het jaar
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FarmMineralisatieChart data={farmAvgData} />
                        </CardContent>
                    </Card>
                </div>
                <div className="col-span-3">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle>Percelen</CardTitle>
                                <CardDescription>
                                    Gesorteerd op N-levering
                                </CardDescription>
                            </div>
                            <MethodSelector value={method} />
                        </CardHeader>
                        <CardContent>
                            <FieldList
                                results={results}
                                b_id_farm={b_id_farm}
                                calendar={calendar}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    )
}

function computeFarmAverageCurve(
    results: NSupplyResult[],
): { doy: number; d_n_supply_actual: number }[] {
    if (results.length === 0) return []

    const doyMap = new Map<number, number[]>()
    for (const result of results) {
        for (const point of result.data) {
            const existing = doyMap.get(point.doy) ?? []
            existing.push(point.d_n_supply_actual)
            doyMap.set(point.doy, existing)
        }
    }

    return Array.from(doyMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([doy, values]) => ({
            doy,
            d_n_supply_actual:
                values.reduce((s, v) => s + v, 0) / values.length,
        }))
}
