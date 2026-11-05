import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader } from "~/components/ui/card"
import { formatNumberNl, PHOSPHATE_UNIT } from "./phosphate-format"
import { PhosphateCardHeading } from "./phosphate-soil"

/** A labelled figure in the header of the balance card. */
function Figure({
  label,
  value,
  digits = 0,
  emphasis = false,
  perYear = false,
}: {
  label: string
  value: number
  digits?: number
  emphasis?: boolean
  perYear?: boolean
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={
          emphasis ? "text-2xl font-bold tabular-nums" : "text-lg font-semibold tabular-nums"
        }
      >
        {formatNumberNl(value, digits)}{" "}
        <span className="text-muted-foreground text-sm font-normal">
          {PHOSPHATE_UNIT}
          {perYear ? " per jaar" : ""}
        </span>
      </p>
    </div>
  )
}

/**
 * Card with the phosphate balance of a field, farm or organisation. When the long-term average
 * balance is given it comes first: it drives the trend and the status, while the saldo of one year
 * says little about the soil stock. Then the saldo of the selected year, the estimated leaching
 * (not part of the saldo), optional supply and removal, and the chart.
 *
 * @param year - The selected calendar year (label of the saldo).
 * @param balance - Saldo of the year (kg P₂O₅ / ha).
 * @param leaching - Leaching of the year (kg P₂O₅ / ha, negative; not in the saldo).
 * @param longTerm - Optional long-term average balance (kg P₂O₅ / ha / year) and its years.
 * @param supply - Optional supply of the year (kg P₂O₅ / ha).
 * @param removal - Optional removal of the year (kg P₂O₅ / ha, negative).
 * @param description - Optional text under the title.
 * @param children - The chart (and optional notes).
 */
export function PhosphateBalanceCard({
  year,
  balance,
  leaching,
  longTerm,
  supply,
  removal,
  description,
  children,
}: {
  year: string
  balance: number
  leaching: number
  longTerm?: { balance: number; years: string }
  supply?: number
  removal?: number
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="space-y-1.5 pb-2">
        <PhosphateCardHeading>Balans</PhosphateCardHeading>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          {longTerm ? (
            <Figure
              label={`Gemiddelde balans${longTerm.years ? ` ${longTerm.years}` : ""}, bepaalt de trend`}
              value={longTerm.balance}
              emphasis
              perYear
            />
          ) : null}
          <Figure label={`Balans ${year}`} value={balance} emphasis={!longTerm} />
          {supply !== undefined ? <Figure label="Aanvoer" value={supply} /> : null}
          {removal !== undefined ? <Figure label="Afvoer" value={removal} /> : null}
          <Figure label="Uitspoeling (schatting, niet in de balans)" value={leaching} digits={1} />
        </div>
        <div className="-ml-4">{children}</div>
      </CardContent>
    </Card>
  )
}
