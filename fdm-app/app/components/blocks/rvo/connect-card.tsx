import { AlertTriangle, ExternalLink, Info, LifeBuoy, Loader2 } from "lucide-react"
import { type FormEvent, useId, useState } from "react"
import { Form, Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Label } from "~/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import { cn } from "~/lib/utils"

/** Whose RVO data the user requests. Mirrors `RvoRequestMode` in `~/integrations/rvo.server`. */
export type RvoRequestMode = "own_farm" | "machtiging"

/**
 * The options are phrased around the eHerkenning the user logs in with, not around "which farm":
 * the farm is already selected in the app, so a question about the farm would be ambiguous.
 */
function getRvoRequestModeOptions(farmName: string): {
  value: RvoRequestMode
  label: string
  description: string
}[] {
  return [
    {
      value: "own_farm",
      label: `Met de eHerkenning van ${farmName}`,
      description: "U bent eigenaar of werkt bij dit bedrijf.",
    },
    {
      value: "machtiging",
      label: "Met de eHerkenning van mijn eigen organisatie",
      description: `Bijvoorbeeld als adviseur. U heeft bij RVO een machtiging om voor ${farmName} gegevens op te vragen.`,
    },
  ]
}

/**
 * Narrows an untrusted value, such as a search parameter, to a request mode.
 * @returns The mode, or `undefined` when the value is not a valid mode.
 */
export function parseRvoRequestMode(value: string | null | undefined): RvoRequestMode | undefined {
  return value === "own_farm" || value === "machtiging" ? value : undefined
}

interface RvoConnectCardProps {
  b_businessid_farm: string | null
  /** Name of the farm the fields are imported into; used to make the options unambiguous. */
  b_name_farm: string | null | undefined
  /** Calendar year the fields are requested for. */
  calendar: string
  /** Where the user can add or change the farm's KvK number. */
  kvkHref: string
  isImporting: boolean
  isRvoConfigured: boolean
  /** Option to select initially, for example after a retry with the other option. */
  defaultMode?: RvoRequestMode
}

/**
 * Card that starts the RVO import: the user chooses which eHerkenning they log in with and is
 * then redirected to the eHerkenning login of RVO.
 */
