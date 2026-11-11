import { cn } from "cn"
import { Check, Circle, type LucideIcon, Sparkles } from "lucide-react"

export type MeasureStatus = "applied" | "recommended" | "applicable"

/**
 * Label and icon per status. Each status has its own shape, so the meaning does not depend on
 * colour: a check for a recorded fact, sparkles for a recommendation (the same mark and green
 * as the "Aanbevolen maatregelen" on the measures page) and an open ring for a measure that
 * could be taken.
 */
const STATUS_STYLES: Record<MeasureStatus, { label: string; icon: LucideIcon; iconClass: string }> =
  {
    applied: { label: "Toegepast", icon: Check, iconClass: "text-foreground" },
    recommended: {
      label: "Aanbevolen",
      icon: Sparkles,
      iconClass: "text-emerald-700 dark:text-emerald-400",
    },
    applicable: { label: "Toepasbaar", icon: Circle, iconClass: "text-muted-foreground" },
  }

/**
 * Returns the Dutch label of a measure status.
 *
 * @param status - Status of a measure on a field.
 */
export function getMeasureStatusLabel(status: MeasureStatus): string {
  return STATUS_STYLES[status].label
}

/**
 * Shows the status of a measure as an icon with its label, optionally with the number of
 * fields, e.g. "✓ Toegepast op 3 percelen" with the number of fields in muted text. The icon
 * is never the only signal: the label always carries the meaning.
 *
 * @param props.status - Status of the measure.
 * @param props.count - Number of fields with this status; omitted for a single field.
 */
export function MeasureStatusLabel({
  status,
  count,
  className,
}: {
  status: MeasureStatus
  count?: number
  className?: string
}) {
  const style = STATUS_STYLES[status]
  const Icon = style.icon
  const suffix = count === undefined ? "" : count === 1 ? " op 1 perceel" : ` op ${count} percelen`
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", style.iconClass)} aria-hidden="true" />
      <span>{style.label}</span>
      {suffix && <span className="text-muted-foreground">{suffix}</span>}
    </span>
  )
}
