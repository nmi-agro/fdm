import { Skeleton } from "~/components/ui/skeleton"

/**
 * Loading placeholder for the nutrient-advice overview table, shown while the
 * per-field nutrient advice/doses are calculated for the whole farm.
 */
export function NutrientAdviceOverviewSkeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-4">
      <p className="text-muted-foreground text-sm">Bemestingsadvies per perceel berekenen…</p>
      <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full sm:w-64" />
        <div className="flex gap-4">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="space-y-2 rounded-md border p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={`nutrient-advice-overview-row-${i}`} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}
