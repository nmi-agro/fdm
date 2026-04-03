import { getCurrentSoilData, getField } from "@nmi-agro/fdm-core"
import { ArrowRight, Lightbulb } from "lucide-react"
import { Suspense, use } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    NavLink,
    useLoaderData,
} from "react-router"
import { DataCompletenessCard } from "~/components/blocks/mineralisatie/data-completeness"
import { FieldMineralisatieChart } from "~/components/blocks/mineralisatie/mineralisatie-chart"
import { FieldNSupplyDetailsCard } from "~/components/blocks/mineralisatie/nsupply-kpi"
import { MineralisatieFieldDetailFallback } from "~/components/blocks/mineralisatie/skeletons"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    assessDataCompleteness,
    type DataCompleteness,
    generateInsights,
    getNSupplyForField,
    type NSupplyMethod,
    type NSupplyResult,
} from "~/integrations/mineralisatie.server"
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

export default function MineralisatieFieldDetail() {
    const loaderData = useLoaderData<typeof loader>()
    const {
        b_id,
        b_id_farm,
        calendar,
        completeness,
        asyncData,
    } = loaderData

    return (
        <div className="space-y-4">
            <Suspense fallback={<MineralisatieFieldDetailFallback />}>
                <MineralisatieFieldContent
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

function MineralisatieFieldContent({
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

            <Card>
                <CardHeader>
                    <CardTitle>Mineralisatiecurve</CardTitle>
                    <CardDescription>
                        Cumulatieve N-levering (kg N/ha) — vergelijking van
                        MINIP, PMN en Century methoden
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FieldMineralisatieChart series={series} />
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

            {/* DYNA Call-to-Action */}
            <Alert>
                <AlertTitle>Dynamisch N-advies beschikbaar (bèta)</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>
                        Bereken gedetailleerd N-opname vs. beschikbaarheid
                        advies met het DYNA-model.
                    </span>
                    <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="ml-4 shrink-0"
                    >
                        <NavLink
                            to={`/farm/${b_id_farm}/${calendar}/mineralisatie/${b_id}/dyna`}
                        >
                            DYNA bekijken
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </NavLink>
                    </Button>
                </AlertDescription>
            </Alert>
        </>
    )
}
