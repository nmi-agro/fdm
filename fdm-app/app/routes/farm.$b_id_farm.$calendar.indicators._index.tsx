import { getFields } from "@nmi-agro/fdm-core"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
    useParams,
} from "react-router"
import { AggregationCard } from "~/components/blocks/indicators/aggregation-card"
import { HeatmapTable } from "~/components/blocks/indicators/heatmap-table"
import {
    computeFarmAggregation,
    getIndicatorsForFarm,
} from "~/integrations/bln3.server"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { OBI_INDICATOR_IDS, BBWP_INDICATOR_IDS } from "~/lib/indicators"

export const meta: MetaFunction = () => {
    return [
        {
            title: `Indicatoren | Bedrijfsoverzicht | ${clientConfig.name}`,
        },
        {
            name: "description",
            content:
                "Bedrijfsoverzicht BLN3 bodemkwaliteitsindicatoren per perceel.",
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

        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )

        const fieldScores = await getIndicatorsForFarm({
            principal_id: session.principal_id,
            b_id_farm,
            timeframe,
        })

        // Log any per-field errors for observability without failing the page
        for (const result of fieldScores) {
            if (result.error) {
                reportError(
                    new Error(
                        `BLN3 score failed for field ${result.b_id}: ${result.error}`,
                    ),
                )
            }
        }

        const obiScore = computeFarmAggregation(fieldScores, OBI_INDICATOR_IDS, "score")
        const obiIndex = computeFarmAggregation(fieldScores, OBI_INDICATOR_IDS, "index")
        const bbwpScore = computeFarmAggregation(fieldScores, BBWP_INDICATOR_IDS, "score")
        const bbwpIndex = computeFarmAggregation(fieldScores, BBWP_INDICATOR_IDS, "index")

        return {
            fields,
            fieldScores,
            obiScore,
            obiIndex,
            bbwpScore,
            bbwpIndex,
        }
    } catch (error) {
        const normalized = handleLoaderError(error)
        throw normalized ?? error
    }
}

export default function IndicatorsFarmIndex() {
    const { fields, fieldScores, obiScore, obiIndex, bbwpScore, bbwpIndex } =
        useLoaderData<typeof loader>()
    const { b_id_farm, calendar } = useParams()
    const basePath = `/farm/${b_id_farm}/${calendar}/indicators`

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <h2 className="text-2xl font-bold tracking-tight">
                        Indicatoren
                    </h2>
                    <p className="text-muted-foreground">
                        BLN3 bodemkwaliteitsindicatoren voor alle percelen op
                        dit bedrijf.
                    </p>
                </div>
            </div>

            {/* Aggregation cards */}
            <div className="flex gap-4 flex-wrap">
                <AggregationCard
                    label="OBI"
                    name="Open Bodem Index"
                    score01={obiScore}
                    index01={obiIndex}
                    showIndex={false}
                />
                <AggregationCard
                    label="BBWP"
                    name="BedrijfsBodemWaterPlan"
                    score01={bbwpScore}
                    index01={bbwpIndex}
                    showIndex={false}
                />
            </div>

            {/* Heatmap table */}
            <HeatmapTable
                fields={fields.map((f) => ({
                    b_id: f.b_id,
                    b_name: f.b_name,
                }))}
                fieldScores={fieldScores}
                activeCategory={null}
                showIndex={false}
                basePath={basePath}
            />
        </div>
    )
}
