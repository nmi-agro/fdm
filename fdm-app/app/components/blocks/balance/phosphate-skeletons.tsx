import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

/** Skeleton of a soil indicator card (PSD or P-AL): title, purpose line, rows, chart, note. */
function SoilCardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2 pb-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={`soil-row-${i}`} className="flex justify-between gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-3 w-full" />
      </CardContent>
    </Card>
  )
}

/** Skeleton of the balance card: the figures in a row and the chart. */
function BalanceCardSkeleton({ figures = 2 }: { figures?: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-20" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          {[...Array(figures)].map((_, i) => (
            <div key={`figure-${i}`} className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </CardContent>
    </Card>
  )
}

/**
 * Loading state of the phosphate field page, in the layout of the page: the status card (zone strip
 * and three facts), the PSD and P-AL cards side by side, what to do, then the balance and its terms.
 */
export function PhosphateFieldFallback() {
  return (
    <div
      className="@container/soil space-y-4"
      aria-busy="true"
      aria-label="Fosfaatbalans wordt berekend"
    >
      <Card className="@container/status">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-6 w-24 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="grid gap-4 @2xl/status:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={`fact-${i}`} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 @3xl/soil:grid-cols-2">
        <SoilCardSkeleton />
        <SoilCardSkeleton />
      </div>
      <Card>
        <CardHeader className="space-y-2 pb-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </CardContent>
      </Card>
      <div className="grid gap-4 @3xl/soil:grid-cols-2">
        <BalanceCardSkeleton figures={3} />
        <Card className="self-start">
          <CardHeader>
            <Skeleton className="h-6 w-20" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={`term-${i}`} className="flex justify-between border-b pb-4">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-4" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Loading state of the phosphate farm page, in the layout of the page: the area per verdict and the
 * two saldo cards, then the fields (most urgent first) next to the balance.
 */
export function PhosphateFarmFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Fosfaatbalans wordt berekend">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={`legend-${i}`} className="h-4 w-28" />
              ))}
            </div>
          </CardContent>
        </Card>
        {[...Array(2)].map((_, i) => (
          <Card key={`saldo-${i}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[...Array(4)].map((_, i) => (
                <div key={`field-${i}`} className="flex items-start">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="ml-4 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-3 w-64 max-w-full" />
                  </div>
                  <Skeleton className="ml-auto h-4 w-10" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="lg:col-span-3">
          <BalanceCardSkeleton figures={4} />
        </div>
      </div>
    </div>
  )
}

/**
 * Loading state of the phosphate organisation page, in the layout of the page: the balance next to
 * the farms.
 */
export function PhosphateOrganizationFallback() {
  return (
    <div
      className="grid items-start gap-4 lg:grid-cols-2"
      aria-busy="true"
      aria-label="Fosfaatbalans wordt berekend"
    >
      <BalanceCardSkeleton figures={2} />
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {[...Array(4)].map((_, i) => (
              <div key={`farm-${i}`} className="flex items-center">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="ml-4 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="ml-auto h-4 w-10" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
