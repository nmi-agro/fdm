import { Bot } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { Label } from "~/components/ui/label"

interface GerritOnboardingProps {
    isCheckboxChecked: boolean
    setIsCheckboxChecked: (checked: boolean) => void
    onAccept: () => void
}

export function GerritOnboarding({
    isCheckboxChecked,
    setIsCheckboxChecked,
    onAccept,
}: GerritOnboardingProps) {
    return (
        <div className="max-w-5xl mx-auto mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* ── Hoe Gerrit werkt ── */}
            <Card className="flex flex-col h-full">
                <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-3 font-bold">
                        <Bot className="w-6 h-6 text-primary" />
                        Hoe werkt Gerrit?
                    </CardTitle>
                    <CardDescription className="text-base">
                        Gerrit stelt een bemestingsplan op op basis van jouw
                        gekozen strategie. Elk voorstel wordt direct getoetst en
                        doorloopt een cyclus van verbeteringen tot het plan
                        optimaal is.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 flex-grow">
                    <p className="text-muted-foreground">
                        Wanneer je op 'Genereer plan' klikt, gaat Gerrit als
                        volgt te werk:
                    </p>
                    <ul className="space-y-6">
                        <li className="flex items-start gap-4">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                1
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-foreground">
                                    Inventarisatie
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Eerst worden alle gegevens verzameld: je
                                    percelen, de gewassen, de bodemanalyses en
                                    welke meststoffen beschikbaar zijn.
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                2
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-foreground">
                                    Ontwerpen en controleren
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Gerrit maakt een eerste bemestingsplan en
                                    rekent dit direct door. Er wordt getoetst of
                                    het plan past binnen de gebruiksruimte en of
                                    de gewassen voldoende krijgen.
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                3
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-foreground">
                                    Bijsturen tot het klopt
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Als het eerste ontwerp niet voldoet, past
                                    Gerrit het plan zelfstandig aan. Dit
                                    herhaalt zich tot er een agronomisch en
                                    wettelijk correct voorstel ligt.
                                </p>
                            </div>
                        </li>
                    </ul>
                </CardContent>
                <CardFooter className="pt-6 border-t mt-auto">
                    <p className="text-sm italic text-muted-foreground leading-relaxed">
                        Het uiteindelijke voorstel zie je hierna op je scherm.
                        Pas als je op 'Plan toepassen' klikt, worden de
                        bemestingen opgeslagen.
                    </p>
                </CardFooter>
            </Card>

            {/* ── Voorwaarden / Disclaimer ── */}
            <Card className="flex flex-col h-full">
                <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-3 font-bold">
                        <Bot className="w-6 h-6 text-primary" />
                        Gebruiksvoorwaarden
                    </CardTitle>
                    <CardDescription className="text-base">
                        Om Gerrit te kunnen gebruiken, vragen we je akkoord te
                        gaan met de volgende punten voor het gebruik van deze
                        experimentele functie.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 flex-grow">
                    <ul className="space-y-6">
                        <li className="flex items-start gap-4">
                            <div className="flex h-2 w-2 mt-2 shrink-0 rounded-full bg-primary" />
                            <div className="space-y-1">
                                <p className="font-semibold text-foreground">
                                    Experimentele functie
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Dit is een proefversie (bèta) en nog geen
                                    definitief product. We kunnen deze functie
                                    in de toekomst aanpassen of verwijderen.
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="flex h-2 w-2 mt-2 shrink-0 rounded-full bg-primary" />
                            <div className="space-y-1">
                                <p className="font-semibold text-foreground">
                                    Fair Use & Limieten
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Bedoeld voor normaal gebruik bij het
                                    opstellen van je eigen plan. Om Gerrit voor
                                    iedereen beschikbaar te houden kunnen er
                                    limieten gelden.
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="flex h-2 w-2 mt-2 shrink-0 rounded-full bg-primary" />
                            <div className="space-y-1">
                                <p className="font-semibold text-foreground">
                                    Controleren is nodig
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Gerrit maakt gebruik van AI en kan fouten
                                    maken. Controleer de plannen altijd kritisch
                                    op agronomische en wettelijke juistheid.
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="flex h-2 w-2 mt-2 shrink-0 rounded-full bg-primary" />
                            <div className="space-y-1">
                                <p className="font-semibold text-foreground">
                                    Dataverwerking
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Bedrijfs- en perceelsgegevens worden
                                    meegestuurd naar de AI-modellen van Google
                                    (Gemini) om een plan te kunnen genereren.
                                </p>
                            </div>
                        </li>
                    </ul>
                </CardContent>
                <CardFooter className="flex-col items-stretch gap-4 pt-6 border-t mt-auto">
                    <div className="flex items-start space-x-3">
                        <Checkbox
                            id="accept-terms"
                            checked={isCheckboxChecked}
                            onCheckedChange={(checked) =>
                                setIsCheckboxChecked(checked === true)
                            }
                            className="mt-1"
                        />
                        <Label
                            htmlFor="accept-terms"
                            className="text-sm font-medium leading-relaxed cursor-pointer"
                        >
                            Ik begrijp en ga akkoord met bovenstaande
                            voorwaarden voor het gebruik van Gerrit.
                        </Label>
                    </div>
                    <Button
                        onClick={onAccept}
                        disabled={!isCheckboxChecked}
                        className="w-full"
                    >
                        Start met Gerrit
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
