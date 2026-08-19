import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { cn } from "~/lib/utils"

interface NormsDisclaimerProps {
  calendar?: string
  className?: string
}

export function NormsDisclaimer({ className }: NormsDisclaimerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className={cn(
        "border-border/60 bg-muted/40 text-muted-foreground rounded-lg border p-3.5 text-xs transition-colors sm:p-4",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <Info className="text-muted-foreground/80 mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1 space-y-2">
          <p className="leading-relaxed">
            De getoonde gebruiksnormen zijn indicatief en uitsluitend bedoeld voor informatieve
            doeleinden. Raadpleeg altijd de officiële RVO-publicaties en uw adviseur voor
            definitieve normen en juridische naleving.
          </p>

          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex items-center">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground/80 hover:bg-muted/80 hover:text-foreground -ml-1.5 h-6 px-1.5 text-xs font-medium"
                >
                  <span>Niet-ondersteunde situaties</span>
                  {isOpen ? (
                    <ChevronUp className="ml-1 h-3 w-3 opacity-70" />
                  ) : (
                    <ChevronDown className="ml-1 h-3 w-3 opacity-70" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="pt-2.5">
              <div className="border-border/50 bg-background/60 text-muted-foreground rounded-md border p-3 text-xs leading-relaxed">
                <p className="text-foreground mb-2 font-medium">
                  Hoewel we proberen de gebruiksruimte zo nauwkeurig mogelijk te berekenen, zijn er
                  situaties waarin dit (nog) niet kan of gebeurt, zoals:
                </p>
                <ul className="list-disc space-y-1.5 pl-4">
                  <li>
                    <span className="text-foreground font-medium">
                      Opbrengstafhankelijke stikstofdifferentiatie:
                    </span>{" "}
                    Gebruiksruimteverhoging op basis van bewezen meerjarige gewasopbrengsten.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Fritesaardappelen op klei:</span>{" "}
                    Differentiatienormen voor geregistreerde fritesteelten.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">
                      Graszaad met voedersnede & stoppelvernietiging:
                    </span>{" "}
                    Vereist specifieke teeltgegevens (min. 8–10 weken standtijd, ploegen na 1
                    december) die nog niet worden opgeslagen in de applicatie.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Mengteelten:</span> Gecombineerde
                    teelten op hetzelfde perceel.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">
                      Forfaitaire bedrijfsnorm (voetnoot 9):
                    </span>{" "}
                    Vaste 110 kg N/ha normregeling bij gemiddelden tussen 100 en 110 kg N/ha.
                  </li>
                  <li>
                    <span className="text-foreground font-medium">
                      Tweejarige winterteelt budgetsplitsing (voetnoot 5/18):
                    </span>{" "}
                    Uitsplitsing van de stikstofruimte over zaai- en oogstjaar.
                  </li>
                </ul>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  )
}
