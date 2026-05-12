import { getFields } from "@nmi-agro/fdm-core"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
    useParams,
    useSearchParams,
} from "react-router"
import { AggregationCard } from "~/components/blocks/indicators/aggregation-card"
import { Bln3HelpDialog } from "~/components/blocks/indicators/bln3-help-dialog"
import { CategoryFilter, parseActiveCategories } from "~/components/blocks/indicators/category-filter"
import { MeasuresToggle } from "~/components/blocks/indicators/measures-toggle"
import { HeatmapTable } from "~/components/blocks/indicators/table"
import {
    computeFarmAggregation,
    getIndicatorsForFarm,
} from "~/integrations/bln3.server"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
    OBI_INDICATOR_IDS,
    BBWP_INDICATOR_IDS,
} from "~/lib/indicators"

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

        for (const result of fieldScores) {
            if (result.error) {
                reportError(
                    new Error(
                        `BLN3 score failed for field ${result.b_id}: ${result.error}`,
                    ),
                )
            }
        }

        const obiScore = computeFarmAggregation(
            fieldScores,
            OBI_INDICATOR_IDS,
            "score",
        )
        const obiIndex = computeFarmAggregation(
            fieldScores,
            OBI_INDICATOR_IDS,
            "index",
        )
        const bbwpScore = computeFarmAggregation(
            fieldScores,
            BBWP_INDICATOR_IDS,
            "score",
        )
        const bbwpIndex = computeFarmAggregation(
            fieldScores,
            BBWP_INDICATOR_IDS,
            "index",
        )

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

    const [searchParams] = useSearchParams()

    // Category filter from URL (multi-select)
    const activeCategories = parseActiveCategories(searchParams)

    // Measures toggle: default = "met maatregelen" (showIndex=false)
    const showIndex = searchParams.get("measures") === "off"

    return (
        <div className="space-y-6 py-5 px-10">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                    <h2 className="text-2xl font-bold tracking-tight">
                        Indicatoren
                    </h2>
                    <p className="text-muted-foreground">
                        BLN3 bodemkwaliteitsindicatoren voor alle percelen op
                        dit bedrijf.
                    </p>
                </div>
                <Bln3HelpDialog />
            </div>

            <div className="flex gap-4 flex-wrap">
                <AggregationCard
                    label="OBI"
                    name="Open Bodem Index"
                    score01={obiScore}
                    index01={obiIndex}
                    showIndex={showIndex}
                />
                <AggregationCard
                    label="BBWP"
                    name="BedrijfsBodemWaterPlan"
                    score01={bbwpScore}
                    index01={bbwpIndex}
                    showIndex={showIndex}
                />
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <CategoryFilter />
                    <MeasuresToggle />
                </div>
                <HeatmapTable
                    fields={fields.map((field) => ({
                        b_id: field.b_id,
                        b_name: field.b_name,
                    }))}
                    fieldScores={fieldScores}
                    activeCategories={activeCategories}
                    showIndex={showIndex}
                    basePath={basePath}
                />
            </div>
        </div>
    )
}
