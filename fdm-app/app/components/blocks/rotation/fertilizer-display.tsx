import type { Row } from "@tanstack/react-table"
import React from "react"
import { NavLink } from "react-router"
import { FertilizerBadge } from "~/components/custom/fertilizer-badge"
import { getFertilizerCategoryFromRvoCode } from "~/components/blocks/fertilizer/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import type { FieldRow, RotationExtended } from "./columns"

type FertilizerDisplayProps = {
  row: Row<RotationExtended>
}

export const FertilizerDisplay: React.FC<FertilizerDisplayProps> = ({ row }) => {
  const fertilizerDisplay = React.useMemo(() => {
    const fields: FieldRow[] =
      row.original.type === "field"
        ? [row.original]
        : (row.subRows ?? [])
            .map((fieldRow) => fieldRow.original)
            .filter((fieldRow): fieldRow is FieldRow => fieldRow.type === "field")
    const fertilizers = fields.flatMap((field) => field.fertilizers)
    const uniqueFertilizers = Array.from(new Map(fertilizers.map((f) => [f.p_id, f])).values())
    const fieldIds = fields.map((field) => field.b_id)
    return (
      <div className="flex flex-col items-start space-y-2">
        {uniqueFertilizers.map((fertilizer) => {
          const isFertilizerUsedOnAllFieldsForThisCultivation =
            row.original.type === "field" ||
            fields.every((field) => field.fertilizers.some((f) => f.p_id === fertilizer.p_id))

          const component = (
            <NavLink
              key={fertilizer.p_id}
              to={`./modify_fertilizer/${fertilizer.p_id}?fieldIds=${fieldIds.map(encodeURIComponent).join(",")}`}
            >
              <FertilizerBadge
                variant="outline"
                showIcon
                dimmed={!isFertilizerUsedOnAllFieldsForThisCultivation}
                p_type={getFertilizerCategoryFromRvoCode(fertilizer.p_type_rvo)}
              >
                {fertilizer.p_name_nl}
              </FertilizerBadge>
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