export function RvoConnectCard({
  b_businessid_farm,
  b_name_farm,
  calendar,
  kvkHref,
  isImporting,
  isRvoConfigured,
  defaultMode,
}: RvoConnectCardProps) {
  const [rvoMode, setRvoMode] = useState<RvoRequestMode | "">(defaultMode ?? "")
  const [showModeError, setShowModeError] = useState(false)
  const id = useId()
  const legendId = `${id}-legend`
  const modeErrorId = `${id}-mode-error`
  const statusId = `${id}-status`

  const farmName = b_name_farm?.trim() || "dit bedrijf"
  const hasKvk = Boolean(b_businessid_farm)
  const canConnect = hasKvk && isRvoConfigured

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!rvoMode) {
      event.preventDefault()
      setShowModeError(true)
      // Move focus to the choice, so keyboard and screen reader users land on the problem
      event.currentTarget.querySelector<HTMLButtonElement>('[role="radio"]')?.focus()
    }
  }

  return (
    <Card className="w-full">
      <Form method="post" noValidate onSubmit={handleSubmit}>
        <input type="hidden" name="intent" value="start_import" />
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle role="heading" aria-level={2}>
              Percelen ophalen bij RVO
            </CardTitle>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="focus-visible:ring-ring/50 rounded-md outline-none focus-visible:ring-[3px]"
                  aria-label="In ontwikkeling: meer informatie"
                >
                  <Badge
                    variant="outline"
                    className="text-muted-foreground hover:bg-accent gap-1 font-normal"
                  >
                    In ontwikkeling
                    <Info className="h-3 w-3" aria-hidden="true" />
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 space-y-3 text-sm">
                <p className="font-medium">Deze functie is nog in ontwikkeling</p>
                <p className="text-muted-foreground text-pretty">
                  Het ophalen van percelen bij RVO is nieuw en we verbeteren het nog op basis van
                  ervaringen van gebruikers. Er verandert niets in uw bedrijf zonder dat u de
                  verschillen eerst heeft beoordeeld.
                </p>
                <p className="text-muted-foreground text-pretty">
                  Werkt iets niet zoals verwacht, of heeft u een idee om het te verbeteren? Laat het
                  ons weten via Ondersteuning.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/support/new">
                    <LifeBuoy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Contact opnemen met Ondersteuning
                  </Link>
                </Button>
              </PopoverContent>
            </Popover>
          </div>
          <CardDescription className="text-pretty">
            U logt in bij RVO met eHerkenning. Daarna lezen wij alleen de percelen die voor{" "}
            {calendar} bij RVO geregistreerd zijn. U beoordeelt alle verschillen voordat er iets in
            uw bedrijf verandert.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <fieldset
            className="space-y-3"
            aria-describedby={showModeError ? modeErrorId : undefined}
          >
            <legend id={legendId} className="mb-3 text-sm font-medium">
              Met welke eHerkenning logt u in bij RVO?
            </legend>
            <RadioGroup
              name="rvo_mode"
              aria-labelledby={legendId}
              aria-invalid={showModeError || undefined}
              aria-errormessage={showModeError ? modeErrorId : undefined}
              value={rvoMode}
              onValueChange={(value) => {
                setRvoMode(value as RvoRequestMode)
                setShowModeError(false)
              }}
              className="gap-2"
            >
              {getRvoRequestModeOptions(farmName).map((option) => {
                const optionId = `${id}-${option.value}`
                const descriptionId = `${optionId}-description`
                return (
                  <div
                    key={option.value}
                    className={cn(
                      "relative flex items-start gap-3 rounded-md border p-3 transition-colors",
                      "has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5",
                      "has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]",
                      showModeError && "border-destructive",
                    )}
                  >
                    <RadioGroupItem
                      id={optionId}
                      value={option.value}
                      aria-describedby={descriptionId}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      {/* The label stretches over the whole option, so the full row is clickable */}
                      <Label
                        htmlFor={optionId}
                        className="cursor-pointer font-medium after:absolute after:inset-0"
                      >
                        {option.label}
                      </Label>
                      <p id={descriptionId} className="text-muted-foreground text-sm text-pretty">
                        {option.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </RadioGroup>
            {showModeError && (
              <p id={modeErrorId} className="text-destructive text-sm">
                Kies eerst met welke eHerkenning u inlogt.
              </p>
            )}
          </fieldset>

          {hasKvk ? (
            <p className="text-muted-foreground text-sm">
              KvK-nummer van dit bedrijf:{" "}
              <span className="text-foreground font-medium tabular-nums">{b_businessid_farm}</span>{" "}
              <span aria-hidden="true">·</span>{" "}
              <Link to={kvkHref} className="text-foreground underline underline-offset-4">
                Wijzigen
              </Link>
            </p>
          ) : (
            <div className="border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-md border p-3 text-sm">
              <AlertTriangle
                className="text-destructive mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                Dit bedrijf heeft nog geen KvK-nummer. Voeg het KvK-nummer toe om percelen bij RVO
                op te halen.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col items-stretch gap-2">
          {hasKvk ? (
            <Button
              type="submit"
              disabled={isImporting || !canConnect}
              aria-describedby={statusId}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Verbinden met RVO…
                </>
              ) : (
                <>
                  Verbinden met RVO
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          ) : (
            <Button variant="outline" asChild className="w-full">
              <Link to={kvkHref}>KvK-nummer toevoegen</Link>
            </Button>
          )}
          <p id={statusId} className="text-muted-foreground text-center text-xs" aria-live="polite">
            {isImporting
              ? "U wordt doorgestuurd naar de inlogpagina van RVO…"
              : !isRvoConfigured
                ? "De koppeling met RVO is op deze server niet beschikbaar."
                : hasKvk
                  ? "U gaat naar de inlogpagina van RVO en komt daarna hier terug."
                  : null}
          </p>
        </CardFooter>
      </Form>
    </Card>
  )
}
