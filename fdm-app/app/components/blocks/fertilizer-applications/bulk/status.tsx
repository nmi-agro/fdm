import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CircleCheck,
  CircleSlash,
  type LucideIcon,
  Sprout,
  TriangleAlert,
} from "lucide-react"
import { cn } from "~/lib/utils"
import type { FieldImpactStatus } from "./aggregate"
import { InfoTip } from "./info-tip"

/** Dutch labels for the field statuses. */
export const FIELD_STATUS_LABELS: Record<FieldImpactStatus, string> = {
  ok: "Op koers",
  under_advice: "Onder advies",
  over_advice: "Boven advies",
  over_target: "Boven streefwaarde",
  missing_soil_data: "Bodemdata ontbreekt",
  bufferstrip: "Bufferstrook",
  no_crop: "Geen gewas",
  no_advice: "Geen advies",
  no_balance: "Geen balans",
}

/** Why a status matters, shown in the tooltip of the status. */
export const FIELD_STATUS_DESCRIPTIONS: Record<FieldImpactStatus, string> = {
  ok: "De gift past bij het advies en de stikstofbalans blijft binnen de streefwaarde.",
  under_advice:
    "Minder dan het gewas nodig heeft. Dat geeft risico op een lagere opbrengst of kwaliteit.",
  over_advice: "Meer dan het gewas nodig heeft. Dit vergroot de verliezen naar het milieu.",
  over_target:
    "Het stikstofoverschot ligt boven de streefwaarde. Dat vergroot het risico op uitspoeling naar grond- en oppervlaktewater.",
  missing_soil_data: "Zonder bodemanalyse kunnen het advies en de balans niet worden berekend.",
  bufferstrip: "Op een bufferstrook mag niet worden bemest.",
  no_crop: "Zonder gewas is er geen advies.",
  no_advice: "Voor dit perceel kon geen advies worden berekend.",
  no_balance: "Voor dit perceel kon geen stikstofbalans worden berekend.",
}

const FIELD_STATUS_STYLE: Record<FieldImpactStatus, { icon: LucideIcon; className: string }> = {
  // On track is the normal case and stays neutral, so colour is left for points of attention
  ok: { icon: CircleCheck, className: "text-muted-foreground" },
  under_advice: { icon: ArrowDown, className: "text-orange-700 dark:text-orange-400" },
  over_advice: { icon: ArrowUp, className: "text-red-700 dark:text-red-400" },
  over_target: { icon: TriangleAlert, className: "text-red-700 dark:text-red-400" },
  missing_soil_data: { icon: AlertTriangle, className: "text-amber-700 dark:text-amber-400" },
  bufferstrip: { icon: CircleSlash, className: "text-muted-foreground" },
  no_crop: { icon: Sprout, className: "text-muted-foreground" },
  no_advice: { icon: AlertTriangle, className: "text-amber-700 dark:text-amber-400" },
  no_balance: { icon: AlertTriangle, className: "text-amber-700 dark:text-amber-400" },
}

/** Returns whether a status is a point of attention for the user. */
export function isDeviation(status: FieldImpactStatus) {
  return status !== "ok"
}

/**
 * A field status with an icon and text, so it never relies on colour alone. The tooltip explains
 * why the status matters, followed by any extra explanation for this field.
 *
 * @param detail - A short addition to the label, for example the nutrients concerned.
 * @param extra - Extra explanation for this field, for example why something could not be
 *   calculated.
 */
export function FieldStatusLabel({
  status,
  detail,
  extra,
}: {
  status: FieldImpactStatus
  detail?: string
  extra?: string
}) {
  const { icon: Icon, className } = FIELD_STATUS_STYLE[status]
  return (
    <InfoTip
      className="max-w-xs"
      content={
        <>
          <p>{FIELD_STATUS_DESCRIPTIONS[status]}</p>
          {extra && <p className="mt-1">{extra}</p>}
        </>
      }
    >
      <button
        type="button"
        className={cn(
          "inline-flex cursor-help items-center gap-1 rounded-sm py-1 text-xs font-medium whitespace-nowrap",
          className,
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {FIELD_STATUS_LABELS[status]}
        {detail && <span className="font-normal">({detail})</span>}
      </button>
    </InfoTip>
  )
}

export type ComparisonStatus = "under" | "on-target" | "over"

const COMPARISON_STYLE: Record<
  ComparisonStatus,
  { icon?: LucideIcon; label: string; className: string }
> = {
  under: { icon: ArrowDown, label: "Onder", className: "text-orange-700 dark:text-orange-400" },
  // Within the reference is the normal case: no icon and no colour, so deviations stand out
  "on-target": { label: "Binnen", className: "text-muted-foreground" },
  over: { icon: ArrowUp, label: "Boven", className: "text-red-700 dark:text-red-400" },
}

/**
 * The status of a value compared with its reference, as a small icon with the full text in a
 * tooltip; the colour of the bar already shows the status. Within the reference nothing is shown,
 * only the text for screen readers.
 *
 * @param noun - The reference, for example "advies" or "norm".
 */
export function ComparisonLabel({ status, noun }: { status: ComparisonStatus; noun: string }) {
  const { icon: Icon, label, className } = COMPARISON_STYLE[status]
  const text = `${label} ${noun}`
  if (!Icon) return <span className="sr-only">{text}</span>
  return (
    <InfoTip content={text}>
      <button
        type="button"
        aria-label={text}
        className={cn("-m-1 inline-flex shrink-0 rounded-sm p-1", className)}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </InfoTip>
  )
}

/** Formats a number with Dutch notation and no decimals. */
export function formatKg(value: number) {
  const rounded = Math.round(value)
  return (Object.is(rounded, -0) ? 0 : rounded).toLocaleString("nl-NL")
}
