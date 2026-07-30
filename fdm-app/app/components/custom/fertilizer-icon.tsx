import { Circle, Diamond, Hexagon, Square, Triangle } from "lucide-react"
import {
  getFertilizerCategoryFromRvoCode,
  type FertilizerKind,
} from "~/components/blocks/fertilizer/utils"
import { getFertilizerKindColor } from "~/components/blocks/timeline/timeline-colors"

export function FertilizerIcon({
  p_type,
  p_type_rvo,
  className = "size-3 shrink-0",
  dimmed = false,
}: {
  p_type?: string | null
  /** RVO mestcode. Used to derive category if p_type is not provided. */
  p_type_rvo?: string | null
  className?: string
  /** Renders at reduced opacity, e.g. to signal partial rather than full applicability. */
  dimmed?: boolean
}) {
  const kind: FertilizerKind =
    (p_type as FertilizerKind) ??
    (p_type_rvo ? getFertilizerCategoryFromRvoCode(p_type_rvo) : "other")
  const color = getFertilizerKindColor(kind)
  const style = { fill: color, color, opacity: dimmed ? 0.5 : 1 }

  if (kind === "renure") return <Hexagon className={className} style={style} />
  if (kind === "manure") return <Square className={className} style={style} />
  if (kind === "mineral") return <Circle className={className} style={style} />
  if (kind === "compost") return <Triangle className={className} style={style} />
  return <Diamond className={className} style={style} />
}
