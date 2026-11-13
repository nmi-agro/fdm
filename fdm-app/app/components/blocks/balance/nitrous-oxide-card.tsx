import { ArrowRightFromLine, Cloud } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { formatFixed } from "~/lib/format"

/**
 * Note shown at the bottom of the cards with nitrogen losses that are not part of the balance.
 */
function NotInBalanceNote() {
  return (
    <CardFooter>
      <p className="text-muted-foreground text-xs">Telt niet mee in de balans</p>
    </CardFooter>
  )
}

interface NitrateLeachingCardProps {
  /** The nitrate leaching in kg N / ha (negative). */
  nitrate: number
}

/**
 * Card with the nitrate leaching of a field or farm in kg N / ha. The nitrate leaching is part of
 * the total emission, but not of the nitrogen balance.
 */
export function NitrateLeachingCard({ nitrate }: NitrateLeachingCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Nitraatuitspoeling</CardTitle>
        <ArrowRightFromLine className="text-muted-foreground text-xs" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatFixed(nitrate)}</div>
        <p className="text-muted-foreground text-xs">kg N / ha</p>
      </CardContent>
      <NotInBalanceNote />
    </Card>
  )
}

interface NitrousOxideCardProps {
  /** The N₂O emission in kg N / ha (negative). */
  nitrousOxide: number
  /** The CO₂-equivalent of the N₂O emission in kg CO₂-eq / ha (positive). */
  co2eq: number
}

/**
 * Card with the nitrous oxide (N₂O) emission of a field or farm in kg N / ha, with the
 * CO₂-equivalent underneath. The N₂O emission is part of the total emission, but not of the
 * nitrogen balance.
 */
export function NitrousOxideCard({ nitrousOxide, co2eq }: NitrousOxideCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Lachgasemissie</CardTitle>
        <Cloud className="text-muted-foreground text-xs" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatFixed(nitrousOxide, 1)}</div>
        <p className="text-muted-foreground text-xs">kg N / ha</p>
        <p className="text-muted-foreground text-xs">
          <span>{`${formatFixed(co2eq)} kg CO₂-eq / ha`}</span>
        </p>
      </CardContent>
      <NotInBalanceNote />
    </Card>
  )
}
