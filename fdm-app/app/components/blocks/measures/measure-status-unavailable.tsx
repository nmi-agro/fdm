import { AlertTriangle, RefreshCw } from "lucide-react"
import { useRevalidator } from "react-router"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"

/** Which parts of the measure status of a farm could be loaded. */
export type MeasureStatusAvailability = {
  /** `false` when the recommendations could not be loaded */
  recommendationsAvailable: boolean
  /** `false` when the applicability could not be loaded for one or more fields */
  applicabilityAvailable: boolean
  /** Number of fields that BLN3 scores */
  eligibleFieldCount: number
  /** Number of those fields whose applicability could not be loaded */
  applicabilityFailedFieldCount: number
  /** `false` when no NMI API key is configured, so the status cannot be loaded at all */
  nmiConfigured?: boolean
}

/** Shown when no NMI API key is configured: the statuses are missing, not failed. */
const NOT_CONFIGURED_MESSAGE =
  "Aanbevolen en toepasbare maatregelen zijn in deze omgeving niet beschikbaar. Een maatregel zonder aanbeveling is dus niet per se ongeschikt."

/**
 * Returns the Dutch sentence that says which statuses are missing and for how many fields, or
 * `null` when everything could be loaded.
 *
 * @param availability - Which parts of the measure status could be loaded.
 */
export function getMeasureStatusUnavailableMessage(
  availability: MeasureStatusAvailability,
): string | null {
  const {
    recommendationsAvailable,
    applicabilityAvailable,
    eligibleFieldCount,
    applicabilityFailedFieldCount,
  } = availability
  if (recommendationsAvailable && applicabilityAvailable) return null
  if (availability.nmiConfigured === false) return NOT_CONFIGURED_MESSAGE
  const partial =
    !applicabilityAvailable &&
    applicabilityFailedFieldCount > 0 &&
    applicabilityFailedFieldCount < eligibleFieldCount
  const scope = partial
    ? `voor ${applicabilityFailedFieldCount} van de ${eligibleFieldCount} percelen`
    : "voor dit bedrijf"
  if (!recommendationsAvailable && !applicabilityAvailable) {
    // Recommendations are loaded for the whole farm, so only the applicability can be partial
    return partial
      ? `Aanbevolen maatregelen konden niet worden geladen, en toepasbare maatregelen niet ${scope}. Een maatregel zonder aanbeveling is dus niet per se ongeschikt.`
      : "Aanbevolen en toepasbare maatregelen konden voor dit bedrijf niet worden geladen. Een maatregel zonder aanbeveling is dus niet per se ongeschikt."
  }
  if (!recommendationsAvailable) {
    return "Aanbevolen maatregelen konden niet worden geladen. Een maatregel zonder aanbeveling is dus niet per se ongeschikt."
  }
  return `Toepasbare maatregelen konden ${scope} niet worden geladen. Een maatregel die niet als toepasbaar staat, kan dus wel toepasbaar zijn.`
}

/**
 * Warns that the recommended or applicable measures of a farm could not be loaded, so an
 * empty status does not read as "nothing to do", and offers to load them again. Without an NMI
 * API key it says the statuses are not available here, without "Opnieuw proberen", because
 * trying again cannot help. Renders nothing when everything could be loaded.
 *
 * @param props.availability - Which parts of the measure status could be loaded, or `"failed"`
 *   when the status could not be loaded at all (also not which measures are applied).
 */
export function MeasureStatusUnavailable({
  availability,
  className,
}: {
  availability: MeasureStatusAvailability | "failed"
  className?: string
}) {
  const revalidator = useRevalidator()
  const failed = availability === "failed"
  const message = failed
    ? "De status van de maatregelen op uw percelen kon niet worden geladen. De beschrijving en kenmerken van de maatregelen zijn wel volledig."
    : getMeasureStatusUnavailableMessage(availability)
  if (!message) return null
  const notConfigured = !failed && availability.nmiConfigured === false
  const isRetrying = revalidator.state === "loading"
  return (
    <Alert className={className}>
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>
        {failed || notConfigured ? "Status niet beschikbaar" : "Status niet volledig"}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>{message}</p>
        {!notConfigured && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 self-start sm:self-auto"
            disabled={isRetrying}
            onClick={() => {
              void revalidator.revalidate()
            }}
          >
            {isRetrying ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            <span>Opnieuw proberen</span>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
