import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { formatNumberNl, PHOSPHATE_UNIT } from "./phosphate-format"

/**
 * Card with the phosphate balance of a field, farm or organisation: only the saldo of the selected
 * year, the estimated leaching and the chart. The terms are in the chart and in "Posten".
 *
 * @param year - The selected calendar year (label of the saldo).
 * @param balance - Saldo of the year (kg P₂O₅ / ha).
 * @param leaching - Leaching of the year (kg P₂O₅ / ha, negative; not in the saldo).
 * @param children - The chart (and optional notes).
 */
export function PhosphateBalanceCard({
  year,
  balance,
  leaching,
  children,
}: {
  year: string
  balance: number
  leaching: number
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Balans</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <p className="text-muted-foreground text-xs">Saldo {year}</p>
            <p className="text-2xl font-bold">
              {formatNumberNl(balance)}{" "}
              <span className="text-muted-foreground text-sm font-normal">{PHOSPHATE_UNIT}</span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Uitspoeling (schatting, niet in saldo)</p>
            <p className="text-lg font-semibold">
              {formatNumberNl(leaching, 1)}{" "}
              <span className="text-muted-foreground text-sm font-normal">{PHOSPHATE_UNIT}</span>
            </p>
          </div>
        </div>
        <div className="-ml-4">{children}</div>
      </CardContent>
    </Card>
  )
}
