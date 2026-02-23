import type { Harvest, HarvestParameters } from "@nmi-agro/fdm-core"
import { format } from "date-fns/format"
import { nl } from "date-fns/locale"
import { ArrowRight, Calendar } from "lucide-react"
import { NavLink } from "react-router"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "~/components/ui/empty"
import { Label } from "~/components/ui/label"
import { getHarvestParameterLabel } from "./parameters"
import type { HarvestableType } from "./types"

export function HarvestsList({
    harvests,
    b_lu_harvestable,
    harvestParameters,
}: {
    harvests: Harvest[]
    b_lu_harvestable: HarvestableType
    harvestParameters: HarvestParameters
}) {
    const canAddHarvest =
        b_lu_harvestable === "multiple" ||
        (b_lu_harvestable === "once" && harvests.length === 0)

    const renderHarvestDetails = (harvest: Harvest) => (
        <div className="grid grid-cols-2 gap-4 pt-4">
            {harvestParameters.map((param: HarvestParameters[number]) => (
                <div key={param}>
                    <Label className="text-xs text-muted-foreground">
                        {getHarvestParameterLabel(param)}
                    </Label>
                    <p className="text-sm font-medium leading-none">
                        {harvest.harvestable?.harvestable_analyses?.[0]?.[
                            param
                        ] ?? "–"}
                    </p>
                </div>
            ))}
        </div>
    )

    const renderHarvestSummary = (harvest: Harvest) => (
        <div className="flex items-center justify-between">
            <div className="flex items-center">
                <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="text-md font-medium">
                    {format(harvest.b_lu_harvest_date, "PPP", {
                        locale: nl,
                    })}
                </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
    )

    if (harvests && harvests.length > 0) {
        if (b_lu_harvestable === "once") {
            const harvest = harvests[0]
            return (
                <NavLink
                    key={harvest.b_id_harvesting}
                    to={`./harvest/${harvest.b_id_harvesting}`}
                    className="block rounded-lg"
                >
                    <Card className="transition-all hover:bg-muted/50">
                        <CardHeader>{renderHarvestSummary(harvest)}</CardHeader>
                        <CardContent>
                            {renderHarvestDetails(harvest)}
                        </CardContent>
                    </Card>
                </NavLink>
            )
        }
        return (
            <div className="space-y-3">
                {harvests.map((harvest) => {
                    const analyses =
                        harvest.harvestable?.harvestable_analyses?.[0]
                    const summaryParams: { label: string; value: any }[] = []
                    if (analyses) {
                        for (const param of harvestParameters) {
                            const value = analyses[param]
                            if (value !== null && value !== undefined) {
                                summaryParams.push({
                                    label: getHarvestParameterLabel(param),
                                    value: value,
                                })
                            }
                            if (summaryParams.length >= 2) {
                                break
                            }
                        }
                    }

                    return (
                        <NavLink
                            key={harvest.b_id_harvesting}
                            to={`./harvest/${harvest.b_id_harvesting}`}
                            className="block rounded-lg"
                        >
                            <Card className="transition-all hover:bg-muted/50">
                                <CardHeader>
                                    {renderHarvestSummary(harvest)}
                                </CardHeader>
                                {summaryParams.length > 0 && (
                                    <CardContent className="pt-0">
                                        <div className="flex items-center space-x-6">
                                            {summaryParams.map((p) => (
                                                <div key={p.label}>
                                                    <p className="text-xs text-muted-foreground">
                                                        {p.label}
                                                    </p>
                                                    <p className="text-sm font-semibold">
                                                        {p.value}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        </NavLink>
                    )
                })}
            </div>
        )
    }

    if (canAddHarvest) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>Nog geen oogst</EmptyTitle>
                    <EmptyDescription>
                        Voeg een oogst toe om belangrijke gegevens zoals
                        opbrengst, datum en gehaltes bij te houden.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        )
    }

    return (
        <Empty>
            <EmptyHeader>
                <EmptyTitle>Dit gewas is niet oogstbaar</EmptyTitle>
                <EmptyDescription>
                    Kies een einddatum om aan te geven wanneer dit gewas is
                    beëindigd.
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    )
}
