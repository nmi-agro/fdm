import { Car, ChevronDown, Droplets, Euro, HelpCircle, Leaf, Sprout } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Progress } from "~/components/ui/progress"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

export function CarbonSequestrationCard({
  carbonEstimates,
}: {
  carbonEstimates: {
    a_som_loi: number
    b_som_potential: number
    b_c_st03: number
    b_c_st03_potential: number
    b_c_delta: number
    extraWaterStorage: number
    extraNMineralization: number
  }
}) {
  // API values
  const currentOM = Math.round(carbonEstimates.a_som_loi * 10) / 10
  const maxOM = Math.round(carbonEstimates.b_som_potential * 10) / 10
  const rawCO2eq = Math.max(carbonEstimates.b_c_delta, 0) * 3.67
  const potentialCO2eq = Math.round(rawCO2eq * 10) / 10

  // Derived values
  const percentageOfMax =
    carbonEstimates.b_som_potential > 0
      ? Math.min((carbonEstimates.a_som_loi / carbonEstimates.b_som_potential) * 100, 100)
      : 0

  // Impact calculations (use raw unrounded CO2eq to avoid compounding errors)
  const carKmEquivalent = Math.round(rawCO2eq * 8000)
  const extraWaterStorage = carbonEstimates.extraWaterStorage
  const extraNMineralization = carbonEstimates.extraNMineralization

  // Euro estimate based on raw CO2eq
  const euroEstimate = Math.round(rawCO2eq * 75)

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
                <button
                  type="button"
                  aria-label="Meer informatie over koolstofvastlegging"
                  className="cursor-help"
                >
                  <HelpCircle className="text-muted-foreground h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Inzicht in de huidige geschatte koolstofvoorraad en het potentieel om extra CO₂
                  vast te leggen in de bovenste 30cm van de bodem.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>Hoeveel koolstof kan dit perceel opslaan in de bodem?</CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Visual Progress Section */}
        <div className="space-y-3">
          <div className="text-muted-foreground flex justify-between text-sm font-medium">
            <span>Huidig vs. fysieke bovengrens</span>
            <span>{Math.round(percentageOfMax)}% t.o.v. bovengrens</span>
          </div>
          <Progress value={percentageOfMax} className="h-2" />
          <div className="text-muted-foreground flex justify-between text-xs font-medium">
            <span>Huidig: {currentOM}% OS</span>
            <span>Fysieke bovengrens: {maxOM}% OS</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-3">
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium uppercase">
              Voorraad
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold">
                {Math.round(carbonEstimates.b_c_st03 * 10) / 10}
              </span>
              <span className="text-muted-foreground text-xs">ton C/ha</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium uppercase">
              Potentieel
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold">
                {Math.round(carbonEstimates.b_c_st03_potential * 10) / 10}
              </span>
              <span className="text-muted-foreground text-xs">ton C/ha</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium uppercase">
              CO₂-vastlegging
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold">+{potentialCO2eq}</span>
              <span className="text-muted-foreground text-xs">ton CO₂eq/ha</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Relatable Impact Grid */}
        <div className="space-y-4">
          <h4 className="text-muted-foreground text-xs font-bold">
            Potentiële voordelen bij maximale opslag (per hectare)
          </h4>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Car className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">~{carKmEquivalent.toLocaleString()} km</p>
                <p className="text-muted-foreground text-xs">Compensatie uitstoot personenauto</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Droplets className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">+{extraWaterStorage} mm water</p>
                <p className="text-muted-foreground text-xs">Extra waterbergend vermogen</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sprout className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">+{extraNMineralization} kg N/jaar</p>
                <p className="text-muted-foreground text-xs">Extra stikstoflevering uit de bodem</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Euro className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">~€ {euroEstimate.toLocaleString()}</p>
                <p className="text-muted-foreground text-xs">
                  Geschatte waarde koolstofcertificaten via EU ETS
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Methodology Collapsible */}
        <Collapsible className="space-y-2">
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase transition-colors">
            Toelichting
            <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="bg-muted/50 text-muted-foreground space-y-2 rounded-lg border p-4 text-xs leading-relaxed">
            <p>
              Het huidige organische stofgehalte is geschat met{" "}
              <span className="text-foreground/80 font-medium">NMI BodemSchat</span>.
            </p>
            <p>
              De <strong>fysieke bovengrens</strong> (maximale OS) is gebaseerd op een{" "}
              <span className="text-foreground/80 font-medium">NMI-studie</span> en geeft aan
              hoeveel organische stof de bodem fysiek kan binden, rekening houdend met de textuur en
              andere bodemparameters. Het realiseren hiervan is een lange-termijn opgave.
            </p>
            <p>
              De getoonde voordelen voor water en stikstof zijn berekend met behulp van de continue
              pedotransferfuncties van Wösten et al. (1999) en het MINIP-model.
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
        <Skeleton className="mb-2 h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Separator />
        <div className="space-y-4">
          <Skeleton className="h-4 w-1/2" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
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
