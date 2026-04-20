import { getCurrentSoilData, getField } from "@nmi-agro/fdm-core"
import { ArrowRight, FlaskConical, Lightbulb, Slash } from "lucide-react"
import { Suspense, use } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    NavLink,
    useLoaderData,
} from "react-router"
import { DataCompletenessCard } from "~/components/blocks/mineralization/data-completeness"
import { FieldMineralizationChart } from "~/components/blocks/mineralization/mineralization-chart"
import { FieldNSupplyDetailsCard } from "~/components/blocks/mineralization/nsupply-kpi"
import { MineralizationFieldDetailFallback } from "~/components/blocks/mineralization/skeletons"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "~/components/ui/empty"
import {
    assessDataCompleteness,
    type DataCompleteness,
    generateInsights,
    getNSupplyForField,
    type NSupplyMethod,
    type NSupplyResult,
} from "~/integrations/mineralization.server"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

const METHODS: NSupplyMethod[] = ["minip", "pmn", "century"]

export const meta: MetaFunction<typeof loader> = ({ data: loaderData }) => {
    const name = loaderData?.field?.b_name ?? "Perceel"
    return [
        {
            title: `${name} | Mineralisatie | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: `Mineralisatiedetails voor ${name}.`,
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        const b_id = params.b_id
        if (!b_id_farm) {
            throw data("invalid: b_id_farm", {
                status: 400,
                statusText: "invalid: b_id_farm",
            })
        }
        if (!b_id) {
            throw data("invalid: b_id", {
                status: 400,
                statusText: "invalid: b_id",
            })
        }

        const session = await getSession(request)
        const timeframe = getTimeframe(params)

        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) {
            throw data("not found: b_id", {
                status: 404,
                statusText: "not found: b_id",
            })
        }
        if (field.b_bufferstrip) {
            return {
                isBufferStrip: true as const,
                field,
                b_id,
                b_id_farm,
                calendar: params.calendar ?? "",
            }
        }

        // Get soil data
        const soilDataArray = await getCurrentSoilData(
            fdm,
            session.principal_id,
            b_id,
        )
        const soilData: Record<string, number | string | null | undefined> = {}
        const soilMeta: Record<string, { source?: string; date?: Date }> = {}

        if (soilDataArray && soilDataArray.length > 0) {
            for (const entry of soilDataArray) {
                if (entry.parameter && entry.value !== undefined) {
                    soilData[entry.parameter] = entry.value as
                        | number
                        | string
                        | null
                        | undefined
                    soilMeta[entry.parameter] = {
                        source: entry.a_source ?? undefined,
                        date: entry.b_sampling_date ?? undefined,
                    }
                }
            }
        }

        const organicMatter =
            soilData.a_som_loi != null ? Number(soilData.a_som_loi) : undefined
        const soilType =
            soilData.b_soiltype_agr != null
                ? String(soilData.b_soiltype_agr)
                : undefined
        const completeness = assessDataCompleteness(soilData, "minip", soilMeta)

        // Fetch all 3 methods in parallel (streamed)
        const asyncData = (async () => {
            const results = await Promise.all(
                METHODS.map(async (method): Promise<NSupplyResult> => {
                    try {
                        return await getNSupplyForField({
                            principal_id: session.principal_id,
                            b_id,
                            method,
                            timeframe,
                        })
                    } catch (err) {
                        return {
                            b_id,
                            b_name: field.b_name ?? b_id,
                            method,
                            data: [],
                            totalAnnualN: 0,
                            completeness: {
                                available: [],
                                missing: [],
                                estimated: [],
                                score: 0,
                            },
                            error:
                                err instanceof Error
                                    ? err.message
                                    : String(err),
                        }
                    }
                }),
            )

            const primaryResult =
                results.find((r) => r.method === "minip" && !r.error) ??
                results.find((r) => !r.error)

            const now = new Date()
            const currentDoy = Math.floor(
                (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) /
                    (1000 * 60 * 60 * 24),
            )

            const insights = primaryResult
                ? generateInsights(primaryResult, undefined, currentDoy)
                : []

            return { results, insights }
        })()

        return {
            isBufferStrip: false as const,
            field,
            b_id,
            b_id_farm,
            calendar: params.calendar ?? "",
            soilData,
            organicMatter,
            soilType,
            completeness,
            asyncData,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function MineralizationFieldDetail() {
    const loaderData = useLoaderData<typeof loader>()

    if (loaderData.isBufferStrip) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Slash />
                    </EmptyMedia>
                    <EmptyTitle>Niet beschikbaar voor bufferstroken</EmptyTitle>
                    <EmptyDescription>
                        Mineralisatieberekeningen zijn niet beschikbaar voor
                        bufferstroken.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        )
    }

    const { b_id, b_id_farm, calendar, completeness, asyncData } = loaderData

    return (
        <div className="space-y-4">
            <Suspense fallback={<MineralizationFieldDetailFallback />}>
                <MineralizationFieldContent
                    asyncData={asyncData}
                    b_id={b_id}
                    b_id_farm={b_id_farm}
                    calendar={calendar}
                    completeness={completeness}
                />
            </Suspense>
        </div>
    )
}

function MineralizationFieldContent({
    asyncData,
    b_id,
    b_id_farm,
    calendar,
    completeness,
}: {
    asyncData: Promise<{ results: NSupplyResult[]; insights: string[] }>
    b_id: string
    b_id_farm: string
    calendar: string
    completeness: DataCompleteness
}) {
    const { results, insights } = use(asyncData)

    const series = results.map((r) => ({
        method: r.method,
        data: r.data,
        error: r.error,
    }))

    return (
        <>
            {/* Insights — prominent, above the chart */}
            {insights.length > 0 && (
                <Card className="border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                            Inzichten
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                        {insights.map((insight, i) => (
                            <p
                                // biome-ignore lint/suspicious/noArrayIndexKey: stable insight list
                                key={i}
                                className="text-sm"
                            >
                                {insight}
                            </p>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* DYNA Call-to-Action — prominent banner */}
            <div className="rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 p-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="rounded-lg bg-blue-100 dark:bg-blue-900/50 p-2 shrink-0">
                        <FlaskConical className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">
                                Dynamisch N-advies met DYNA
                            </span>
                            <span className="rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 font-medium">
                                bèta
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Gedetailleerd N-opname vs. beschikbaarheid advies op
                            dagbasis — inclusief uitspoelingsrisico.
                        </p>
                    </div>
                </div>
                <Button asChild size="sm" className="shrink-0">
                    <NavLink
                        to={`/farm/${b_id_farm}/${calendar}/mineralization/${b_id}/dyna`}
                    >
                        Naar DYNA
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </NavLink>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Mineralisatiecurve</CardTitle>
                    <CardDescription>
                        Cumulatieve N-levering (kg N/ha) — vergelijking van
                        MINIP, PMN en Century methoden
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FieldMineralizationChart
                        series={series}
                        year={Number(calendar)}
                    />
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <FieldNSupplyDetailsCard results={results} />
                <DataCompletenessCard
                    completeness={completeness}
                    method="minip"
                    b_id_farm={b_id_farm}
                    b_id={b_id}
                    calendar={calendar}
                />
            </div>
        </>
    )
}
