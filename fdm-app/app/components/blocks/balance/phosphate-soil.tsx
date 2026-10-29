import type { PhosphateBalanceField } from "@nmi-agro/fdm-calculator"
import type { ReactNode } from "react"
import { CircleAlert, CircleCheck, CircleX } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { cn } from "~/lib/utils"
import {
  formatNumberNl,
  getPhosphateSaturationStatus,
  getPhosphateYearsToThreshold,
  type PhosphateSaturationStatus,
} from "./phosphate-format"

/**
 * Status icon of a field, as in the nitrogen balance: a green check when the PSD is at or below
 * the threshold, a red cross when it is above, an orange alert when it is unknown.
 *
 * @param status - The saturation status.
 * @param className - Extra classes (size).
 */
export function PhosphateStatusIcon({
  status,
  className,
}: {
  status: PhosphateSaturationStatus
  className?: string
}) {
  if (status === "ok") {
    return (
      <CircleCheck
        aria-label="Fosfaatverzadiging onder de grenswaarde"
        className={cn("shrink-0 rounded-full bg-green-100 p-0 text-green-500", className)}
      />
    )
  }
  if (status === "exceeded") {
    return (
      <CircleX
        aria-label="Fosfaatverzadiging boven de grenswaarde"
        className={cn("shrink-0 rounded-full bg-red-100 p-0 text-red-500", className)}
      />
    )
  }
  return (
    <CircleAlert
      aria-label="Fosfaatverzadiging onbekend"
      className={cn("shrink-0 rounded-full bg-orange-100 p-0 text-orange-500", className)}
    />
  )
}

/** A label-value row. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

/**
 * Soil phosphate stock: P-AL now and its change per year at the current balance.
 *
 * @param balance - The phosphate balance of the field.
 */
export function PhosphateStockCard({ balance }: { balance: PhosphateBalanceField }) {
  const pAl = balance.projection?.p_al ?? null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Bodemvoorraad (P-AL)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pAl ? (
          <>
            <Row label="Nu">{formatNumberNl(pAl.current)} mg P₂O₅ / 100 g</Row>
            <Row label="Verandering bij dit saldo">
              {formatNumberNl(pAl.delta_per_year.value, 1)} per jaar
            </Row>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Geen P-AL bekend.</p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Phosphorus saturation degree (PSD): now, the field-specific threshold, the change per year and
 * the years until the threshold is crossed (the key figure).
 *
 * @param balance - The phosphate balance of the field.
 */
export function PhosphateSaturationCard({ balance }: { balance: PhosphateBalanceField }) {
  const psd = balance.projection?.psd ?? null
  const status = getPhosphateSaturationStatus(balance)
  const years = getPhosphateYearsToThreshold(balance)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Fosfaatverzadiging (PSD)</CardTitle>
        <PhosphateStatusIcon status={status} className="h-5 w-5" />
      </CardHeader>
      <CardContent className="space-y-2">
        {psd ? (
          <>
            {years ? (
              <div>
                <div className="text-2xl font-bold">{years.value}</div>
                <p className="text-muted-foreground text-xs">{years.label}</p>
              </div>
            ) : null}
            <Row label="Nu">{formatNumberNl(psd.current.value)} %</Row>
            <Row label="Grenswaarde">{formatNumberNl(psd.threshold.value)} %</Row>
            <Row label="Verandering bij dit saldo">
              {formatNumberNl(psd.delta_per_year, 1)} %-punt per jaar
            </Row>
            {balance.saturation.source === "estimated_from_p_al" ? (
              <p className="text-muted-foreground text-xs">Geschat uit P-AL: indicatief.</p>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Onvoldoende bodemgegevens voor de fosfaatverzadiging.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
