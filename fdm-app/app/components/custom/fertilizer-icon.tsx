import { Circle, Diamond, Square, Triangle } from "lucide-react"
import { getFertilizerKindColor } from "~/components/blocks/timeline/timeline-colors"

export function FertilizerIcon({
  p_type,
  className = "size-3 shrink-0",
  dimmed = false,
}: {
  p_type: string
  className?: string
  /** Renders at reduced opacity, e.g. to signal partial rather than full applicability. */
  dimmed?: boolean
}) {
  const color = getFertilizerKindColor(p_type as "manure" | "mineral" | "compost" | null)
  const style = { fill: color, color, opacity: dimmed ? 0.5 : 1 }

  if (p_type === "manure") return <Square className={className} style={style} />
  if (p_type === "mineral") return <Circle className={className} style={style} />
  if (p_type === "compost") return <Triangle className={className} style={style} />
  return <Diamond className={className} style={style} />
}
