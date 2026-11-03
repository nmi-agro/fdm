import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { formatLongTermYears, formatNumberNl, PHOSPHATE_UNIT } from "./phosphate-format"

/** One figure of the balance card. */
function Figure({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string
  value: string
  note?: string
  emphasis?: boolean
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={emphasis ? "text-2xl font-bold" : "text-lg font-semibold"}>{value}</p>
      {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
    </div>
  )
}

/**
 * Card with the phosphate balance of a field, farm or organisation: the saldo, supply, removal and
 * leaching of the selected year, the long-term average saldo used for the trend, and the chart.
 *
 * @param description - Short description under the title.
 * @param year - The selected calendar year (label of the saldo).
 * @param balance - Saldo of the year (kg P₂O₅ / ha).
 * @param supply - Supply of the year (kg P₂O₅ / ha).
 * @param removal - Removal of the year (kg P₂O₅ / ha, negative).
 * @param leaching - Leaching of the year (kg P₂O₅ / ha, negative; not in the saldo).
 * @param longTerm - Long-term average saldo and its years, or `null` (e.g. farm level).
 * @param children - The chart.
 */
export function PhosphateBalanceCard({
  description,
  year,
  balance,
  supply,
  removal,
  leaching,
  longTerm,
  children,
}: {
  description: string
  year: string
  balance: number
  supply: number
  removal: number
  leaching: number
  longTerm: { balance: number; years?: number[] } | null
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Balans</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Figure
            label={`Saldo ${year}`}
            value={formatNumberNl(balance)}
            note={PHOSPHATE_UNIT}
            emphasis
          />
          <Figure label="Aanvoer" value={formatNumberNl(supply)} note={PHOSPHATE_UNIT} />
          <Figure label="Afvoer" value={formatNumberNl(removal)} note={PHOSPHATE_UNIT} />
          <Figure
            label="Uitspoeling"
            value={formatNumberNl(leaching, 1)}
            note="schatting, niet in saldo"
          />
        </div>
        {longTerm ? (
          <p className="text-muted-foreground text-sm">
            Gemiddeld saldo
            {longTerm.years && longTerm.years.length > 0
              ? ` ${formatLongTermYears(longTerm.years)}`
              : " van de afgelopen jaren"}
            :{" "}
            <span className="text-foreground font-semibold">
              {formatNumberNl(longTerm.balance)} {PHOSPHATE_UNIT} per jaar
            </span>
            . Dit gemiddelde wordt gebruikt voor de trend van de bodem.
          </p>
        ) : null}
        <div className="-ml-4">{children}</div>
      </CardContent>
    </Card>
  )
}
