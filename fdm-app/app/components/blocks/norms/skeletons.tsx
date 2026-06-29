import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"

export function FarmNormsSkeleton() {
  return (
    <div className="mb-0 animate-pulse">
      <h2 className="bg-muted mb-4 h-8 w-48 rounded" aria-label="Loading farm norms" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="bg-muted h-4 w-24 rounded" />
          </CardHeader>
          <CardContent>
            <div className="bg-muted h-8 w-32 rounded" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="bg-muted h-4 w-24 rounded" />
          </CardHeader>
          <CardContent>
            <div className="bg-muted h-8 w-32 rounded" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="bg-muted h-4 w-48 rounded" />
          </CardHeader>
          <CardContent>
            <div className="bg-muted h-8 w-32 rounded" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function FieldNormsSkeleton() {
  return (
    <div className="animate-pulse">
      <h2 className="bg-muted mb-6 h-8 w-48 rounded" aria-label="Loading field norms" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card
            key={`field-norm-skeleton-${i}`}
            className="border-gray-200 transition-shadow hover:shadow-md"
          >
            <CardHeader>
              <div>
                <CardTitle className="bg-muted h-6 w-3/4 rounded" />
                <CardDescription className="bg-muted mt-2 h-4 w-1/2 rounded" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div>
                  <p className="bg-muted h-4 w-24 rounded" />
                  <p className="bg-muted mt-1 h-3 w-32 rounded" />
                </div>
                <div className="text-right">
                  <p className="bg-muted h-6 w-24 rounded" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div>
                  <p className="bg-muted h-4 w-24 rounded" />
                  <p className="bg-muted mt-1 h-3 w-32 rounded" />
                </div>
                <div className="text-right">
                  <p className="bg-muted h-6 w-24 rounded" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div>
                  <p className="bg-muted h-4 w-48 rounded" />
                  <p className="bg-muted mt-1 h-3 w-32 rounded" />
                </div>
                <div className="text-right">
                  <p className="bg-muted h-6 w-24 rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function NormsFallback() {
  return (
    <div className="space-y-6 px-10 pb-16">
      <FarmNormsSkeleton />
      <Separator className="my-8" />
      <FieldNormsSkeleton />
    </div>
  )
}
