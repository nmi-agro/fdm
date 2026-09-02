import type { Dose } from "@nmi-agro/fdm-calculator"
import type { FertilizerApplication } from "@nmi-agro/fdm-core"
import { ArrowDownToLine, Gauge, Leaf, Sprout } from "lucide-react"
import { useNavigation } from "react-router"
import { computeAdviceProgress } from "~/components/blocks/nutrient-advice/progress-bar"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardFooter } from "~/components/ui/card"
import { Spinner } from "~/components/ui/spinner"
import type { NutrientDescription } from "./types"

/**
 * Props for the NutrientKPICardForTotalApplications component.
 * @param doses - The applied doses of the nutrient.
 * @param fertilizerApplications - The list of fertilizer applications.
 */
export type NutrientKPICardForTotalApplicationsProps = {
  doses: {
    dose: Record<string, number>
    applications: Dose[]
  }
  fertilizerApplications: FertilizerApplication[]
}

/**
 * A card that displays the total number of fertilizer applications.
 * @param props - The props for the component.
 */
export function NutrientKPICardForTotalApplications({
  doses,
  fertilizerApplications,
}: NutrientKPICardForTotalApplicationsProps) {
  const navigation = useNavigation()
  const numberOfFertilizerApplications = fertilizerApplications.length
  const numberOfNutrientsApplied = Object.values(doses.dose).filter((value) => value > 0).length
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Aantal bemestingen</span>
            </div>
            <p className="text-2xl font-bold">
              {navigation.state !== "loading" ? numberOfFertilizerApplications : <Spinner />}
            </p>
            {navigation.state !== "loading" ? (
              <p className="text-muted-foreground text-xs">
                {numberOfNutrientsApplied === 1
                  ? `Voor ${numberOfNutrientsApplied} nutriënt`
                  : `Voor ${numberOfNutrientsApplied} nutriënten`}
              </p>
            ) : null}
          </div>
          <div className="bg-primary/10 rounded-full p-3">
            <ArrowDownToLine className="text-primary h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Props for the NutrientKPICardForNutrientDeficit component.
 * @param descriptions - The descriptions of the nutrients.
 * @param advices - The recommended amounts of the nutrients.
 * @param doses - The applied doses of the nutrients.
 */
export type NutrientKPICardForNutrientDeficitProps = {
  descriptions: NutrientDescription[]
  advices: Record<string, number>
  doses: {
    dose: Record<string, number>
    applications: Dose[]
  }
}

/**
 * A card that displays the nutrients that are in deficit.
 * @param props - The props for the component.
 */
export function NutrientKPICardForNutrientDeficit({
  descriptions,
  advices,
  doses,
}: NutrientKPICardForNutrientDeficitProps) {
  const navigation = useNavigation()

  const deficitNutrients = descriptions
    .map((nutrient: NutrientDescription) => {
      const dose = doses.dose[nutrient.doseParameter] ?? 0
      const advice = advices[nutrient.adviceParameter] ?? 0
      const { status } = computeAdviceProgress(dose, advice, nutrient.symbol === "EOC")
      return status === "under" ? nutrient.symbol : null
    })
    .filter((x) => x !== null)

  const hasDeficit = deficitNutrients.length > 0

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Gauge className="text-muted-foreground h-4 w-4" />
              <span className="text-sm font-medium">Risico voor opbrengst</span>
            </div>
            <p className="text-2xl font-bold">
              {navigation.state !== "loading" ? deficitNutrients.length : <Spinner />}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {navigation.state !== "loading"
                ? deficitNutrients.map((symbol) => (
                    <Badge key={symbol} variant="outline" className="text-xs">
                      {symbol}
                    </Badge>
                  ))
                : null}
            </div>
          </div>
          <div
            className={
              navigation.state === "loading"
                ? "rounded-full bg-black/10 p-3"
                : hasDeficit
                  ? "rounded-full bg-red-500/10 p-3"
                  : "rounded-full bg-green-500/10 p-3"
            }
          >
            <Sprout
              className={
                navigation.state === "loading"
                  ? "h-6 w-6 text-black"
                  : hasDeficit
                    ? "h-6 w-6 text-red-500"
                    : "h-6 w-6 text-green-500"
              }
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground text-sm">
        {hasDeficit
          ? "Minder geven dan geadviseerd kan leiden tot opbrengstverlies"
          : "Geen nutriënten onder advies"}
      </CardFooter>
    </Card>
  )
}

/**
 * Props for the NutrientKPICardForNutrientExcess component.
 * @param descriptions - The descriptions of the nutrients.
 * @param advices - The recommended amounts of the nutrients.
 * @param doses - The applied doses of the nutrients.
 */
export type NutrientKPICardForNutrientExcessProps = {
  descriptions: NutrientDescription[]
  advices: Record<string, number>
  doses: {
    dose: Record<string, number>
    applications: Dose[]
  }
}

/**
 * A card that displays the nutrients that are in excess.
 * @param props - The props for the component.
 */
export function NutrientKPICardForNutrientExcess({
  descriptions,
  advices,
  doses,
}: NutrientKPICardForNutrientExcessProps) {
  const navigation = useNavigation()

  const excessNutrients = descriptions
    .map((nutrient: NutrientDescription) => {
      const dose = doses.dose[nutrient.doseParameter] ?? 0
      const advice = advices[nutrient.adviceParameter] ?? 0
      const { status } = computeAdviceProgress(dose, advice, nutrient.symbol === "EOC")
      return status === "over" ? nutrient.symbol : null
    })
    .filter((x) => x !== null)

  const hasExcess = excessNutrients.length > 0

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Gauge className="text-muted-foreground h-4 w-4" />
              <span className="text-sm font-medium">Risico voor milieu</span>
            </div>
            <p className="text-2xl font-bold">
              {navigation.state !== "loading" ? excessNutrients.length : <Spinner />}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {navigation.state !== "loading"
                ? excessNutrients.map((symbol) => (
                    <Badge key={symbol} variant="outline" className="text-xs">
                      {symbol}
                    </Badge>
                  ))
                : null}
            </div>
          </div>
          <div
            className={
              navigation.state === "loading"
                ? "rounded-full bg-black/10 p-3"
                : hasExcess
                  ? "rounded-full bg-orange-500/10 p-3"
                  : "rounded-full bg-green-500/10 p-3"
            }
          >
            <Leaf
              className={
                navigation.state === "loading"
                  ? "h-6 w-6 text-black"
                  : hasExcess
                    ? "h-6 w-6 text-orange-500"
                    : "h-6 w-6 text-green-500"
              }
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground text-sm">
        {hasExcess
          ? "Meer geven dan geadviseerd kan leiden tot verlies naar milieu"
          : "Geen nutriënten boven advies"}
      </CardFooter>
    </Card>
  )
}
