import { Cloud } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

/**
 * Formats a number with Dutch separators, e.g. 1245.06 as "1.245" (0 decimals) and -2.99 as
 * "-3,0" (1 decimal, the default for the N₂O emission in kg N / ha).
 *
 * @param value - The number to format.
 * @param fractionDigits - The number of decimals.
 * @returns The formatted number.
 */
export function formatNitrousOxide(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

interface NitrousOxideCardProps {
  /** The N₂O emission in kg N / ha (negative). */
  total: number
  /** The CO₂-equivalent of the N₂O emission in kg CO₂-eq / ha (positive). */
  co2eq: number
}

/**
 * Card with the nitrous oxide (N₂O) emission of a field or farm in kg N / ha, with the
 * CO₂-equivalent underneath. The emission is an indicator and not part of the nitrogen balance.
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
          <span>{formatNitrousOxide(total)}</span>
        </div>
        <p className="text-muted-foreground text-xs">
          <span>kg N / ha</span>
        </p>
        <p className="text-muted-foreground text-xs">
          <span>{`${formatNitrousOxide(co2eq, 0)} kg CO₂-eq / ha`}</span>
        </p>
      </CardContent>
    </Card>
  )
}
