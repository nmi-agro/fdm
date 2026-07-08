import { Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

const regionLabels = {
  klei: "Klei",
  veen: "Veen",
  loess: "Löss",
  zand_nwc: "Noordelijk, westelijk, en centraal zand",
  zand_zuid: "Zuidelijk zand",
}

export function FieldDetailsCard({
  fieldDetails,
}: {
  fieldDetails: {
    b_area: number
    regionTable2?: "klei" | "veen" | "loess" | "zand_nwc" | "zand_zuid"
    isNvGebied?: boolean
    isGWBGGebied?: boolean
    isNatura2000Area?: boolean
  }
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perceeldetails</CardTitle>
        <CardDescription className="text-muted-foreground flex items-center justify-start space-x-2 text-sm">
          <Info className="h-4 w-4" />
          <p>Status voor 2026</p>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm font-medium">Oppervlakte</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{fieldDetails.b_area}</span>
              <span className="text-muted-foreground text-sm">ha</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm font-medium">Regio (RVO Tabel 2)</p>
            <p className="text-lg font-semibold">
              {fieldDetails.regionTable2 ? regionLabels[fieldDetails.regionTable2] : "Onbekend"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t-0 pt-0 sm:grid-cols-3 sm:border-t sm:pt-4">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase">NV-Gebied</p>
            <p className="text-lg font-bold">{fieldDetails.isNvGebied ? "Ja" : "Nee"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase">
              Grondwaterbescherming
            </p>
            <p className="text-lg font-bold">{fieldDetails.isGWBGGebied ? "Ja" : "Nee"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase">Natura 2000</p>
            <p className="text-lg font-bold">{fieldDetails.isNatura2000Area ? "Ja" : "Nee"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function FieldDetailsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="mb-2 h-6 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 border-t-0 pt-0 sm:grid-cols-3 sm:border-t sm:pt-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}
