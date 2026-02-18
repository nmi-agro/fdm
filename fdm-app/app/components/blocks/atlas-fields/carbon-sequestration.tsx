import {
    Leaf,
    Car,
    HelpCircle,
    ChevronDown,
    Droplets,
    Sprout,
    Euro,
    Database,
    Target,
    Zap,
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
    const percentageOfMax =
        maxOM > 0 ? Math.min((currentOM / maxOM) * 100, 100) : 0

    // Impact calculations
    // TODO: come up with better calculations
    const carKmEquivalent = Math.round(potentialCO2eq * 5000)
    const extraOMPercentage = Math.max(0, maxOM - currentOM)
    const extraWaterStorage = Math.round(extraOMPercentage * 5 * 10) / 10
    const extraNMineralization = Math.round(extraOMPercentage * 18)

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        Koolstofvastlegging
                        <Leaf className="h-4 w-4 text-green-600" />
                    </CardTitle>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                    Inzicht in de huidige geschatte
                                    koolstofvoorraad en het potentieel om extra
                                    CO₂ vast te leggen in de bovenste 30cm van
                                    de bodem.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <CardDescription>
                    Hoeveel koolstof kan dit perceel opslaan in de bodem?
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
                {/* Visual Progress Section */}
                <div className="space-y-3">
                    <div className="flex justify-between text-sm font-medium text-muted-foreground">
                        <span>Huidig vs. fysieke bovengrens</span>
                        <span>
                            {Math.round(percentageOfMax)}% t.o.v. bovengrens
                        </span>
                    </div>
                    <Progress value={percentageOfMax} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>Huidig: {currentOM}% OS</span>
                        <span>Fysieke bovengrens: {maxOM}% OS</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                            Voorraad
                        </p>
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
                        <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                            Potentieel
                        </p>
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
                        <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                            CO₂-vastlegging
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold">
                                +{potentialCO2eq}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                ton CO₂eq/ha
                            </span>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Relatable Impact Grid */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground">
                        Potentiële voordelen bij maximale opslag (per hectare)
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                        <div className="flex items-start gap-3">
                            <Car className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div className="space-y-0.5">
                                <p className="text-sm font-semibold">
                                    ~{carKmEquivalent.toLocaleString()} km
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Compensatie uitstoot personenauto
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Droplets className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div className="space-y-0.5">
                                <p className="text-sm font-semibold">
                                    +{extraWaterStorage} mm water
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Extra waterbergend vermogen
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Sprout className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div className="space-y-0.5">
                                <p className="text-sm font-semibold">
                                    +{extraNMineralization} kg N/jaar
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Extra stikstoflevering uit de bodem
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Euro className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div className="space-y-0.5">
                                <p className="text-sm font-semibold">
                                    ~€{(potentialCO2eq * 75).toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Geschatte waarde koolstofcertificaten via EU
                                    ETS
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
                    <CollapsibleContent className="rounded-lg bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground space-y-2 border">
                        <p>
                            Het huidige organische stofgehalte is geschat met{" "}
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
                            een lange-termijn opgave.
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
                <Skeleton className="h-6 w-1/3 mb-2" />
                <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                </div>
                <div className="grid grid-cols-3 gap-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <Separator />
                <div className="space-y-4">
                    <Skeleton className="h-4 w-1/2" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex gap-3">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-3 w-3/4" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
