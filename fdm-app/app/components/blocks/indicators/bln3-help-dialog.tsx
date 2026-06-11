import { HelpCircle } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog"

/**
 * Help dialog explaining the BLN3 soil quality framework.
 * Triggered by a small "?" button, rendered inline next to the page title.
 */
export function Bln3HelpDialog() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                    <HelpCircle className="h-4 w-4" />
                    Wat is BLN3?
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Wat is BLN3?</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm text-muted-foreground">
                    <p>
                        <strong className="text-foreground">BLN3</strong> staat
                        voor{" "}
                        <em>Bodemindicatoren voor Landbouwgronden Nederland</em>{" "}
                        (versie 3). Het is een wetenschappelijk onderbouwd
                        systeem om de bodemkwaliteit van landbouwpercelen
                        objectief te beoordelen aan de hand van 27 indicatoren.
                    </p>

                    <div className="space-y-1.5">
                        <p className="font-medium text-foreground">
                            De BLN3 Structuur (4 hoofdbranches)
                        </p>
                        <ul className="space-y-2 list-none pl-0">
                            {[
                                [
                                    "Water",
                                    "Beoordeelt de infiltratie (grondwaterkwantiteit), uitspoelingsweerstand (grondwaterkwaliteit) en oppervlakkige afspoelingsweerstand (oppervlaktewaterkwaliteit).",
                                ],
                                [
                                    "Nutriëntenkringloop",
                                    "Beoordeelt de efficiëntie waarmee de bodem stikstof, fosfaat en kalium vasthoudt en benut.",
                                ],
                                [
                                    "Klimaat",
                                    "De potentie van de bodem om koolstof op te slaan (koolstofvastlegging).",
                                ],
                                [
                                    "Productie (Open Bodem Index / OBI)",
                                    "Focust op gewasproductie, onderverdeeld in biologische, chemische en fysische bodemvruchtbaarheid en -structuur.",
                                ],
                            ].map(([dienst, desc]) => (
                                <li key={dienst} className="text-xs">
                                    <strong className="text-foreground shrink-0 block">
                                        {dienst}:
                                    </strong>
                                    <span>{desc}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-1.5">
                        <p className="font-medium text-foreground">
                            Bedrijfsscore
                        </p>
                        <p className="text-xs">
                            Op de bedrijfspagina worden alle scores opgebouwd als een <strong>oppervlaktegewogen gemiddelde</strong> van de individuele percelen. Percelen zonder geregistreerde oppervlakte of geldige bodemanalyse worden hierbij automatisch uitgesloten om vertekening te voorkomen.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <p className="font-medium text-foreground">
                            Scores (0–100)
                        </p>
                        <ul className="space-y-1">
                            <li>
                                <span className="font-medium text-green-600 dark:text-green-400">
                                    ≥ 70
                                </span>{" "}
                                — Goed tot Uitstekend
                            </li>
                            <li>
                                <span className="font-medium text-yellow-600 dark:text-yellow-400">
                                    40–69
                                </span>{" "}
                                — Matig: aandacht gewenst
                            </li>
                            <li>
                                <span className="font-medium text-red-600 dark:text-red-400">
                                    &lt; 40
                                </span>{" "}
                                — Onvoldoende: actie nodig
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-1.5">
                        <p className="font-medium text-foreground">
                            Met vs. zonder maatregelen
                        </p>
                        <p>
                            <strong className="text-foreground">
                                Met maatregelen
                            </strong>{" "}
                            toont de verwachte bodemkwaliteit wanneer aanbevolen
                            bodemmaatregelen worden toegepast.{" "}
                            <strong className="text-foreground">
                                Zonder maatregelen
                            </strong>{" "}
                            toont de huidige situatie op basis van uw
                            bodemanalyses.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
