import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { Separator } from "~/components/ui/separator"
import { FieldNutrientAdviceLayout } from "./layout"

export function NutrientCardSkeleton() {
  return (
    <Card className="relative animate-pulse">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted h-10 w-10 rounded-md" />
            <CardTitle className="bg-muted h-6 w-24 rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-center">
          <div className="bg-muted mx-auto h-10 w-32 rounded" />
          <div className="bg-muted mx-auto h-4 w-20 rounded" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="bg-muted h-4 w-24 rounded" />
            <span className="bg-muted h-4 w-12 rounded" />
          </div>
          <Progress value={0} className="h-3" />
        </div>
        <div className="mt-3 space-y-2">
          <Separator />
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div
                key={`skeleton-detail-${i}`}
                className="bg-muted/50 flex items-center justify-between rounded p-2"
              >
                <div className="space-y-1">
                  <p className="bg-muted h-4 w-32 rounded" />
                  <p className="bg-muted h-3 w-24 rounded" />
                </div>
                <div className="text-right">
                  <p className="bg-muted h-4 w-16 rounded" />
                  <p className="bg-muted h-3 w-12 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function NutrientAdviceFallback() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <NutrientCardSkeleton />
      <NutrientCardSkeleton />
      <NutrientCardSkeleton />
    </div>
  )
}

export function NutrientCardSkeletonRepeat({ count }: { count: number }) {
  return Array.from({ length: count }).map((_, i) => <NutrientCardSkeleton key={i} />)
}

export function FieldNutrientAdviceSkeleton({
  primaryNutrients,
  secondaryNutrients,
  traceNutrients,
}: {
  primaryNutrients: unknown[]
  secondaryNutrients: unknown[]
  traceNutrients: unknown[]
}) {
  return (
    <FieldNutrientAdviceLayout
      primaryNutrientsSection={<NutrientCardSkeletonRepeat count={primaryNutrients.length} />}
      kpiSection={<NutrientCardSkeletonRepeat count={3} />}
      secondaryNutrientsSection={<NutrientCardSkeletonRepeat count={secondaryNutrients.length} />}
      traceNutrientsSection={<NutrientCardSkeletonRepeat count={traceNutrients.length} />}
    />
  )
}
