import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

export function NitrogenBalanceCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="h-4 w-24 bg-muted rounded" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-32 bg-muted rounded" />
        <p className="h-3 w-20 bg-muted rounded mt-2" />
      </CardContent>
    </Card>
  )
}

export function NitrogenBalanceChartSkeleton() {
  return (
    <Card className="col-span-4 animate-pulse">
      <CardHeader>
        <CardTitle className="h-6 w-32 bg-muted rounded" />
        <CardDescription className="h-4 w-full bg-muted rounded mt-2" />
        <CardDescription className="h-4 w-full bg-muted rounded mt-1" />
        <CardDescription className="h-4 w-full bg-muted rounded mt-1" />
      </CardHeader>
      <CardContent className="pl-2">
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  )
}

export function NitrogenBalanceFieldsSkeleton() {
  return (
    <Card className="col-span-3 animate-pulse">
      <CardHeader>
        <CardTitle className="h-6 w-32 bg-muted rounded" />
        <CardDescription className="h-4 w-full bg-muted rounded mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {[...Array(4)].map((_, i) => (
            <div key={`field-balance-skeleton-${i}`} className="flex items-center">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="ml-4 space-y-1">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-3 w-[150px]" />
              </div>
              <div className="ml-auto">
                <Skeleton className="h-4 w-[50px]" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function NitrogenBalanceFallback() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <NitrogenBalanceCardSkeleton />
        <NitrogenBalanceCardSkeleton />
        <NitrogenBalanceCardSkeleton />
        <NitrogenBalanceCardSkeleton />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <NitrogenBalanceChartSkeleton />
        <NitrogenBalanceFieldsSkeleton />
      </div>
    </div>
  )
}
