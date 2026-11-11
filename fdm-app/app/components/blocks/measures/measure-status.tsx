import { cn } from "cn"

export type MeasureStatus = "applied" | "recommended" | "applicable"

/** Label and dot colour per status; the colours match the score tiers of the indicators. */
const STATUS_STYLES: Record<MeasureStatus, { label: string; dot: string }> = {
  applied: { label: "Toegepast", dot: "bg-emerald-500" },
  recommended: { label: "Aanbevolen", dot: "bg-amber-500" },
  applicable: { label: "Toepasbaar", dot: "bg-muted-foreground/40" },
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
 * Shows the status of a measure as a coloured dot with its label, optionally with the number
 * of fields, e.g. "● Toegepast op 3 percelen" with the number of fields in muted text. The dot
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
  const suffix = count === undefined ? "" : count === 1 ? " op 1 perceel" : ` op ${count} percelen`
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} aria-hidden="true" />
      {style.label}
      {suffix && <span className="text-muted-foreground">{suffix}</span>}
    </span>
  )
}
