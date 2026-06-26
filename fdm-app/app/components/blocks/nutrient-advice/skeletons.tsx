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
            <div className="h-10 w-10 bg-muted rounded-md" />
            <CardTitle className="h-6 w-24 bg-muted rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-1">
          <div className="h-10 w-32 mx-auto bg-muted rounded" />
          <div className="h-4 w-20 mx-auto bg-muted rounded" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="h-4 w-24 bg-muted rounded" />
            <span className="h-4 w-12 bg-muted rounded" />
          </div>
          <Progress value={0} className="h-3" />
        </div>
        <div className="space-y-2 mt-3">
          <Separator />
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div
                key={`skeleton-detail-${i}`}
                className="flex justify-between items-center p-2 bg-muted/50 rounded"
              >
                <div className="space-y-1">
                  <p className="h-4 w-32 bg-muted rounded" />
                  <p className="h-3 w-24 bg-muted rounded" />
                </div>
                <div className="text-right">
                  <p className="h-4 w-16 bg-muted rounded" />
                  <p className="h-3 w-12 bg-muted rounded" />
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <NutrientCardSkeleton />
      <NutrientCardSkeleton />
      <NutrientCardSkeleton />
    </div>
  )
}

export function NutrientCardSkeletonRepeat({ count }: { count: number }) {
  return Array.from({ length: count }).map((_, i) => (
    <NutrientCardSkeleton key={i} />
  ))
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
