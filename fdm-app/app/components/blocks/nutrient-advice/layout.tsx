import type { ReactNode } from "react"
import { Tally1, Tally2, Tally3 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"

export function FieldNutrientAdviceLayout({
  primaryNutrientsSection,
  kpiSection,
  secondaryNutrientsSection,
  traceNutrientsSection,
  headerAction,
}: {
  primaryNutrientsSection: ReactNode
  kpiSection: ReactNode
  secondaryNutrientsSection: ReactNode
  traceNutrientsSection: ReactNode
  headerAction?: ReactNode
}) {
  return (
    <div className="grid grid-cols-1 gap-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Tally1 className="h-5 w-5" />
                NPK
              </CardTitle>
              <CardDescription>
                Essentiële nutriënten voor een optimale groei en ontwikkeling van gewassen
              </CardDescription>
            </div>
            {headerAction}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">{primaryNutrientsSection}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{kpiSection}</div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tally2 className="h-5 w-5" />
            Organische stof en secondaire nutriënten
          </CardTitle>
          <CardDescription>
            Ondersteunende nutriënten die essentieel zijn voor de gezondheid van de bodem en de
            ontwikkeling van planten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">{secondaryNutrientsSection}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tally3 className="h-5 w-5" />
            Spoorelementen
          </CardTitle>
          <CardDescription>
            Essentiële micronutriënten voor een optimale gezondheid en ontwikkeling van planten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">{traceNutrientsSection}</div>
        </CardContent>
      </Card>
    </div>
  )
}
