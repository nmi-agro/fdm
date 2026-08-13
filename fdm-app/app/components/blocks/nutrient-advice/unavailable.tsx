import { RotateCw, TriangleAlert } from "lucide-react"
import { NavLink } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"

export type NutrientAdviceUnavailableProps = {
  /** Raw error message from the loader, used only to pick a more specific explanation below. */
  message: string
  /** Link to the field's cultivation page, offered when the advice couldn't be calculated
   * because no (active) cultivation is registered for this year. */
  cultivationTo: string
}

/**
 * Inline "advice unavailable" state for the nutrient-advice page, shown in place of the advice
 * sections when the loader's async advice fetch fails.
 *
 * Deliberately not the full-screen `ErrorBlock`: that component is meant for route-level
 * failures and renders `min-h-screen`, which looks broken nested inside this page's normal
 * layout (sidebar/header still visible around it). This card stays in place, explains the most
 * common causes in plain language, and offers a concrete next step instead of a raw error dump.
 */
export function NutrientAdviceUnavailable({
  message,
  cultivationTo,
}: NutrientAdviceUnavailableProps) {
  const missingCultivation = message.includes("cultivations") || message.includes("hoofdteelt")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="text-muted-foreground h-5 w-5" />
          Bemestingsadvies niet beschikbaar
        </CardTitle>
        <CardDescription>
          {missingCultivation
            ? "Er is voor dit jaar geen gewas geregistreerd op dit perceel, dus kan er geen advies worden berekend."
            : "Het advies kon niet worden opgehaald. Dit kan komen door een tijdelijk probleem met de adviesdienst, of doordat er nog gegevens ontbreken (zoals een bodemanalyse)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {missingCultivation ? (
          <Button asChild size="sm">
            <NavLink to={cultivationTo}>Gewas registreren</NavLink>
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            Opnieuw proberen
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
