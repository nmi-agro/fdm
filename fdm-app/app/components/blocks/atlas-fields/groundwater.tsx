import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

export function GroundwaterCard({
  groundwaterEstimates,
}: {
  groundwaterEstimates: {
    b_gwl_class?: string | null
    b_gwl_ghg?: number | null
    b_gwl_glg?: number | null
  }
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Grondwater</CardTitle>
        </div>
        <CardDescription>
          De grondwaterstanden voor dit perceel volgens BRO Grondwaterspiegeldiepte (WDM)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              Klasse
            </p>
            <p className="text-2xl font-bold">{groundwaterEstimates.b_gwl_class ?? "Onbekend"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              GHG
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">
                {groundwaterEstimates.b_gwl_ghg ?? "Onbekend"}
              </span>
              {groundwaterEstimates.b_gwl_ghg != null && (
                <span className="text-muted-foreground text-sm">cm-mv</span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              GLG
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">
                {groundwaterEstimates.b_gwl_glg ?? "Onbekend"}
              </span>
              {groundwaterEstimates.b_gwl_glg != null && (
                <span className="text-muted-foreground text-sm">cm-mv</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function GroundwaterSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="mb-2 h-6 w-1/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}
