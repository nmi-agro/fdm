import { getFarm, getFields } from "@nmi-agro/fdm-core"
import { Component, Zap } from "lucide-react"
import { Suspense, use } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { DynaFieldList } from "~/components/blocks/mineralization/dyna-field-list"
import { FieldList } from "~/components/blocks/mineralization/field-list"
import { MethodSelector } from "~/components/blocks/mineralization/method-selector"
import { FarmMineralizationChart } from "~/components/blocks/mineralization/mineralization-chart"
import { FarmNSupplyKpi } from "~/components/blocks/mineralization/nsupply-kpi"
import { MineralizationFallback } from "~/components/blocks/mineralization/skeletons"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    getNSupplyForFarm,
    getDynaForFarm,
    type NSupplyMethod,
    type NSupplyResult,
    type FarmDynaResult,
} from "~/integrations/mineralization.server"
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

        const allFields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )
        const fields = allFields.filter((f) => !f.b_bufferstrip)

        // Read method from search params (default: minip)
        const url = new URL(request.url)
        const methodParam = url.searchParams.get("method")
        const method: NSupplyMethod =
            methodParam === "minip" ||
            methodParam === "pmn" ||
            methodParam === "century"
                ? methodParam
                : "minip"

        const asyncNSupply = (async () => {
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
                        page: "farm/{b_id_farm}/{calendar}/mineralization/_index",
                        scope: "loader/asyncNSupply",
                    },
                    { b_id_farm },
                )
                return { results: [] as NSupplyResult[] }
            }
        })()

        const asyncDynaPromises = (async () => {
            try {
                return await getDynaForFarm({
                    principal_id: session.principal_id,
                    b_id_farm,
                    timeframe,
                })
            } catch (err) {
                reportError(
                    err instanceof Error ? err.message : String(err),
                    {
                        page: "farm/{b_id_farm}/{calendar}/mineralization/_index",
                        scope: "loader/asyncDynaPromises",
                    },
                    { b_id_farm },
                )
                return [] as Promise<FarmDynaResult>[]
            }
        })()

        return {
            farm,
            fields,
            b_id_farm,
            method,
            calendar: params.calendar ?? "",
            asyncNSupply,
            asyncDynaPromises,
        }
    } catch (error) {
        const normalized = handleLoaderError(error)
        throw normalized ?? error
    }
}

export default function MineralizationFarmOverview() {
    const loaderData = useLoaderData<typeof loader>()
    const { b_id_farm, method, calendar, asyncNSupply, asyncDynaPromises, fields } =
        loaderData

    return (
        <div className="space-y-8">
            <Suspense fallback={<MineralizationFallback />}>
                <MineralizationFarmContent
                    asyncNSupply={asyncNSupply}
                    asyncDynaPromises={asyncDynaPromises}
                    b_id_farm={b_id_farm}
                    method={method}
                    calendar={calendar}
                    fields={fields}
                />
            </Suspense>
        </div>
    )
}

function MineralizationFarmContent({
    asyncNSupply,
    asyncDynaPromises,
    b_id_farm,
    method,
    calendar,
    fields,
}: {
    asyncNSupply: Promise<{ results: NSupplyResult[] }>
    asyncDynaPromises: Promise<Promise<FarmDynaResult>[]>
    b_id_farm: string
    method: NSupplyMethod
    calendar: string
    fields: { b_id: string; b_name: string | null }[]
}) {
    const { results } = use(asyncNSupply)
    const dynaPromisesArray = use(asyncDynaPromises)

    // Map the array of promises to a keyed object for the DynaFieldList
    const dynaPromises = Object.fromEntries(
        fields.map((field, i) => [field.b_id, dynaPromisesArray[i]]),
    )

    // Compute farm-average curve (simple average per DOY across all valid results)
    const validResults = results.filter((r) => !r.error && r.data.length > 0)
    const farmAvgData = computeFarmAverageCurve(validResults)

    return (
        <div className="space-y-8">
            {/* 1. N-Supply Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <h3 className="text-lg font-semibold tracking-tight">
                        Bodem N-levering
                    </h3>
                </div>

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
                                    Cumulatieve N-levering (kg N/ha) over het
                                    jaar. Schatting op basis van bodemgegevens.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FarmMineralizationChart
                                    data={farmAvgData}
                                    year={Number(calendar)}
                                />
                            </CardContent>
                        </Card>
                    </div>
                    <div className="col-span-3">
                        <Card className="h-full flex flex-col">
                            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                <div>
                                    <CardTitle>Percelen</CardTitle>
                                    <CardDescription>
                                        Gesorteerd op N-levering
                                    </CardDescription>
                                </div>
                                <MethodSelector value={method} />
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto max-h-[400px]">
                                <FieldList
                                    results={results}
                                    b_id_farm={b_id_farm}
                                    calendar={calendar}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* 2. DYNA Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Component className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-lg font-semibold tracking-tight">
                        DYNA
                    </h3>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Resultaten per perceel</CardTitle>
                        <CardDescription>
                            Dag-voor-dag berekening van N-beschikbaarheid en
                            gewasopname op basis van bodem, gewas én
                            bemesting. Resultaten laden per perceel.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-auto max-h-[500px]">
                        <DynaFieldList
                            fields={fields}
                            promises={dynaPromises}
                            b_id_farm={b_id_farm}
                            calendar={calendar}
                        />
                    </CardContent>
                </Card>
            </section>
        </div>
    )
}

function computeFarmAverageCurve(
    results: NSupplyResult[],
): { doy: number; d_n_supply_actual: number }[] {
    if (results.length === 0) return []

    const doyMap = new Map<
        number,
        {
            sumWeighted: number
            sumArea: number
            sumUnweighted: number
            count: number
        }
    >()

    for (const result of results) {
        if (result.error || result.data.length === 0) continue
        const area = result.area || 0

        for (const point of result.data) {
            const existing = doyMap.get(point.doy) ?? {
                sumWeighted: 0,
                sumArea: 0,
                sumUnweighted: 0,
                count: 0,
            }
            if (area > 0) {
                existing.sumWeighted += area * point.d_n_supply_actual
                existing.sumArea += area
            }
            existing.sumUnweighted += point.d_n_supply_actual
            existing.count += 1
            doyMap.set(point.doy, existing)
        }
    }

    return Array.from(doyMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([doy, { sumWeighted, sumArea, sumUnweighted, count }]) => ({
            doy,
            d_n_supply_actual:
                sumArea > 0
                    ? sumWeighted / sumArea
                    : count > 0
                      ? sumUnweighted / count
                      : 0,
        }))
}
