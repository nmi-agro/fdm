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
                            4 ecosysteemdiensten
                        </p>
                        <ul className="space-y-1 list-none">
                            {[
                                [
                                    "Gewasproductie",
                                    "bodemvruchtbaarheid, structuur en bodemleven (18 indicatoren)",
                                ],
                                [
                                    "Koolstofvastlegging",
                                    "potentie van de bodem om koolstof op te slaan (1 indicator)",
                                ],
                                [
                                    "Waterkwaliteit",
                                    "bescherming van grond- en oppervlaktewater (5 indicatoren)",
                                ],
                                [
                                    "Nutriëntenkringloop",
                                    "efficiëntie van nutriëntopname door het gewas (3 indicatoren)",
                                ],
                            ].map(([dienst, desc]) => (
                                <li key={dienst} className="flex gap-2">
                                    <span className="font-medium text-foreground shrink-0">
                                        {dienst}:
                                    </span>
                                    <span>{desc}</span>
                                </li>
                            ))}
                        </ul>
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
