import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"

export function FarmNormsSkeleton() {
  return (
    <div className="mb-0 animate-pulse">
      <h2 className="h-8 w-48 bg-muted rounded mb-4" aria-label="Loading farm norms" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="h-4 w-24 bg-muted rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-32 bg-muted rounded" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="h-4 w-24 bg-muted rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-32 bg-muted rounded" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="h-4 w-48 bg-muted rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-32 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function FieldNormsSkeleton() {
  return (
    <div className="animate-pulse">
      <h2 className="h-8 w-48 bg-muted rounded mb-6" aria-label="Loading field norms" />
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card
            key={`field-norm-skeleton-${i}`}
            className="hover:shadow-md transition-shadow border-gray-200"
          >
            <CardHeader>
              <div>
                <CardTitle className="h-6 w-3/4 bg-muted rounded" />
                <CardDescription className="h-4 w-1/2 bg-muted rounded mt-2" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="h-4 w-24 bg-muted rounded" />
                  <p className="h-3 w-32 bg-muted rounded mt-1" />
                </div>
                <div className="text-right">
                  <p className="h-6 w-24 bg-muted rounded" />
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="h-4 w-24 bg-muted rounded" />
                  <p className="h-3 w-32 bg-muted rounded mt-1" />
                </div>
                <div className="text-right">
                  <p className="h-6 w-24 bg-muted rounded" />
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="h-4 w-48 bg-muted rounded" />
                  <p className="h-3 w-32 bg-muted rounded mt-1" />
                </div>
                <div className="text-right">
                  <p className="h-6 w-24 bg-muted rounded" />
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
