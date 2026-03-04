import { Circle, Diamond, Square, Triangle } from "lucide-react"
import React from "react"
import { NavLink } from "react-router"
import { Badge } from "~/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import type { FieldRow, RotationExtended } from "./columns"

type FertilizerDisplayProps = {
    cultivation: RotationExtended
}

const fertilizerIconClassMap = {
    manure: {
        text: "text-yellow-600",
        fill: {
            "600": "fill-yellow-600",
            "300": "fill-yellow-300",
        },
    },
    mineral: {
        text: "text-sky-600",
        fill: {
            "600": "fill-sky-600",
            "300": "fill-sky-300",
        },
    },
    compost: {
        text: "text-green-600",
        fill: {
            "600": "fill-green-600",
            "300": "fill-green-300",
        },
    },
    other: {
        text: "text-gray-600",
        fill: {
            "600": "fill-gray-600",
            "300": "fill-gray-300",
        },
    },
} as const

export const FertilizerDisplay: React.FC<FertilizerDisplayProps> = ({
    cultivation,
}) => {
    const resolvedFertilizers =
        cultivation.type === "field" ? cultivation.fertilizers : null
    const uniqueFertilizers = React.useMemo(() => {
        const fields = cultivation.fields
        const fertilizers =
            resolvedFertilizers ??
            (fields as FieldRow[]).flatMap((field) => field.fertilizers)
        return Array.from(new Map(fertilizers.map((f) => [f.p_id, f])).values())
    }, [resolvedFertilizers, cultivation.fields])

    const fertilizerDisplay = React.useMemo(() => {
        const fields = cultivation.fields
        const fieldIds =
            cultivation.type === "field"
                ? [cultivation.b_id]
                : cultivation.fields.map((field) => field.b_id)
        return (
            <div className="flex items-start flex-col space-y-2">
                {uniqueFertilizers.map((fertilizer) => {
                    const isFertilizerUsedOnAllFieldsForThisCultivation =
                        cultivation.type === "field" ||
                        (fields as FieldRow[]).every((field) =>
                            field.fertilizers.some(
                                (f) => f.p_id === fertilizer.p_id,
                            ),
                        )
                    const fertilizerIconFillShade =
                        isFertilizerUsedOnAllFieldsForThisCultivation
                            ? "600"
                            : "300"

                    const component = (
                        <NavLink
                            key={fertilizer.p_id}
                            to={`./modify_fertilizer/${fertilizer.p_id}?fieldIds=${fieldIds.map(encodeURIComponent).join(",")}`}
                        >
                            <Badge
                                variant="outline"
                                className="gap-1 text-muted-foreground"
                            >
                                <span>
                                    {fertilizer.p_type === "manure" ? (
                                        <Square
                                            className={`size-3 ${fertilizerIconClassMap.manure.text} ${fertilizerIconClassMap.manure.fill[fertilizerIconFillShade]}`}
                                        />
                                    ) : fertilizer.p_type === "mineral" ? (
                                        <Circle
                                            className={`size-3 ${fertilizerIconClassMap.mineral.text} ${fertilizerIconClassMap.mineral.fill[fertilizerIconFillShade]}`}
                                        />
                                    ) : fertilizer.p_type === "compost" ? (
                                        <Triangle
                                            className={`size-3 ${fertilizerIconClassMap.compost.text} ${fertilizerIconClassMap.compost.fill[fertilizerIconFillShade]}`}
                                        />
                                    ) : (
                                        <Diamond
                                            className={`size-3 ${fertilizerIconClassMap.other.text} ${fertilizerIconClassMap.other.fill[fertilizerIconFillShade]}`}
                                        />
                                    )}
                                </span>
                                {fertilizer.p_name_nl}
                            </Badge>
                        </NavLink>
                    )

                    return cultivation.type === "field" ? (
                        component
                    ) : (
                        <Tooltip key={fertilizer.p_id}>
                            <TooltipTrigger>{component}</TooltipTrigger>
                            <TooltipContent>
                                {isFertilizerUsedOnAllFieldsForThisCultivation
                                    ? "Deze meststof is toegepast op alle percelen met dit gewas"
                                    : "Deze meststof is op sommige percelen met dit gewas toegepast"}
                            </TooltipContent>
                        </Tooltip>
                    )
                })}
            </div>
        )
    }, [
        uniqueFertilizers,
        (cultivation as FieldRow).b_id,
        cultivation.type,
        cultivation.fields,
    ])

    return fertilizerDisplay
}
