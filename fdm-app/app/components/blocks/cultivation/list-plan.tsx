import { NavLink } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { cn } from "~/lib/utils"

interface CultivationField {
    b_id: string
    b_name: string
    b_area: number
    b_bufferstrip: boolean
}

interface CultivationPlanItem {
    b_lu_catalogue: string
    b_lu_name: string
    b_area: number
    fields: CultivationField[]
}

interface CultivationListPlanProps {
    cultivationPlan: CultivationPlanItem[]
    b_id_farm: string
    calendar: string
    basePath: string
}

export function CultivationListPlan({
    cultivationPlan,
    b_id_farm,
    calendar,
    basePath,
}: CultivationListPlanProps) {
    const fieldsCultivationPlan = (
        cultivationPlan
            .map((cultivation) => {
                const fields = cultivation.fields
                if (fields.length === 0) {
                    return null
                }

                const totalArea = fields.reduce(
                    (sum, field) => sum + field.b_area,
                    0,
                )

                return {
                    ...cultivation,
                    fields: fields,
                    b_area: totalArea,
                }
            })
            .filter(Boolean) as CultivationPlanItem[]
    ).sort((a, b) => b.b_area - a.b_area)

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <p>Gewassen in bouwplan</p>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-2">
                    {fieldsCultivationPlan.map((cultivation) => {
                        const numberOfFields = cultivation.fields.length
                        const totalArea = cultivation.b_area
                        const nameOfFields = cultivation.fields
                            .map((field) => field.b_name)
                            .join(", ")

                        return (
                            <NavLink
                                key={cultivation.b_lu_catalogue}
                                to={`/farm/create/${b_id_farm}/${calendar}/${basePath}/${cultivation.b_lu_catalogue}`}
                                className={({ isActive }) =>
                                    cn(
                                        "flex justify-between items-center p-3 rounded-md hover:bg-accent hover:text-accent-foreground",
                                        isActive &&
                                            "bg-accent text-accent-foreground",
                                    )
                                }
                            >
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none break-all">
                                        {cultivation.b_lu_name}
                                    </p>
                                    <p className="text-xs font-normal text-muted-foreground">
                                        {nameOfFields}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                        {numberOfFields === 1
                                            ? "1 perceel"
                                            : `${numberOfFields} percelen`}
                                    </Badge>
                                    <Badge variant="outline">
                                        {totalArea < 0.1
                                            ? "< 0.1 ha"
                                            : `${Math.round(totalArea * 10) / 10} ha`}
                                    </Badge>
                                </div>
                            </NavLink>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
