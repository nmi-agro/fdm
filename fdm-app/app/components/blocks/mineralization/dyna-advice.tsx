import { CalendarCheck, Leaf } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import type { DynaFertilizerAdvice } from "~/integrations/mineralization.server"

interface DynaAdviceCardProps {
    fertilizingRecommendations: DynaFertilizerAdvice | null
    harvestingRecommendation: { b_date_harvest: string } | null
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
    })
}

export function DynaAdviceCard({
    fertilizingRecommendations,
    harvestingRecommendation,
}: DynaAdviceCardProps) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Advies</CardTitle>
                <CardDescription>
                    Bemesting- en oogstadvies op basis van DYNA
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Fertilizer advice */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                        Bemestingsadvies
                    </div>
                    {fertilizingRecommendations ? (
                        <dl className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">
                                    Aanbevolen gift
                                </dt>
                                <dd className="font-semibold tabular-nums">
                                    {fertilizingRecommendations.b_n_recommended.toFixed(
                                        1,
                                    )}{" "}
                                    kg N/ha
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">
                                    Aanbevolen datum
                                </dt>
                                <dd className="tabular-nums">
                                    {formatDate(
                                        fertilizingRecommendations.b_date_recommended,
                                    )}
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">
                                    Resterende ruimte
                                </dt>
                                <dd className="tabular-nums">
                                    {fertilizingRecommendations.b_n_remaining.toFixed(
                                        1,
                                    )}{" "}
                                    kg N/ha
                                </dd>
                            </div>
                        </dl>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Geen bemestingsadvies beschikbaar.
                        </p>
                    )}
                </div>

                <Separator />

                {/* Harvest advice */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Leaf className="h-4 w-4 text-muted-foreground" />
                        Oogstadvies
                    </div>
                    {harvestingRecommendation ? (
                        <dl className="text-sm">
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">
                                    Aanbevolen oogstdatum
                                </dt>
                                <dd className="tabular-nums">
                                    {formatDate(
                                        harvestingRecommendation.b_date_harvest,
                                    )}
                                </dd>
                            </div>
                        </dl>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Geen oogstadvies beschikbaar.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
