import { getFields } from "@nmi-agro/fdm-core"
import { useMemo, useState, useTransition } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
    useParams,
} from "react-router"
import { AggregationCard } from "~/components/blocks/indicators/aggregation-card"
import { Bln3HelpDialog } from "~/components/blocks/indicators/bln3-help-dialog"
import { CategoryFilter } from "~/components/blocks/indicators/category-filter"
import { MeasuresToggle } from "~/components/blocks/indicators/measures-toggle"
import { HeatmapTable } from "~/components/blocks/indicators/table"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Separator } from "~/components/ui/separator"
import { getIndicatorsForFarm } from "~/integrations/bln3.server"
import { getSession } from "~/lib/auth.server"
import { computeFarmAggregation } from "~/lib/bln3"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
    OBI_INDICATOR_IDS,
    BBWP_INDICATOR_IDS,
    type IndicatorCategory,
} from "~/lib/indicators"
import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"
import { Input } from "~/components/ui/input"
import { cn } from "~/lib/utils"

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
            preloadedFields: fields,
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

        return {
            fields: fields.map((f) => ({
                b_id: f.b_id,
                b_name: f.b_name,
                b_bufferstrip: f.b_bufferstrip ?? false,
            })),
            fieldScores,
        }
    } catch (error) {
        const normalized = handleLoaderError(error)
        throw normalized ?? error
    }
}

export default function IndicatorsFarmIndex() {
    const { fields, fieldScores } = useLoaderData<typeof loader>()
    const { b_id_farm, calendar } = useParams()
    const basePath = `/farm/${b_id_farm}/${calendar}/indicators`

    const [activeCategories, setActiveCategories] = useState<IndicatorCategory[]>([])
    const [withMeasures, setWithMeasures] = useState(true)
    const [hideBufferstrips, setHideBufferstrips] = useState(true)
    const [fieldSearch, setFieldSearch] = useState("")
    const [isPending, startTransition] = useTransition()

    const showIndex = !withMeasures

    const handleToggleCategory = (cat: IndicatorCategory) => {
        startTransition(() => {
            setActiveCategories((prev) =>
                prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
            )
        })
    }

    const handleClearCategories = () => {
        startTransition(() => setActiveCategories([]))
    }

    const handleToggleMeasures = (checked: boolean) => {
        startTransition(() => setWithMeasures(checked))
    }

    const handleToggleBufferstrips = (checked: boolean) => {
        startTransition(() => setHideBufferstrips(!checked))
    }

    // Filter fields based on bufferstrip toggle and search text
    const filteredFields = useMemo(() => {
        let result = hideBufferstrips
            ? fields.filter((f) => !f.b_bufferstrip)
            : fields
        if (fieldSearch) {
            const q = fieldSearch.toLowerCase()
            result = result.filter((f) =>
                (f.b_name ?? f.b_id).toLowerCase().includes(q),
            )
        }
        return result
    }, [fields, hideBufferstrips, fieldSearch])
    const filteredFieldIds = useMemo(
        () => new Set(filteredFields.map((f) => f.b_id)),
        [filteredFields],
    )
    const filteredScores = useMemo(
        () => fieldScores.filter((s) => filteredFieldIds.has(s.b_id)),
        [fieldScores, filteredFieldIds],
    )

    // Compute aggregations client-side so they react to the bufferstrip filter
    const obiScore = useMemo(
        () => computeFarmAggregation(filteredScores, OBI_INDICATOR_IDS, "score"),
        [filteredScores],
    )
    const obiIndex = useMemo(
        () => computeFarmAggregation(filteredScores, OBI_INDICATOR_IDS, "index"),
        [filteredScores],
    )
    const bbwpScore = useMemo(
        () => computeFarmAggregation(filteredScores, BBWP_INDICATOR_IDS, "score"),
        [filteredScores],
    )
    const bbwpIndex = useMemo(
        () => computeFarmAggregation(filteredScores, BBWP_INDICATOR_IDS, "index"),
        [filteredScores],
    )

    return (
        <>
            <FarmTitle
                title="Indicatoren"
                description="BLN3 bodemkwaliteitsindicatoren voor alle percelen op dit bedrijf."
            />

            <div className="space-y-6 px-4 pb-16 sm:px-6 lg:px-8">
                {/* Aggregations section */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Scores
                        </h3>
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
                </section>

                <Separator />

                {/* Indicator table section */}
                <section className={cn("space-y-3 transition-opacity duration-150", isPending && "opacity-50 pointer-events-none")}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <CategoryFilter
                            activeCategories={activeCategories}
                            onToggle={handleToggleCategory}
                            onClearAll={handleClearCategories}
                        />
                        <div className="flex items-center gap-4">
                            <Input
                                placeholder="Zoek perceel…"
                                value={fieldSearch}
                                onChange={(e) => setFieldSearch(e.target.value)}
                                className="w-44 h-8 text-sm"
                            />
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="bufferstrip-toggle"
                                    checked={!hideBufferstrips}
                                    onCheckedChange={handleToggleBufferstrips}
                                />
                                <Label
                                    htmlFor="bufferstrip-toggle"
                                    className="text-sm cursor-pointer select-none"
                                >
                                    {hideBufferstrips
                                        ? "Zonder bufferstroken"
                                        : "Met bufferstroken"}
                                </Label>
                            </div>
                            <MeasuresToggle
                                withMeasures={withMeasures}
                                onToggle={handleToggleMeasures}
                            />
                        </div>
                    </div>
                    <HeatmapTable
                        fields={filteredFields.map((field) => ({
                            b_id: field.b_id,
                            b_name: field.b_name,
                        }))}
                        fieldScores={filteredScores}
                        activeCategories={activeCategories}
                        showIndex={showIndex}
                        basePath={basePath}
                    />
                </section>
            </div>
        </>
    )
}
