import type { Harvest, HarvestParameters } from "@nmi-agro/fdm-core"
import { NavLink } from "react-router"
import { cn } from "@/app/lib/utils"
import { HarvestsList } from "~/components/blocks/harvest/list"
import type { HarvestableType } from "~/components/blocks/harvest/types"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export function CultivationHarvestsCard({
    harvests,
    b_lu_harvestable,
    harvestParameters,
    editable = true,
}: {
    harvests: Harvest[]
    b_lu_harvestable: HarvestableType
    harvestParameters: HarvestParameters
    editable?: boolean
}) {
    let canAddHarvest = false
    if (b_lu_harvestable === "once" && harvests.length === 0) {
        canAddHarvest = true
    }
    if (b_lu_harvestable === "multiple") {
        canAddHarvest = true
    }
    canAddHarvest &&= editable

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-semibold tracking-tight text-gray-900">
                    {b_lu_harvestable === "multiple" ? "Oogsten" : "Oogst"}
                </CardTitle>
                <div className="flex justify-between">
                    <Button
                        asChild
                        variant="default"
                        className={cn(!canAddHarvest ? "hidden" : "")}
                    >
                        <NavLink
                            to="./harvest/new"
                            onClick={(e) => {
                                if (!canAddHarvest) {
                                    e.preventDefault()
                                }
                            }}
                            className={
                                !canAddHarvest ? "cursor-not-allowed" : ""
                            }
                        >
                            Oogst toevoegen
                        </NavLink>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <HarvestsList
                    harvests={harvests}
                    b_lu_harvestable={b_lu_harvestable}
                    harvestParameters={harvestParameters}
                />
            </CardContent>
        </Card>
    )
}
