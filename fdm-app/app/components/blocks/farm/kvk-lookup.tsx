import { AlertTriangle, Building2, Info, Search } from "lucide-react"
import { useEffect, useRef } from "react"
import { useFetcher } from "react-router"
import type { KvkLookupResponse } from "~/integrations/kvk.server"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

/** Returns true when the value is a well-formed KvK number of 8 digits. */
export function isValidKvkNumber(value: string | undefined | null): boolean {
  return /^\d{8}$/.test(value?.trim() ?? "")
}

/**
 * Looks up a KvK number through the `/api/lookup/kvk` resource route.
 *
 * @param onResult - Called once for every completed lookup.
 * @returns `lookup` to start a lookup, the latest `result` and whether a lookup is running.
 */
export function useKvkLookup(onResult?: (result: KvkLookupResponse) => void) {
  const fetcher = useFetcher<KvkLookupResponse>()
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      onResultRef.current?.(fetcher.data)
    }
  }, [fetcher.state, fetcher.data])

  const lookup = (kvkNumber: string) => {
    const kvk = kvkNumber.trim()
    if (!isValidKvkNumber(kvk)) return
    void fetcher.load(`/api/lookup/kvk?kvk=${encodeURIComponent(kvk)}`)
  }

  return {
    lookup,
    result: fetcher.data,
    isLoading: fetcher.state !== "idle",
  }
}

/** Button that starts a KvK lookup. */
export function KvkLookupButton({
  kvkNumber,
  isLoading,
  onLookup,
  disabled,
  variant = "secondary",
  className,
}: {
  kvkNumber: string | undefined
  isLoading: boolean
  onLookup: () => void
  disabled?: boolean
  variant?: "default" | "secondary" | "outline"
  className?: string
}) {
  return (
    <Button
      type="button"
      variant={variant}
      className={cn("shrink-0", className)}
      disabled={disabled || isLoading || !isValidKvkNumber(kvkNumber)}
      onClick={onLookup}
    >
      {isLoading ? <Spinner /> : <Search />}
      {isLoading ? "Ophalen..." : "Ophalen uit KvK"}
    </Button>
  )
}

const ERROR_MESSAGES: Record<Extract<KvkLookupResponse, { status: "error" }>["reason"], string> = {
  unauthorized: "De koppeling met KvK is niet goed ingesteld. Vul de gegevens zelf in.",
  rate_limited: "Er zijn te veel verzoeken naar KvK gedaan. Probeer het over een minuut opnieuw.",
  timeout: "KvK reageert niet. Probeer het later opnieuw of vul de gegevens zelf in.",
  upstream:
    "KvK is op dit moment niet bereikbaar. Probeer het later opnieuw of vul de gegevens zelf in.",
}

/**
 * Shows the outcome of a KvK lookup: the source and time of the data, and
 * warnings for an inactive registration or an incomplete address.
 */
export function KvkLookupStatus({
  result,
  className,
}: {
  result: KvkLookupResponse | undefined
  className?: string
}) {
  if (!result) return null

  return (
    <div role="status" aria-live="polite" className={cn("space-y-1.5 text-sm", className)}>
      {result.status === "found" && (
        <>
          <p className="text-muted-foreground flex items-start gap-2">
            <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Gegevens ingevuld vanuit het KvK Handelsregister. Controleer ze en pas ze zo nodig
              aan.
            </span>
          </p>
          {!result.isActive && (
            <p className="flex items-start gap-2 text-amber-700 dark:text-amber-500">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Deze inschrijving is niet (meer) actief in het Handelsregister.</span>
            </p>
          )}
          {(!result.hasHouseNumber || !result.postalcode) && (
            <p className="text-muted-foreground flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>KvK geeft niet het volledige adres. Vul huisnummer en postcode aan.</span>
            </p>
          )}
        </>
      )}
      {result.status === "not_found" && (
        <p className="flex items-start gap-2 text-amber-700 dark:text-amber-500">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Geen inschrijving gevonden voor KvK-nummer {result.kvkNumber}. Controleer het nummer of
            vul de gegevens zelf in.
          </span>
        </p>
      )}
      {result.status === "error" && (
        <p className="text-destructive flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{ERROR_MESSAGES[result.reason]}</span>
        </p>
      )}
      {result.status === "disabled" && (
        <p className="text-muted-foreground flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Ophalen uit KvK is in deze omgeving niet beschikbaar.</span>
        </p>
      )}
    </div>
  )
}
