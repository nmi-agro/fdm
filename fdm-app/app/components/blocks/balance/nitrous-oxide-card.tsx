import { Cloud } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

/**
 * Formats a number with Dutch separators, e.g. 1245.06 as "1.245" and -2.99 as "-2,99".
 *
 * @param value - The number to format.
 * @param maximumFractionDigits - The maximum number of decimals.
 * @returns The formatted number.
 */
export function formatNitrousOxide(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits }).format(value)
}

interface NitrousOxideCardProps {
  /** The N₂O emission in kg N₂O-N / ha (negative). */
  total: number
  /** The CO₂-equivalent of the N₂O emission in kg CO₂-eq / ha (positive). */
  co2eq: number
}

/**
 * Card with the nitrous oxide (N₂O) emission of a field or farm, shown as CO₂-equivalent with the
 * N₂O emission underneath. The emission is an indicator and not part of the nitrogen balance.
 */
export function NitrousOxideCard({ total, co2eq }: NitrousOxideCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Lachgasemissie</CardTitle>
        <Cloud className="text-muted-foreground text-xs" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          <span>{formatNitrousOxide(co2eq, 0)}</span>
        </div>
        <p className="text-muted-foreground text-xs">
          <span>kg CO₂-eq / ha</span>
        </p>
        <p className="text-muted-foreground text-xs">
          <span>{`${formatNitrousOxide(total)} kg N₂O-N / ha`}</span>
        </p>
      </CardContent>
    </Card>
  )
}
