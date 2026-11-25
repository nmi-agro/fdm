import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

/**
 * Skeleton of a soil indicator card (PSD or P-AL): title, purpose line, rows, chart, note and the
 * "Meer details" row at the bottom.
 */
function SoilCardSkeleton() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-1 pb-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={`soil-row-${i}`} className="flex justify-between gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-3 w-full" />
        <div className="mt-auto flex justify-between border-t pt-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Skeleton of the balance card: title (and description), the figures in a row with the first one
 * emphasised, and the chart.
 */
function BalanceCardSkeleton({
  figures = 2,
  description = false,
}: {
  figures?: number
  description?: boolean
}) {
  return (
    <Card>
      <CardHeader className="space-y-1.5 pb-2">
        <Skeleton className="h-5 w-16" />
        {description ? (
          <>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          {[...Array(figures)].map((_, i) => (
            <div key={`figure-${i}`} className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className={i === 0 ? "h-8 w-28" : "h-7 w-24"} />
            </div>
          ))}
        </div>
        <Skeleton className="h-44 w-full" />
      </CardContent>
    </Card>
  )
}

/**
 * Loading state of the phosphate field page, in the layout of the page: the status card (zone strip
 * and three facts), the PSD and P-AL cards side by side, the possible approach, then the balance
 * and its terms.
 */
export function PhosphateFieldFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Fosfaatbalans wordt berekend">
      <Card className="@container/status">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between space-y-0 gap-x-4 gap-y-2 pb-3">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
          <Skeleton className="h-7 w-24 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5 pt-1">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex">
              <div className="w-1/4 px-1">
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex w-1/2 justify-center px-1">
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex w-1/4 justify-end px-1">
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
          <div className="grid gap-4 @2xl/status:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={`fact-${i}`} className="space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-5 w-44 max-w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="@container/soil space-y-4">
        <div className="grid gap-4 @3xl/soil:grid-cols-2">
          <SoilCardSkeleton />
          <SoilCardSkeleton />
        </div>
        <Card className="@container/advice">
          <CardHeader className="space-y-1.5 pb-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 @2xl/advice:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <div key={`perspective-${i}`} className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t pt-4">
              <Skeleton className="h-4 w-28" />
              {[...Array(2)].map((_, i) => (
                <div key={`option-${i}`} className="flex items-start gap-3">
                  <Skeleton className="mt-0.5 size-7 shrink-0 rounded-md" />
                  <div className="w-full space-y-1.5">
                    <Skeleton className="h-4 w-48 max-w-full" />
                    <Skeleton className="h-4 w-full max-w-2xl" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 @3xl/soil:grid-cols-2">
          <BalanceCardSkeleton figures={3} />
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent>
              {[...Array(3)].map((_, i) => (
                <div key={`term-${i}`} className="flex justify-between border-b py-4">
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-4 w-4" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/**
 * Loading state of the phosphate farm page, in the layout of the page: the area per verdict, the
 * fields (a compact list on narrow cards, a table on wide ones), then the balance.
 */
export function PhosphateFarmFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Fosfaatbalans wordt berekend">
      <Card>
        <CardHeader className="space-y-1.5 pb-3">
          <Skeleton className="h-5 w-64 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={`legend-${i}`} className="h-4 w-44" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="@container/fields">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-5 w-20" />
            <div className="flex flex-wrap gap-1.5">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={`filter-${i}`} className="h-8 w-20 rounded-md" />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 @4xl/fields:hidden">
            <Skeleton className="h-9 w-full rounded-md @md/fields:w-72" />
            <div className="divide-y">
              {[...Array(4)].map((_, i) => (
                <div key={`field-item-${i}`} className="space-y-1.5 py-3">
                  <div className="flex items-start gap-2">
                    <Skeleton className="mt-0.5 size-5 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <div className="flex flex-col items-end space-y-1.5">
                      <Skeleton className="h-4 w-10" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <div className="space-y-1.5 pl-7">
                    <Skeleton className="h-4 w-64 max-w-full" />
                    <Skeleton className="h-4 w-56 max-w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden @4xl/fields:block">
            <div className="flex gap-4 border-b py-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={`head-${i}`} className="h-4 flex-1" />
              ))}
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={`field-row-${i}`} className="flex items-center gap-4 border-b py-3">
                <Skeleton className="size-5 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-24 rounded-md" />
                </div>
                {[...Array(6)].map((_, j) => (
                  <Skeleton key={`cell-${j}`} className="h-4 flex-1" />
                ))}
              </div>
            ))}
          </div>
          <Skeleton className="mt-3 h-3 w-full max-w-2xl" />
        </CardContent>
      </Card>
      <div className="@container/bottom">
        <div className="grid items-start gap-4 @3xl/bottom:grid-cols-2">
          <BalanceCardSkeleton figures={5} description />
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
          <div className="flex items-center gap-2 pb-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="ml-auto h-9 w-32 rounded-md" />
            <Skeleton className="size-9 rounded-md" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {[...Array(4)].map((_, i) => (
              <div key={`farm-${i}`} className="flex items-center">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="ml-4 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56 max-w-full" />
                </div>
                <div className="ml-auto flex flex-col items-end space-y-1.5">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-3 w-8" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
