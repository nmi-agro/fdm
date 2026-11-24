import { getMeasureCostLevel } from "~/lib/measure-labels"

/**
 * Shows the cost level of a measure (low, medium, high) as text. Renders nothing when the
 * costs are unknown.
 *
 * @param props.costs - `m_effect_costs` of the measure.
 * @param props.long - Use the long label ("Lage kosten") instead of the short one ("Kosten: laag").
 */
export function MeasureCostIndicator({
  costs,
  long = false,
  className,
}: {
  costs: number | null | undefined
  long?: boolean
  className?: string
}) {
  const level = getMeasureCostLevel(costs)
  if (!level) return null
  return (
    <span className={className}>{long ? level.long : `Kosten: ${level.label.toLowerCase()}`}</span>
  )
}
