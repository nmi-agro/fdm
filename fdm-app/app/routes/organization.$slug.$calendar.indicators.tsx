import { getFarms, getFields } from "@nmi-agro/fdm-core"
import { Map as MapIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import {
    data,
    type MetaFunction,
    NavLink,
    useLoaderData,
    useParams,
} from "react-router"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { AggregationPainpoints } from "~/components/blocks/indicators/aggregation-painpoints"
import { AggregationTree } from "~/components/blocks/indicators/aggregation-tree"
import { Bln3BetaBanner } from "~/components/blocks/indicators/bln3-beta-banner"
import { Bln3HelpDialog } from "~/components/blocks/indicators/bln3-help-dialog"
import { CategoryFilter } from "~/components/blocks/indicators/category-filter"
import { MeasuresToggle } from "~/components/blocks/indicators/measures-toggle"
import { HeatmapTable } from "~/components/blocks/indicators/table"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import {
    type Bln3Score,
    type FieldBln3Score,
    getIndicatorsForFarm,
} from "~/integrations/bln3.server"
import {
    AGG_IDS,
    type AggregationId,
    computeAreaWeightedAggregation,
    getFieldAggregationScore,
} from "~/lib/aggregations"
import { auth } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { type Ecosysteemdienst, INDICATORS } from "~/lib/indicators"
import { cn } from "~/lib/utils"
import type { Route } from "./+types/organization.$slug.$calendar.indicators"

export const meta: MetaFunction = () => {
    return [
        {
            title: `Indicatoren | Organisatieoverzicht | ${clientConfig.name}`,
        },
        {
            name: "description",
            content:
                "Organisatieoverzicht BLN3 bodemkwaliteitsindicatoren per bedrijf.",
        },
    ]
}

/** Minimum indicator scores for a single farm (across all its fields). */
export type FarmMinIndicatorScore = {
    minScore: number
    minIndex: number
}

export type FarmScoreUpdate = { b_id_farm: string; farmScore: FieldBln3Score }

/**
 * Computes the minimum score (per indicator and aggregation) across all fields
 * in a farm, keeping both `score01` and `index01` for table display.
 */
export function computeFarmMinScores(fieldScores: FieldBln3Score[]): Bln3Score {
    const aggregations: Record<string, number> = {}
    const indicators: Record<string, FarmMinIndicatorScore> = {}

    for (const fs of fieldScores) {
        if (fs.error || !fs.score) continue

        // Aggregation scores (0–1 scale)
        for (const aggId of AGG_IDS) {
            const scoreVal = getFieldAggregationScore(fs.score, aggId)
            if (scoreVal !== null) {
                aggregations[aggId] =
                    aggregations[aggId] === undefined
                        ? scoreVal
                        : Math.min(aggregations[aggId] as number, scoreVal)
            }
        }

        // Individual indicator scores — keep score01 + index01 for the pair
        // with the minimum score
        for (const ind of fs.score.indicators) {
            if (ind.score == null || Number.isNaN(ind.score)) continue
            const existing = indicators[ind.indicator_id]
            if (existing === undefined || ind.score < existing.minScore) {
                indicators[ind.indicator_id] = {
                    minScore: ind.score,
                    minIndex: ind.index ?? ind.score,
                }
            }
        }
    }

    return {
        aggregations: Object.entries(aggregations).map(
            ([aggregation_id, score]) => ({ aggregation_id, score }),
        ),
        indicators: Object.entries(indicators).map(
            ([indicator_id, { minScore, minIndex }]) => ({
                indicator_id,
                score: minScore,
                index: minIndex,
                status: 0,
                target: 0,
                impact: 0,
            }),
        ),
    }
}

export async function loader({ request, params }: Route.LoaderArgs) {
    try {
        const timeframe = getTimeframe(params)

        const organizations = await auth.api.listOrganizations({
            headers: request.headers,
        })
        const organization = organizations.find(
            (org) => org.slug === params.slug,
        )

        if (!organization) {
            throw data("Organisatie niet gevonden.", {
                status: 404,
                statusText: "Organisatie niet gevonden.",
            })
        }

        const farms = await getFarms(fdm, organization.id)

        // Sequential score promises: farm i+1 starts only after farm i finishes
        const farmScoreStreams: Array<Promise<FieldBln3Score>> = []
        let lastPromise: Promise<void> = Promise.resolve()
        for (const farm of farms) {
            const { b_id_farm } = farm
            const scorePromise: Promise<FieldBln3Score> = lastPromise.then(
                async () => {
                    const fieldScores = await getIndicatorsForFarm({
                        principal_id: organization.id,
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
                    const minScores = computeFarmMinScores(fieldScores)

                    return {
                        b_id: b_id_farm,
                        score: minScores,
                        error: null,
                    }
                },
            )
            farmScoreStreams.push(scorePromise)
            lastPromise = scorePromise.then(() => undefined)
        }

        // Now do the synchronous fetches
        const farmsExtended = await Promise.all(
            farms.map(async (farm) => {
                const fields = await getFields(
                    fdm,
                    organization.id,
                    farm.b_id_farm,
                )
                return {
                    b_id: farm.b_id_farm,
                    b_name: farm.b_name_farm,
                    b_area: await fields.reduce(
                        (total, field) => total + (field.b_area ?? 0),
                        0,
                    ),
                }
            }),
        )

        return {
            organization,
            farms: farmsExtended,
            farmScoreStreams,
        }
    } catch (error) {
        const normalized = handleLoaderError(error)
        throw normalized ?? error
    }
}

export default function IndicatorsFarmIndex() {
    const { farms, farmScoreStreams } = useLoaderData<typeof loader>()
    const { b_id_farm, calendar } = useParams()

    const [activeCategories, setActiveCategories] = useState<
        Ecosysteemdienst[]
    >([])
    const [withMeasures, setWithMeasures] = useState(true)
    const [fieldSearch, setFieldSearch] = useState("")
    const [isPending, startTransition] = useTransition()
    const [fieldScores, setFieldScores] = useState<FieldBln3Score[]>([])

    useEffect(() => {
        let active = true
        setFieldScores([])
        for (const stream of farmScoreStreams) {
            stream.then((scores) => {
                if (active) {
                    setFieldScores((current) => {
                        if (active) {
                            return [...current, scores]
                        }
                        return current
                    })
                }
            })
        }
        return () => {
            active = false
        }
    }, [farmScoreStreams])

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

    // Filter fields based on bufferstrip toggle and search text
    const filteredFields = useMemo(() => {
        let result = farms
        if (fieldSearch) {
            const q = fieldSearch.toLowerCase()
            result = result.filter((f) =>
                (f.b_name ?? f.b_id).toLowerCase().includes(q),
            )
        }
        return result
    }, [farms, fieldSearch])
    const filteredFieldIds = useMemo(
        () => new Set(filteredFields.map((f) => f.b_id)),
        [filteredFields],
    )
    const filteredScores = useMemo(
        () => fieldScores.filter((s) => filteredFieldIds.has(s.b_id)),
        [fieldScores, filteredFieldIds],
    )

    const scoreOf = (aggId: AggregationId) => {
        return computeAreaWeightedAggregation(
            filteredScores,
            filteredFields,
            aggId,
        )
    }

    const indicatorScoreOf = (indId: string) => {
        let totalScore = 0
        let totalWeight = 0
        for (const s of filteredScores) {
            const scoreVal = s.score?.indicators.find(
                (i) => i.indicator_id === indId,
            )?.score
            if (
                scoreVal !== undefined &&
                scoreVal !== null &&
                !Number.isNaN(scoreVal)
            ) {
                const field = filteredFields.find((f) => f.b_id === s.b_id)
                const weight = field?.b_area ?? 0
                if (weight > 0) {
                    totalScore += scoreVal * weight
                    totalWeight += weight
                }
            }
        }
        return totalWeight > 0 ? totalScore / totalWeight : null
    }

    const basePathFormatter = useCallback(
        (b_id: string) => `/farm/${b_id}/${calendar}/indicators`,
        [calendar],
    )

    return (
        <main className="min-w-0">
            <FarmTitle
                title="Indicatoren"
                description="BLN3 bodemkwaliteitsindicatoren voor alle bedrijven met toegang door deze organisatie."
                rightNode={
                    <div className="flex items-center gap-2">
                        <Bln3BetaBanner />
                        <Bln3HelpDialog />
                    </div>
                }
            />

            <div className="space-y-6 px-4 pb-16 sm:px-6 lg:px-8">
                {/* Aggregations hierarchy tree */}
                <section className="space-y-3">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                        <Card className="shadow-sm border-border">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-bold">
                                        Gemiddelde score van de organisatie
                                    </CardTitle>
                                    <Button
                                        asChild
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs gap-1.5"
                                    >
                                        <NavLink
                                            to={`/farm/${b_id_farm}/${calendar}/atlas/indicators`}
                                        >
                                            <MapIcon className="h-3.5 w-3.5" />
                                            Kaartweergave
                                        </NavLink>
                                    </Button>
                                </div>
                                {/* <CardDescription className="text-xs">
                                    Hieronder ziet u de officiële BLN-bodemkwaliteitshiërarchie. De scores zijn berekend als 
                                    <strong> gewogen gemiddelden op basis van bedrijfsoppervlakte</strong>. Klik op de knoppen om verder in te zoomen op branches en onderliggende indicatoren.
                                </CardDescription> */}
                            </CardHeader>
                            <CardContent>
                                <AggregationTree
                                    domain="organization"
                                    scoreOf={scoreOf}
                                    indicatorScoreOf={indicatorScoreOf}
                                    fields={filteredFields}
                                    fieldScores={filteredScores}
                                    basePathFormatter={basePathFormatter}
                                />
                            </CardContent>
                        </Card>
                        <div>
                            <AggregationPainpoints
                                domain="organization"
                                fields={filteredFields}
                                fieldScores={filteredScores}
                                basePathFormatter={basePathFormatter}
                            />
                        </div>
                    </div>
                </section>

                <Separator />

                {/* Indicator table section */}
                <Card
                    className={cn(
                        "transition-opacity duration-150 bg-muted/10",
                        showPending && "opacity-50 pointer-events-none",
                    )}
                >
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-bold">
                            Detailweergave per bedrijf
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Alle {INDICATORS.length} indicatoren voor alle
                            bedrijven, met filters en zoekmogelijkheden.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <CategoryFilter
                                activeCategories={activeCategories}
                                onToggle={handleToggleCategory}
                                onClearAll={handleClearCategories}
                            />
                            <div className="flex items-center gap-4 flex-wrap">
                                <Input
                                    placeholder="Zoek perceel…"
                                    value={fieldSearch}
                                    onChange={(e) =>
                                        setFieldSearch(e.target.value)
                                    }
                                    className="w-44 h-8 text-sm"
                                />
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
                            basePathFormatter={basePathFormatter}
                        />
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
