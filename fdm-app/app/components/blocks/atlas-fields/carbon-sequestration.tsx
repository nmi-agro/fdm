import {
    Leaf,
    Car,
    HelpCircle,
    ChevronDown,
    Droplets,
    Sprout,
    Euro,
} from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { Progress } from "~/components/ui/progress"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"

export function CarbonSequestrationCard({
    carbonEstimates,
}: {
    carbonEstimates: {
        a_som_loi: number
        b_som_potential: number
        b_c_st03: number
        b_c_st03_potential: number
        b_c_delta: number
    }
}) {
    // API values
    const currentOM = Math.round(carbonEstimates.a_som_loi * 10) / 10
    const maxOM = Math.round(carbonEstimates.b_som_potential * 10) / 10
    const potentialCO2eq =
        Math.round(carbonEstimates.b_c_delta * 3.67 * 10) / 10

    // Derived values
    const percentageOfMax = Math.min((currentOM / maxOM) * 100, 100)

    // Impact calculations (Mocked logic for now)
    const carKmEquivalent = Math.round(potentialCO2eq * 5000)

    // Mocked Pedotransfer logic:
    // - 1% extra OS ~= 5mm extra water storage (rough estimate)
    // - 1% extra OS ~= 15-20 kg N mineralized per year (rough estimate)
    const extraOMPercentage = Math.max(0, maxOM - currentOM)
    const extraWaterStorage = Math.round(extraOMPercentage * 5 * 10) / 10
    const extraNMineralization = Math.round(extraOMPercentage * 18)

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        Koolstof
                        <Leaf className="h-4 w-4 text-green-600" />
                    </CardTitle>
                    <CardDescription>
                        Hoeveel koolstof kan dit perceel opslaan in de bodem?
                    </CardDescription>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Visual Gauge Section */}
                <div className="space-y-3">
                    <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">
                            Huidige status vs. fysieke bovengrens
                        </span>
                        <span className="text-muted-foreground">
                            {Math.round(percentageOfMax)}%
                        </span>
                    </div>
                    <div className="relative pt-1">
                        <Progress
                            value={percentageOfMax}
                            className="h-3 bg-muted"
                            colorBar="green-600"
                        />
                        <div
                            className="absolute top-0 h-5 w-0.5 bg-green-700 dark:bg-green-400 transition-all"
                            style={{ left: `${percentageOfMax}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-muted-foreground pt-1">
                        <span>Huidige OS: {currentOM}%</span>
                        <span>Maximale OS: {maxOM}%</span>
                    </div>
                </div>

                <Separator />

                {/* Technical Stats Grid */}
                <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                            Huidige Voorraad
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold">
                                {Math.round(carbonEstimates.b_c_st03 * 10) / 10}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                ton C/ha
                            </span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                            Potentiële voorraad
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold">
                                {Math.round(
                                    carbonEstimates.b_c_st03_potential * 10,
                                ) / 10}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                ton C/ha
                            </span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            CO₂ Potentieel
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className="h-3 w-3 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs text-xs">
                                            De totale hoeveelheid CO₂eq die
                                            extra vastgelegd kan worden per
                                            hectare in de bovenste 30cm.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </span>
                        <div className="flex items-baseline gap-1 ">
                            <span className="text-xl font-bold">
                                {potentialCO2eq}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                ton CO₂eq/ha
                            </span>
                        </div>
                    </div>
                </div>

                {/* Relatable Impact Grid */}
                <div className="space-y-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Potentiële voordelen bij maximale opslag
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Car Impact */}
                        <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3 border border-border">
                            <div className="rounded-full bg-background p-1.5 border border-border">
                                <Car className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                    Klimaat
                                </p>
                                <p className="text-xs font-medium">
                                    ~{carKmEquivalent.toLocaleString()} km
                                </p>
                                <p className="text-[9px] text-muted-foreground leading-none">
                                    Compensatie CO₂ uitstoot
                                </p>
                            </div>
                        </div>

                        {/* Water Storage */}
                        <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3 border border-border">
                            <div className="rounded-full bg-background p-1.5 border border-border">
                                <Droplets className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                    Water vasthouden
                                </p>
                                <p className="text-xs font-medium">
                                    +{extraWaterStorage} mm water
                                </p>
                                <p className="text-[9px] text-muted-foreground leading-none">
                                    Extra waterbergend vermogen
                                </p>
                            </div>
                        </div>

                        {/* N-Mineralization */}
                        <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3 border border-border">
                            <div className="rounded-full bg-background p-1.5 border border-border">
                                <Sprout className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                    Mineralisatie
                                </p>
                                <p className="text-xs font-medium">
                                    +{extraNMineralization} kg N/ha/jaar
                                </p>
                                <p className="text-[9px] text-muted-foreground leading-none">
                                    Extra stikstoflevering uit de bodem
                                </p>
                            </div>
                        </div>

                        {/* Carbon Credits Potential */}
                        <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3 border border-border">
                            <div className="rounded-full bg-background p-1.5 border border-border">
                                <Euro className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                    Offsetting
                                </p>
                                <p className="text-xs font-medium">
                                    ~€{(potentialCO2eq * 75).toLocaleString()}{" "}
                                    /ha
                                </p>
                                <p className="text-[9px] text-muted-foreground leading-none">
                                    Schatting koolstofcertificaten via EU ETS
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Methodology Collapsible */}
                <Collapsible className="space-y-2">
                    <CollapsibleTrigger className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group">
                        Toelichting
                        <ChevronDown className="h-3 w-3 group-data-[state=open]:rotate-180 transition-transform" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="rounded-lg bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground space-y-2 border border-muted-foreground/10 animate-in fade-in slide-in-from-top-1">
                        <p>
                            Huidige organische stofgehalte is volgens{" "}
                            <span className="font-medium text-foreground/80">
                                NMI BodemSchat
                            </span>
                            .
                        </p>
                        <p>
                            De <strong>fysieke bovengrens</strong> (maximale OS)
                            is gebaseerd op een{" "}
                            <span className="font-medium text-foreground/80">
                                NMI-studie
                            </span>{" "}
                            en geeft aan hoeveel organische stof de bodem fysiek
                            kan binden, rekening houdend met de textuur en
                            andere bodemparameters. Het realiseren hiervan is
                            een lange-termijn proces.
                        </p>
                        <p>
                            De getoonde voordelen voor water en stikstof zijn
                            indicatieve schattingen op basis van bodemkundige
                            vuistregels.
                        </p>
                    </CollapsibleContent>
                </Collapsible>
            </CardContent>
        </Card>
    )
}

export function CarbonSequestrationSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-1/3 mb-2" />
                <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2 w-full" />
                </div>
                <Skeleton className="h-16 w-full rounded-xl" />
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-4 w-1/4" />
            </CardContent>
        </Card>
    )
}
