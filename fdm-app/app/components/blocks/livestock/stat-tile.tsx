import type { ReactNode } from "react"
import { Card } from "~/components/ui/card"

/**
 * A compact key figure: a label, the value and a line of detail. Used for the key figures of
 * the Melkvee overview and Weidegang, so both pages show them the same way.
 */
export function StatTile({
  label,
  value,
  detail,
}: {
  label: string
  value: ReactNode
  detail: ReactNode
}) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <p className="text-muted-foreground text-xs">{detail}</p>
    </Card>
  )
}
