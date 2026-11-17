import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"

/** Placeholder for the field page while Dyna calculates; follows the layout of the result. */
export function FieldMineralizationSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Card>
        <CardHeader className="space-y-4">
          <Skeleton className="h-5 w-56" />
          <div className="@container">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 @lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/40 flex h-80 flex-col items-center justify-center gap-2 rounded-lg">
            <Spinner className="size-5" />
            <p className="text-muted-foreground text-sm">
              De stikstof door het seizoen wordt berekend. Dit duurt meestal enkele seconden.
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  )
}
