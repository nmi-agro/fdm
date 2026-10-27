import type { PhosphateBalanceField } from "@nmi-agro/fdm-calculator"
import { CircleAlert, CircleCheck, CircleHelp, TriangleAlert } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { cn } from "~/lib/utils"
import {
  formatNumberNl,
  getPhosphateFrameStatus,
  PHOSPHATE_UNIT,
  type PhosphateFrameConformance,
} from "./phosphate-format"

const conformanceStyle: Record<
  PhosphateFrameConformance,
  { Icon: typeof CircleCheck; className: string; label: string }
> = {
  conform: {
    Icon: CircleCheck,
    className: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
    label: "Past bij het doel",
  },
  attention: {
    Icon: CircleAlert,
    className: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    label: "Aandacht",
  },
  unknown: {
    Icon: CircleHelp,
    className: "bg-muted text-muted-foreground",
    label: "Onbekend",
  },
}

/**
 * Icon for how the balance fits the frame. Always rendered with a text label (not colour alone).
 *
 * @param conformance - The conformance.
 * @param className - Extra classes.
 */
export function PhosphateConformanceIcon({
  conformance,
  className,
}: {
  conformance: PhosphateFrameConformance
  className?: string
}) {
  const { Icon, className: style, label } = conformanceStyle[conformance]
  return <Icon aria-label={label} className={cn("shrink-0 rounded-full p-0.5", style, className)} />
}

/**
 * Small inline label of the frame (icon + name), for lists.
 *
 * @param balance - The phosphate balance of the field.
 */
export function PhosphateFrameLabel({ balance }: { balance: PhosphateBalanceField }) {
  const status = getPhosphateFrameStatus(balance)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <PhosphateConformanceIcon conformance={status.conformance} className="h-4 w-4" />
      <span className="text-muted-foreground">{status.label}</span>
    </span>
  )
}

/**
 * Headline card of a field: the frame first, the balance as supporting detail.
 *
 * @param balance - The phosphate balance of the field.
 */
export function PhosphateFrameCard({ balance }: { balance: PhosphateBalanceField }) {
  const status = getPhosphateFrameStatus(balance)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-3 text-lg">
          <PhosphateConformanceIcon conformance={status.conformance} className="h-7 w-7" />
          <span>{status.headline}</span>
        </CardTitle>
        <CardDescription>{status.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          Saldo: <span className="font-semibold">{formatNumberNl(balance.balance)}</span>{" "}
          <span className="text-muted-foreground">{PHOSPHATE_UNIT}</span>
          {balance.frame.target_balance_min !== null ? (
            <span className="text-muted-foreground">
              {" "}
              (gewenst: minimaal {formatNumberNl(balance.frame.target_balance_min)})
            </span>
          ) : null}
        </p>
        {(balance.warnings ?? []).length > 0 ? (
          <ul className="space-y-1.5 pt-3">
            {balance.warnings.map((warning) => (
              <li key={warning} className="text-muted-foreground flex gap-2 text-xs">
                <TriangleAlert
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500"
                  aria-hidden
                />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
