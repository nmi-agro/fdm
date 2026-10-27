import { AlertTriangle } from "lucide-react"
import { Alert } from "~/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { isCultivationUnavailableInPeriod } from "~/lib/cultivation-availability"
import { cn } from "~/lib/utils"

/** Result of {@link isCultivationUnavailableInPeriod}: `null` when there is nothing to warn about. */
export type CultivationAvailabilityResult = ReturnType<typeof isCultivationUnavailableInPeriod>

export type CultivationAvailabilityProps = {
  /** Class names for the outermost element. */
  className?: string
} & (
  | {
      /** Precomputed result, e.g. from a loader. `null` means no warning. */
      result: CultivationAvailabilityResult
      period?: never
      b_lu_ya?: never
      lastCultivationAvailabilityYear?: never
    }
  | {
      result?: undefined
      /** Start and end date of the cultivation. */
      period: { b_lu_start?: Date | string | null; b_lu_end?: Date | string | null }
      /** Years in which the RVO crop code is available, `null` when unknown. */
      b_lu_ya: number[] | null | undefined
      /** Last year that is checked for cultivations without an end date. */
      lastCultivationAvailabilityYear: number | undefined
    }
)

/**
 * Builds the warning text for an availability result.
 *
 * @param result - A non-null result of {@link isCultivationUnavailableInPeriod}.
 * @returns The message naming the first unavailable year, or a generic message when no year is known.
 */
export function getCultivationAvailabilityMessage(
  result: NonNullable<CultivationAvailabilityResult>,
): string {
  if (typeof result.first_unavailable_in !== "number") {
    return "Deze gewascode is niet beschikbaar voor het huidig geselecteerde jaar."
  }

  if (typeof result.last_unavailable_in !== "number") {
    return `Deze gewascode is niet beschikbaar na ${result.first_unavailable_in - 1}.`
  }

  if (result.first_unavailable_in === result.last_unavailable_in) {
    return `Deze gewascode is niet beschikbaar in ${result.first_unavailable_in}.`
  }

  return `Deze gewascode is niet beschikbaar tussen ${result.first_unavailable_in}-${result.last_unavailable_in}.`
}

function resolveResult(props: CultivationAvailabilityProps): CultivationAvailabilityResult {
  if (props.result !== undefined) {
    return props.result
  }
  return isCultivationUnavailableInPeriod(
    props.period,
    props.b_lu_ya,
    props.lastCultivationAvailabilityYear,
  )
}

/**
 * Shows an alert when the RVO crop code of a cultivation is not available in (part of) its period.
 *
 * Renders nothing when the crop code is available or availability cannot be determined.
 */
export function CultivationAvailabilityWarning(props: CultivationAvailabilityProps) {
  const result = resolveResult(props)
  if (!result) {
    return null
  }
  return (
    <Alert className={cn("border-amber-200 bg-amber-50 text-amber-700", props.className)}>
      <AlertTriangle className="size-4 stroke-amber-700" />
      <p>{getCultivationAvailabilityMessage(result)}</p>
    </Alert>
  )
}

/**
 * Compact warning triangle with a tooltip, meant for cultivation badges in tables.
 *
 * Renders nothing when the crop code is available or availability cannot be determined.
 */
export function CultivationAvailabilityWarningIcon(props: CultivationAvailabilityProps) {
  const result = resolveResult(props)
  if (!result) {
    return null
  }
  const message = getCultivationAvailabilityMessage(result)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex", props.className)} role="img" aria-label={message}>
            <AlertTriangle className="size-3.5" aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent>{message}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
