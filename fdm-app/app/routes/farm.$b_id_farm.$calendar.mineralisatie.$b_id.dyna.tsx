import {
    getFertilizerApplications,
    getFertilizers,
    getField,
    getGrazingIntention,
    getCultivations,
    type FertilizerApplication,
} from "@nmi-agro/fdm-core"
import { Slash } from "lucide-react"
import { Suspense, use } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { DynaAdviceCard } from "~/components/blocks/mineralisatie/dyna-advice"
import { DynaBalanceCard } from "~/components/blocks/mineralisatie/dyna-balance"
import { DynaChart } from "~/components/blocks/mineralisatie/dyna-chart"
import { LeachingChart } from "~/components/blocks/mineralisatie/leaching-chart"
import { DynaFallback } from "~/components/blocks/mineralisatie/skeletons"
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
    type DynaResult,
    getDynaForField,
} from "~/integrations/mineralisatie.server"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export const meta: MetaFunction<typeof loader> = ({ data: loaderData }) => {
    const name = loaderData?.field?.b_name ?? "Perceel"
    return [
        {
            title: `${name} — DYNA | Mineralisatie | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: `DYNA dynamisch N-advies voor ${name}.`,
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
        const year = timeframe.start?.getFullYear() ?? new Date().getFullYear()

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

        // Determine farm sector from grazing intention
        const isGrazing = await getGrazingIntention(
            fdm,
            session.principal_id,
            b_id_farm,
            year,
        )
        const farmSector = isGrazing ? "dairy" : "arable"

        // Get fertilizer applications, fertilizer properties, and cultivations in parallel
        const [applications, fertilizers, cultivations] = await Promise.all([
            getFertilizerApplications(
                fdm,
                session.principal_id,
                b_id,
                timeframe,
            ),
            getFertilizers(fdm, session.principal_id, b_id_farm),
            getCultivations(fdm, session.principal_id, b_id, timeframe),
        ])

        // Build a map from p_id → full fertilizer properties for quick lookup
        const fertilizerMap = new Map(fertilizers.map((f) => [f.p_id, f]))

        // Map fdm-core FertilizerApplication → DYNA fertilizer input
        const dynaFertilizers = applications.map((app: FertilizerApplication) => {
            const props = fertilizerMap.get(app.p_id)
            return {
                p_id: app.p_id,
                p_n_rt: props?.p_n_rt ?? null,
                p_n_if: props?.p_n_if ?? null,
                p_n_of: props?.p_n_of ?? null,
                p_n_wc: props?.p_n_wc ?? null,
                p_p_rt: props?.p_p_rt ?? null,
                p_k_rt: props?.p_k_rt ?? null,
                p_dm: props?.p_dm ?? null,
                p_om: props?.p_om ?? null,
                p_date: app.p_app_date,
                p_dose: app.p_app_amount,
                p_app_method: app.p_app_method ?? null,
            }
        })

        // Stream DYNA calculation
        const asyncData = getDynaForField({
            principal_id: session.principal_id,
            b_id,
            b_id_farm,
            timeframe,
            farmSector,
            fertilizers: dynaFertilizers,
        })

        // Build chart events: sowing, harvest, and fertilizer applications
        const fertilizerNameMap = new Map(
            fertilizers.map((f) => [f.p_id, f.p_name_nl ?? f.p_id]),
        )
        type ChartEvent = {
            date: string
            type: "sowing" | "harvest" | "fertilizer"
            label: string
        }
        const chartEvents: ChartEvent[] = []
        for (const c of cultivations) {
            if (c.b_lu_start) {
                chartEvents.push({
                    date: c.b_lu_start.toISOString().split("T")[0] ?? "",
                    type: "sowing",
                    label: c.b_lu_name ?? "Zaai",
                })
            }
            if (c.b_lu_end) {
                chartEvents.push({
                    date: c.b_lu_end.toISOString().split("T")[0] ?? "",
                    type: "harvest",
                    label: c.b_lu_name ?? "Oogst",
                })
            }
        }
        for (const app of applications) {
            if (app.p_app_date) {
                const name =
                    fertilizerNameMap.get(app.p_id) ??
                    app.p_name_nl ??
                    "Mest"
                chartEvents.push({
                    date: app.p_app_date.toISOString().split("T")[0] ?? "",
                    type: "fertilizer",
                    label: `${app.p_app_amount ?? "?"} kg — ${name}`,
                })
            }
        }

        return {
            isBufferStrip: false as const,
            field,
            b_id,
            b_id_farm,
            calendar: params.calendar ?? "",
            chartEvents,
            asyncData,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function DynaPage() {
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

    const { asyncData, chartEvents } = loaderData

    return (
        <div className="space-y-4">
            <Suspense fallback={<DynaFallback />}>
                <DynaContent
                    asyncData={asyncData}
                    year={Number(loaderData.calendar)}
                    chartEvents={chartEvents}
                />
            </Suspense>
        </div>
    )
}

function DynaContent({
    asyncData,
    year,
    chartEvents,
}: {
    asyncData: Promise<DynaResult>
    year: number
    chartEvents: { date: string; type: "sowing" | "harvest" | "fertilizer"; label: string }[]
}) {
    const result = use(asyncData)
    const {
        calculationDyna,
        nitrogenBalance,
        fertilizingRecommendations,
        harvestingRecommendation,
    } = result

    // Filter to the selected year only
    const yearData = calculationDyna.filter(
        (d) => new Date(d.b_date_calculation).getFullYear() === year,
    )

    // KPI values — use year-filtered data
    const lastPoint = yearData[yearData.length - 1]
    const today = new Date().toISOString().split("T")[0] ?? ""
    const todayPoint = yearData.find((d) => d.b_date_calculation >= today)

    const totalLeaching = lastPoint?.b_no3_leach ?? 0
    const currentNAvailability = todayPoint?.b_nw ?? lastPoint?.b_nw ?? 0
    const currentUptake = todayPoint?.b_n_uptake ?? lastPoint?.b_n_uptake ?? 0

    return (
        <>
            {/* KPI cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>N aanbod totaal</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums">
                            {nitrogenBalance.b_nw.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            kg N/ha/jaar
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>N beschikbaar nu</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums">
                            {currentNAvailability.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">kg N/ha</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>N opname nu</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums">
                            {currentUptake.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">kg N/ha</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>NO₃ uitspoeling</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums">
                            {totalLeaching.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            kg NO₃/ha (cumulatief)
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* DYNA chart */}
            <Card>
                <CardHeader>
                    <CardTitle>N-dynamiek</CardTitle>
                    <CardDescription>
                        N-beschikbaarheid (bandbreedte en verwachting) versus
                        N-opname door het gewas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <DynaChart
                        data={yearData}
                        fertilizingRecommendations={fertilizingRecommendations}
                        events={chartEvents}
                    />
                </CardContent>
            </Card>

            {/* Balance and advice side by side */}
            <div className="grid gap-4 md:grid-cols-2">
                <DynaBalanceCard nitrogenBalance={nitrogenBalance} />
                <DynaAdviceCard
                    fertilizingRecommendations={fertilizingRecommendations}
                    harvestingRecommendation={harvestingRecommendation}
                />
            </div>

            {/* Leaching chart */}
            <Card>
                <CardHeader>
                    <CardTitle>NO₃ uitspoeling</CardTitle>
                    <CardDescription>
                        Cumulatieve nitraatuitspoeling (kg NO₃/ha)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <LeachingChart data={yearData} />
                </CardContent>
            </Card>
        </>
    )
}
