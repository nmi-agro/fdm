import type { FieldExclusionReason } from "@nmi-agro/fdm-calculator"
import { RotateCw } from "lucide-react"
import { NavLink, useRevalidator } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "~/components/ui/card"
import { PHOSPHATE_EXCLUSION_LABEL, PHOSPHATE_EXCLUSION_TITLE } from "./phosphate-format"
import { PhosphateCardHeading } from "./phosphate-soil"

/**
 * Shown when the phosphate balance could not be calculated: what happened, a way to try again, and
 * a short code to share with support (instead of a technical dump).
 *
 * @param message - What could not be calculated, in Dutch.
 * @param errorId - Reference of the reported error, when available.
 */
export function PhosphateCalculationError({
  message = "De fosfaatbalans kon niet worden berekend.",
  errorId,
}: {
  message?: string
  errorId?: string
}) {
  const revalidator = useRevalidator()
  return (
    <div className="flex justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1.5">
          <PhosphateCardHeading>Balans niet beschikbaar</PhosphateCardHeading>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Probeer het opnieuw. Lukt het dan nog niet, neem contact op met Ondersteuning en noem de
            foutcode hieronder.
          </p>
          {errorId ? (
            <p className="text-muted-foreground">
              Foutcode: <span className="text-foreground font-medium tabular-nums">{errorId}</span>
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button
            onClick={() => revalidator.revalidate()}
            disabled={revalidator.state === "loading"}
          >
            <RotateCw aria-hidden="true" />
            {revalidator.state === "loading" ? "Bezig met opnieuw proberen" : "Opnieuw proberen"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

/**
 * Shown on a field that is left out of the phosphate balance (nature or landscape element), with
 * the reason and a link to the crops of the field, where the main crop can be checked.
 *
 * @param exclusion - Why the field is left out.
 * @param calendar - The selected year.
 * @param cultivationHref - Link to the crops of the field.
 */
export function PhosphateExcludedField({
  exclusion,
  calendar,
  cultivationHref,
}: {
  exclusion: FieldExclusionReason
  calendar: string
  cultivationHref: string
}) {
  return (
    <div className="flex justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <PhosphateCardHeading>{PHOSPHATE_EXCLUSION_TITLE[exclusion]}</PhosphateCardHeading>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            Het hoofdgewas van dit perceel in {calendar} is een{" "}
            {PHOSPHATE_EXCLUSION_LABEL[exclusion]}. Zo&apos;n perceel wordt niet voor productie
            bemest of geoogst, dus het telt niet mee in de fosfaatbalans en het bedrijfsgemiddelde.
          </p>
        </CardContent>
        <CardFooter>
          <NavLink to={cultivationHref}>
            <Button variant="outline">Gewassen van dit perceel bekijken</Button>
          </NavLink>
        </CardFooter>
      </Card>
    </div>
  )
}
