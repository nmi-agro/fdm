import { getFields } from "@nmi-agro/fdm-core"
import { useEffect, useMemo, useState, useTransition } from "react"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
    useParams,
} from "react-router"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { AggregationTree } from "~/components/blocks/indicators/aggregation-tree"
import { AggregationPainpoints } from "~/components/blocks/indicators/aggregation-painpoints"
import { Bln3BetaBanner } from "~/components/blocks/indicators/bln3-beta-banner"
import { Bln3HelpDialog } from "~/components/blocks/indicators/bln3-help-dialog"
import { CategoryFilter } from "~/components/blocks/indicators/category-filter"
import { MeasuresToggle } from "~/components/blocks/indicators/measures-toggle"
import { HeatmapTable } from "~/components/blocks/indicators/table"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { Switch } from "~/components/ui/switch"
import { getIndicatorsForFarm } from "~/integrations/bln3.server"
import { getSession } from "~/lib/auth.server"
import { computeAreaWeightedAggregation, type AggregationId } from "~/lib/aggregations"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
    type Ecosysteemdienst,
} from "~/lib/indicators"
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
                b_area: f.b_area ?? null,
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

    const [activeCategories, setActiveCategories] = useState<
        Ecosysteemdienst[]
    >([])
    const [showHeatmap, setShowHeatmap] = useState(false)
    const [withMeasures, setWithMeasures] = useState(true)
    const [hideBufferstrips, setHideBufferstrips] = useState(true)
    const [fieldSearch, setFieldSearch] = useState("")
    const [isPending, startTransition] = useTransition()

    // Debounce the pending indicator to avoid flickering on fast transitions
    const [showPending, setShowPending] = useState(false)
    useEffect(() => {
        if (!isPending) {
            setShowPending(false)
            return
        }
        const id = setTimeout(() => setShowPending(true), 150)
        return () => clearTimeout(id)
    }, [isPending])

    const showIndex = !withMeasures

    const handleToggleCategory = (dienst: Ecosysteemdienst) => {
        startTransition(() => {
            setActiveCategories((prev) =>
                prev.includes(dienst)
                    ? prev.filter((c) => c !== dienst)
                    : [...prev, dienst],
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

    const scoreOf = (aggId: AggregationId) => {
        return computeAreaWeightedAggregation(filteredScores, filteredFields, aggId)
    }

    const indicatorScoreOf = (indId: string) => {
        const vals = filteredScores
            .map((s) => s.score?.indicators.find((i) => i.indicator_id === indId)?.score)
            .filter((v): v is number => v !== undefined && v !== null && !Number.isNaN(v))
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }

    return (
        <>
            <FarmTitle
                title="Indicatoren"
                description="BLN3 bodemkwaliteitsindicatoren voor alle percelen op dit bedrijf."
            />

            <div className="space-y-6 px-4 pb-16 sm:px-6 lg:px-8">
                <Bln3BetaBanner />

                {/* Aggregations hierarchy tree */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Bodemkwaliteit Aggregaties (Bedrijfsgemiddelde)
                        </h3>
                        <Bln3HelpDialog />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <div className="lg:col-span-7 bg-card p-4 rounded-xl border shadow-sm space-y-4">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Hieronder ziet u de officiële BLN-bodemkwaliteitshiërarchie. De scores zijn berekend als 
                                <strong> gewogen gemiddelden op basis van perceeloppervlakte</strong>. Klik op de pijltjes om verder in te zoomen op branches en onderliggende indicatoren.
                            </p>
                            <AggregationTree scoreOf={scoreOf} indicatorScoreOf={indicatorScoreOf} />
                        </div>
                        <div className="lg:col-span-5">
                            <AggregationPainpoints
                                fields={filteredFields}
                                fieldScores={filteredScores}
                                basePath={basePath}
                            />
                        </div>
                    </div>
                </section>

                <Separator />

                {/* Collapsible Indicator table section */}
                <div className="flex justify-center py-2">
                    <button
                        type="button"
                        onClick={() => setShowHeatmap((prev) => !prev)}
                        className="inline-flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all cursor-pointer"
                    >
                        {showHeatmap ? "Verberg detailweergave per perceel" : "Toon detailweergave per perceel (28 indicatoren x percelen)"}
                    </button>
                </div>

                {showHeatmap && (
                    <section
                        className={cn(
                            "space-y-3 transition-opacity duration-150 border rounded-xl p-4 bg-muted/10",
                            showPending && "opacity-50 pointer-events-none",
                        )}
                    >
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
                )}
            </div>
        </>
    )
}
