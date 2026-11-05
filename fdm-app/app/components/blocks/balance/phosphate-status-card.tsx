import type { ReactNode } from "react"
import {
  PHOSPHATE_STATUS_RULES,
  type PhosphateBalanceField,
  type PhosphateStatus,
} from "@nmi-agro/fdm-calculator/browser"
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info, TriangleAlert } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
  formatLongTermYears,
  formatNumberNl,
  formatPAlLevel,
  formatPhosphateAim,
  formatYearsBand,
  formatYearsClass,
  getPhosphateAdvice,
  getPhosphateIndicativeReason,
  getPhosphateStatus,
  P_AL_HIGH,
  P_AL_LOW,
} from "./phosphate-format"
import { PhosphateVerdictBadge } from "./phosphate-soil"

/** One of the three facts: where, which way, how long. */
function Fact({ title, value, note }: { title: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-muted-foreground text-xs uppercase">{title}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
      {note ? <dd className="text-muted-foreground mt-0.5 text-xs">{note}</dd> : null}
    </div>
  )
}

const DIRECTION = {
  up: { Icon: ArrowUpRight, label: "Stijgt" },
  down: { Icon: ArrowDownRight, label: "Daalt" },
  stable: { Icon: ArrowRight, label: "Stabiel" },
} as const

/** The edge (with margin) the "how long" refers to, in Dutch, e.g. "tot PSD 22 % (grens + 2)". */
function describeEdge(balance: PhosphateBalanceField, status: PhosphateStatus): string | null {
  const R = PHOSPHATE_STATUS_RULES
  const threshold = balance.projection?.psd?.threshold.value ?? null
  const upper =
    status.aim === "afbouwen" || (status.aim === "onderhouden" && status.direction === "up")
  if (status.binding === "psd" && threshold !== null) {
    return `tot PSD ${formatNumberNl(threshold + R.psd_margin)} % (grens + marge ${R.psd_margin})`
  }
  if (status.binding === "p_al") {
    return upper
      ? `tot P-AL ${P_AL_HIGH + R.p_al_margin} (${P_AL_HIGH} + marge ${R.p_al_margin})`
      : `tot P-AL ${P_AL_LOW - R.p_al_margin} (${P_AL_LOW} − marge ${R.p_al_margin})`
  }
  return null
}

/**
 * Status of the soil phosphorus of a field, the headline of the field page: the verdict, the aim
 * (opbouwen / onderhouden / afbouwen, and which indicator sets it), the advice, and three facts:
 * where the field is, which way the long-term average balance moves it and how long it takes.
 *
 * When the advice needs more fertilizer than the phosphate application standard of the field, a
 * warning says that the legal limit is lower (the standard applies at farm level).
 *
 * @param balance - The phosphate balance of the field.
 * @param phosphateNorm - The phosphate application standard of the field (kg P₂O₅ / ha), or `null`
 *   when not available for the year.
 */
export function PhosphateStatusCard({
  balance,
  phosphateNorm,
}: {
  balance: PhosphateBalanceField
  phosphateNorm: number | null
}) {
  const status = getPhosphateStatus(balance)
  const advice = getPhosphateAdvice(balance, status)
  const indicative = getPhosphateIndicativeReason(balance, status)
  const projection = balance.projection
  const psd = projection?.psd ?? null
  const pAl = projection?.p_al?.current ?? null
  const showPsd = psd !== null && psd.threshold.value !== null && balance.saturation.psd_valid
  const needed = status.balance_needed
  const aboveNorm = needed !== null && phosphateNorm !== null && needed.fertilizers > phosphateNorm
  const direction = DIRECTION[status.direction]
  const inside = status.aim === "onderhouden" && !status.conflict
  const yearsValue =
    status.verdict === "unknown"
      ? "–"
      : inside && status.years === null
        ? `> ${PHOSPHATE_STATUS_RULES.stay_horizon} jaar`
        : (formatYearsBand(status.years) ?? formatYearsClass(status.years_class))
  const longTermYears = formatLongTermYears(balance.long_term.years)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Fosfaattoestand</CardTitle>
          <CardDescription>{formatPhosphateAim(status)}</CardDescription>
        </div>
        <PhosphateVerdictBadge verdict={status.verdict} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 text-sm">
          <p className="font-medium">{advice.diagnosis}</p>
          {advice.action ? <p>{advice.action}</p> : null}
          {advice.notes.map((note) => (
            <p key={note} className="text-muted-foreground">
              {note}
            </p>
          ))}
          {aboveNorm && needed ? (
            <p className="flex items-start gap-2 text-amber-700">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Daarvoor is gemiddeld circa {formatNumberNl(needed.fertilizers)} kg P₂O₅/ha per jaar
                aan meststoffen nodig. De fosfaatgebruiksnorm van dit perceel is lager (
                {formatNumberNl(phosphateNorm)} kg P₂O₅/ha); de norm geldt op bedrijfsniveau.
              </span>
            </p>
          ) : null}
        </div>
        {status.verdict !== "unknown" ? (
          <dl className="grid gap-3 sm:grid-cols-3">
            <Fact
              title="Waar sta je"
              value={
                showPsd && psd
                  ? `PSD ${formatNumberNl(psd.current.value)} % · grens ${formatNumberNl(psd.threshold.value)} %`
                  : pAl !== null
                    ? `P-AL ${formatNumberNl(pAl)}`
                    : "–"
              }
              note={
                pAl !== null
                  ? `P-AL ${formatNumberNl(pAl)}: ${formatPAlLevel(pAl).toLowerCase()}`
                  : undefined
              }
            />
            <Fact
              title="Welke kant"
              value={
                <span className="inline-flex items-center gap-1">
                  <direction.Icon className="size-4" aria-hidden="true" />
                  {direction.label}
                </span>
              }
              note={
                projection
                  ? `Gemiddeld saldo ${formatNumberNl(balance.long_term.balance)}${longTermYears ? ` (${longTermYears})` : ""}; na vastlegging en uitspoeling ${formatNumberNl(projection.balance_effective_per_year)} kg P₂O₅/ha per jaar`
                  : undefined
              }
            />
            <Fact
              title={inside ? "In de streefzone" : "Tot het doel"}
              value={yearsValue}
              note={describeEdge(balance, status) ?? undefined}
            />
          </dl>
        ) : null}
        {indicative ? (
          <p className="text-muted-foreground flex items-start gap-2 text-xs">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>Indicatief: {indicative}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
