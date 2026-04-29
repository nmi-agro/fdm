import type { Row } from "@tanstack/react-table"
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
    row: Row<RotationExtended>
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
    row,
}) => {
    const fertilizerDisplay = React.useMemo(() => {
        const fields =
            row.original.type === "field"
                ? [row.original]
                : (row.subRows ?? []).map(
                      (fieldRow) => fieldRow.original as FieldRow,
                  )
        const fertilizers = fields.flatMap((field) => field.fertilizers)
        const uniqueFertilizers = Array.from(
            new Map(fertilizers.map((f) => [f.p_id, f])).values(),
        )
        const fieldIds =
            row.original.type === "field"
                ? [row.original.b_id]
                : row.subRows.map(
                      (fieldRow) => (fieldRow.original as FieldRow).b_id,
                  )
        return (
            <div className="flex items-start flex-col space-y-2">
                {uniqueFertilizers.map((fertilizer) => {
                    const isFertilizerUsedOnAllFieldsForThisCultivation =
                        row.original.type === "field" ||
                        (row.subRows as Row<FieldRow>[]).every((fieldRow) =>
                            fieldRow.original.fertilizers.some(
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

                    return row.original.type === "field" ? (
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
    }, [row.original, row.subRows])

    return fertilizerDisplay
}
