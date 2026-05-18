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
                        objectief te beoordelen aan de hand van 28 indicatoren.
                    </p>

                    <div className="space-y-1.5">
                        <p className="font-medium text-foreground">
                            28 indicatoren in 6 thema's
                        </p>
                        <ul className="space-y-1 list-none">
                            {[
                                ["Biologisch", "bodemleven en biodiversiteit"],
                                ["Chemisch", "nutriëntengehaltes en zuurgraad"],
                                [
                                    "Fysisch",
                                    "bodemstructuur en waterhuishouding",
                                ],
                                ["Grondwater", "uitspoeling naar grondwater"],
                                [
                                    "Nutriënten",
                                    "nutriëntenkringlopen en efficiëntie",
                                ],
                                [
                                    "Oppervlaktewater",
                                    "belasting van oppervlaktewater",
                                ],
                            ].map(([cat, desc]) => (
                                <li key={cat} className="flex gap-2">
                                    <span className="font-medium text-foreground shrink-0">
                                        {cat}:
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

                    <div className="space-y-1.5">
                        <p className="font-medium text-foreground">
                            OBI &amp; BBWP
                        </p>
                        <p>
                            De{" "}
                            <strong className="text-foreground">
                                Open Bodem Index (OBI)
                            </strong>{" "}
                            is een instrument dat de algehele bodemkwaliteit van
                            een perceel weergeeft voor agrarische productie,
                            gebaseerd op de meest relevante BLN3-indicatoren
                            voor bodemgezondheid.
                        </p>
                        <p>
                            Het{" "}
                            <strong className="text-foreground">
                                BedrijfsBodemWaterPlan (BBWP)
                            </strong>{" "}
                            is een instrument waarmee telers concrete
                            maatregelen plannen om de bodem- en waterkwaliteit
                            op hun bedrijf te verbeteren — voor het verminderen
                            van nutriëntenuitspoeling en afspoeling en het
                            verhogen van het waterbergend vermogen. De
                            BBWP-score geeft aan in hoeverre het perceel
                            bijdraagt aan deze doelen voor de waterkwaliteit en
                            kwantiteit.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
