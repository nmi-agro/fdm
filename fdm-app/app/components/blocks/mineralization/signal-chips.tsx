import {
  CalendarX2,
  CircleAlert,
  CloudRain,
  Droplets,
  type LucideIcon,
  Scissors,
  Sprout,
  TrendingDown,
} from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { type AttentionItem, describeAttentionItem } from "~/lib/mineralization"
import { cn } from "~/lib/utils"

function getIcon(item: AttentionItem): LucideIcon {
  if (item.kind === "missing_harvest") return CalendarX2
  if (item.kind === "error") return CircleAlert
  if (item.kind === "harvest_gap") return Scissors
  switch (item.signal.type) {
    case "n_shortage":
      return TrendingDown
    case "rain_near_event":
      return CloudRain
    case "high_leaching":
      return Droplets
    case "residual_n":
      return Sprout
  }
}

/**
 * Shows the signals of a field as labelled chips; the icon and text carry the meaning, not color.
 */
export function SignalChips({ items, className }: { items: AttentionItem[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Signalen">
      {items.map((item) => {
        const Icon = getIcon(item)
        const label = describeAttentionItem(item)
        const urgent = item.kind === "missing_harvest" || item.kind === "error"
        return (
          <li key={label}>
            <Badge
              variant="outline"
              className={cn(
                "gap-1 font-normal",
                // red-700 instead of the destructive token: small text needs 4.5:1 contrast
                urgent && "border-red-700/30 text-red-700 dark:border-red-400/40 dark:text-red-400",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {label}
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}
