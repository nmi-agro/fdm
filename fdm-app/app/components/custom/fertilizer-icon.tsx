import { Circle, Diamond, Hexagon, Square, Triangle } from "lucide-react"
import { isRenureRvoCode } from "~/components/blocks/fertilizer/utils"
import { getFertilizerKindColor } from "~/components/blocks/timeline/timeline-colors"

export function FertilizerIcon({
  p_type,
  p_type_rvo,
  className = "size-3 shrink-0",
  dimmed = false,
}: {
  p_type: string
  /** RVO mestcode. When it identifies a Renure product (codes 130-134), a purple hexagon is shown instead of the regular type icon. */
  p_type_rvo?: string | null
  className?: string
  /** Renders at reduced opacity, e.g. to signal partial rather than full applicability. */
  dimmed?: boolean
}) {
  const isRenure = isRenureRvoCode(p_type_rvo)
  const color = getFertilizerKindColor(
    isRenure ? "renure" : (p_type as "manure" | "mineral" | "compost" | null),
  )
  const style = { fill: color, color, opacity: dimmed ? 0.5 : 1 }

  if (isRenure) return <Hexagon className={className} style={style} />
  if (p_type === "manure") return <Square className={className} style={style} />
  if (p_type === "mineral") return <Circle className={className} style={style} />
  if (p_type === "compost") return <Triangle className={className} style={style} />
  return <Diamond className={className} style={style} />
}
