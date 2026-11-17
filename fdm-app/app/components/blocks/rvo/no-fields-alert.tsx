import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import type { RvoRequestMode } from "./connect-card"

interface RvoNoFieldsAlertProps {
  /** The eHerkenning the user chose to log in with; the likely cause differs per option. */
  mode: RvoRequestMode | null
  /** Calendar year the fields were requested for. */
  calendar: string
  /** Name of the farm the fields are imported into, if known. */
  farmName: string | null | undefined
}

/**
 * Shown when RVO accepted the request but returned no fields for the calendar year.
 */
export function RvoNoFieldsAlert({ mode, calendar, farmName }: RvoNoFieldsAlertProps) {
  const farm = farmName?.trim() || "dit bedrijf"
  return (
    <Alert>
      <AlertTitle>Geen percelen gevonden</AlertTitle>
      <AlertDescription>
        {mode === "own_farm"
          ? `RVO heeft voor ${calendar} geen percelen gevonden bij de eHerkenning waarmee u bent ingelogd. Controleer of dat de eHerkenning van ${farm} is. Logt u in met de eHerkenning van uw eigen organisatie? Kies dan die optie en probeer het opnieuw.`
          : `RVO heeft voor ${calendar} geen percelen gevonden voor ${farm}. Controleer het KvK-nummer van dit bedrijf en probeer het opnieuw.`}
      </AlertDescription>
    </Alert>
  )
}
