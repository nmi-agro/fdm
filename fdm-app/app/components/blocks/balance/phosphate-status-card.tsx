import type { ReactNode } from "react"
import {
  PHOSPHATE_STATUS_RULES,
  type PhosphateBalanceField,
  type PhosphateStatus,
} from "@nmi-agro/fdm-calculator/browser"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Droplets,
  FlaskConical,
  Info,
  MessagesSquare,
  Sprout,
  Tractor,
  TriangleAlert,
  Wheat,
} from "lucide-react"
import { NavLink } from "react-router"
import { Card, CardContent, CardDescription, CardHeader } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { cn } from "~/lib/utils"
import {
  describePhosphateDirection,
  formatLongTermRange,
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
  PHOSPHATE_UNIT,
} from "./phosphate-format"
import { PhosphateCardHeading, PhosphateVerdictBadge } from "./phosphate-soil"

/** Links to the pages where the data behind the balance can be completed. */
export type PhosphateDataLinks = {
  soil: string
  fertilizer: string
  cultivation: string
}

/** One of the three facts: where, which way, how long. */
function Fact({ title, value, note }: { title: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="space-y-1 @2xl/status:px-4 @2xl/status:first:pl-0 @2xl/status:last:pr-0">
      <dt className="text-muted-foreground text-xs">{title}</dt>
      <dd className="text-base font-semibold">{value}</dd>
      {note ? <dd className="text-muted-foreground text-xs">{note}</dd> : null}
    </div>
  )
}

/** Keeps a fraction inside a segment, away from its edges so the marker stays readable. */
function within(value: number, low = 0.08, high = 0.92): number {
  return Math.min(high, Math.max(low, value))
}

/**
 * The target zone as one picture: building up (below P-AL 25), the target zone, and reducing (above
 * the PSD threshold, or P-AL 45 without a usable PSD), with the field's position and the direction
 * of its long-term average balance. Schematic: the three parts are not to scale.
 *
 * @param balance - The phosphate balance of the field.
 * @param status - Its status.
 */
function PhosphateZoneStrip({
  balance,
  status,
}: {
  balance: PhosphateBalanceField
  status: PhosphateStatus
}) {
  const psd = balance.projection?.psd ?? null
  const threshold = psd?.threshold.value ?? null
  const pAl = balance.projection?.p_al?.current ?? null
  const usePsd = psd !== null && threshold !== null && balance.saturation.psd_valid
  const direction = describePhosphateDirection(status)

  // Position on the strip (0–1): 0–0.25 building up, 0.25–0.75 the zone, 0.75–1 reducing
  let segment: "below" | "zone" | "above" = "zone"
  let position = 0.5
  if (usePsd && psd && threshold !== null && psd.current.value > threshold) {
    segment = "above"
    position = 0.75 + 0.25 * within((psd.current.value - threshold) / threshold)
  } else if (pAl !== null && pAl < P_AL_LOW) {
    segment = "below"
    position = 0.25 * within(pAl / P_AL_LOW)
  } else if (!usePsd && pAl !== null && pAl > P_AL_HIGH) {
    segment = "above"
    position = 0.75 + 0.25 * within((pAl - P_AL_HIGH) / P_AL_HIGH)
  } else if (usePsd && psd && threshold !== null) {
    position = 0.25 + 0.5 * within(psd.current.value / threshold, 0.05, 0.95)
  } else if (pAl !== null) {
    position = 0.25 + 0.5 * within((pAl - P_AL_LOW) / (P_AL_HIGH - P_AL_LOW), 0.05, 0.95)
  }

  const parts = [
    { key: "below", label: "Opbouwen", sub: `P-AL < ${P_AL_LOW}`, width: "25%" },
    {
      key: "zone",
      label: "Streefzone",
      sub: usePsd
        ? `P-AL ≥ ${P_AL_LOW} en PSD ≤ ${formatNumberNl(threshold)} %`
        : `P-AL ${P_AL_LOW}–${P_AL_HIGH}`,
      width: "50%",
    },
    {
      key: "above",
      label: "Afbouwen",
      sub: usePsd ? `PSD > ${formatNumberNl(threshold)} %` : `P-AL > ${P_AL_HIGH}`,
      width: "25%",
    },
  ] as const
  const segmentName = parts.find((p) => p.key === segment)?.label.toLowerCase()
  const Arrow =
    status.direction === "up" ? ArrowRight : status.direction === "down" ? ArrowLeft : null
  const arrowColour =
    direction.tone === "toward"
      ? "text-green-700"
      : direction.tone === "away"
        ? "text-red-700"
        : "text-foreground"

  return (
    <div
      role="img"
      aria-label={`Positie: ${segmentName}. ${direction.verb}${direction.meaning ? `, ${direction.meaning}` : ""}.`}
      className="space-y-1.5"
    >
      <div className="relative pt-1">
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          <div className="bg-muted h-full" style={{ width: "25%" }} />
          <div className="h-full bg-green-200" style={{ width: "50%" }} />
          <div className="bg-muted h-full" style={{ width: "25%" }} />
        </div>
        <div
          className="absolute top-0 flex -translate-x-1/2 items-center"
          style={{ left: `${position * 100}%` }}
        >
          <span className="bg-foreground ring-background block h-5 w-1.5 rounded-full ring-2" />
          {Arrow ? (
            <Arrow
              className={cn(
                "absolute size-4",
                status.direction === "up" ? "left-3" : "right-3",
                arrowColour,
              )}
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>
      <div className="flex w-full text-xs">
        {parts.map((part) => (
          <div
            key={part.key}
            style={{ width: part.width }}
            className={cn(
              "px-1",
              part.key === "zone" && "text-center",
              part.key === "above" && "text-right",
            )}
          >
            <p
              className={cn(
                "font-medium",
                part.key === segment ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {part.label}
            </p>
            <p className="text-muted-foreground hidden @xl/status:block">{part.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The edge (with margin) the "how long" refers to, in Dutch. */
function describeEdge(balance: PhosphateBalanceField, status: PhosphateStatus): string | null {
  const R = PHOSPHATE_STATUS_RULES
  const threshold = balance.projection?.psd?.threshold.value ?? null
  const inside = status.aim === "onderhouden" && !status.conflict
  const upper =
    status.aim === "afbouwen" || (status.aim === "onderhouden" && status.direction === "up")
  if (status.binding === "psd" && threshold !== null) {
    const edge = formatNumberNl(threshold + R.psd_margin)
    return inside
      ? `Rand van de zone: PSD ${edge} % (milieugrens ${formatNumberNl(threshold)} % plus marge).`
      : `Doel: PSD ${edge} % of lager (milieugrens ${formatNumberNl(threshold)} % plus marge).`
  }
  if (status.binding === "p_al") {
    const edge = upper ? P_AL_HIGH + R.p_al_margin : P_AL_LOW - R.p_al_margin
    const bound = upper ? P_AL_HIGH : P_AL_LOW
    return inside
      ? `Rand van de zone: P-AL ${edge} (${bound} met marge).`
      : `Doel: P-AL ${upper ? "≤" : "≥"} ${edge} (${bound} met marge).`
  }
  return null
}

/**
 * Status of the soil phosphorus of a field, the headline of the field page: the three questions that
 * make up the status. Where the field is relative to the bounds (the zone strip and the first fact),
 * which way the long-term average balance moves it, and how long that takes. The advice is on its
 * own card (`PhosphateAdviceCard`), below the soil indicators.
 *
 * @param balance - The phosphate balance of the field.
 * @param fieldName - Name of the field (kept in the card, so a screenshot keeps it).
 */
export function PhosphateStatusCard({
  balance,
  fieldName,
}: {
  balance: PhosphateBalanceField
  fieldName: string
}) {
  const status = getPhosphateStatus(balance)
  const advice = getPhosphateAdvice(balance, status)
  const projection = balance.projection
  const psd = projection?.psd ?? null
  const pAl = projection?.p_al?.current ?? null
  const showPsd = psd !== null && psd.threshold.value !== null && balance.saturation.psd_valid
  const direction = describePhosphateDirection(status)
  const inside = status.aim === "onderhouden" && !status.conflict
  const band = formatYearsBand(status.years)
  const yearsValue = inside
    ? (band ?? `> ${PHOSPHATE_STATUS_RULES.stay_horizon} jaar`)
    : (band ?? advice.timeWithAdvice ?? formatYearsClass(status.years_class))
  const yearsFromAdvice = !inside && band === null && advice.timeWithAdvice !== null
  const edge = describeEdge(balance, status)
  const range = formatLongTermRange(balance.long_term.years)
  const threshold = psd?.threshold.value ?? null
  const positionLabel =
    showPsd && psd && threshold !== null && psd.current.value > threshold
      ? "Boven de milieugrens"
      : pAl !== null && pAl < P_AL_LOW
        ? "Onder de ondergrens voor het gewas"
        : !showPsd && pAl !== null && pAl > P_AL_HIGH
          ? "Boven de streefzone (P-AL hoog)"
          : "In de streefzone"

  return (
    <Card className="@container/status">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between space-y-0 gap-x-4 gap-y-2 pb-3">
        <div className="space-y-1.5">
          <PhosphateCardHeading>Fosfaattoestand</PhosphateCardHeading>
          <CardDescription>
            {fieldName}
            {status.aim
              ? `: ${formatPhosphateAim(status).replace(/^./, (c) => c.toLowerCase())}`
              : ""}
          </CardDescription>
        </div>
        <PhosphateVerdictBadge verdict={status.verdict} />
      </CardHeader>
      <CardContent className="space-y-5">
        {status.verdict !== "unknown" ? (
          <>
            <PhosphateZoneStrip balance={balance} status={status} />
            <dl className="grid gap-4 @2xl/status:grid-cols-3 @2xl/status:divide-x">
              <Fact
                title="Ten opzichte van de grenzen"
                value={positionLabel}
                note={[
                  showPsd && psd
                    ? `PSD ${formatNumberNl(psd.current.value)} % (milieugrens ${formatNumberNl(psd.threshold.value)} %)`
                    : null,
                  pAl !== null
                    ? `P-AL ${formatNumberNl(pAl)} (${formatPAlLevel(pAl).split(" ")[0].toLowerCase()})`
                    : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Fact
                title="Welke kant"
                value={`${direction.verb}${direction.meaning ? `, ${direction.meaning}` : ""}`}
                note={
                  projection
                    ? `Gemiddeld saldo ${formatNumberNl(balance.long_term.balance)} ${PHOSPHATE_UNIT} per jaar${range ? ` (${range})` : ""}; netto ${formatNumberNl(projection.balance_effective_per_year)} na vastlegging en uitspoeling.`
                    : undefined
                }
              />
              <Fact
                title={inside ? "Hoe lang in de streefzone" : "Hoe lang tot het doel"}
                value={yearsValue}
                note={
                  yearsFromAdvice
                    ? `Bij het huidige saldo niet. ${edge ?? ""}`
                    : (edge ?? undefined)
                }
              />
            </dl>
          </>
        ) : (
          <p className="text-sm">
            Onvoldoende bodemgegevens (P-AL of fosfaatverzadiging) voor een oordeel.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** Icon per kind of option (next to its title, never on its own). */
const OPTION_ICON = {
  fertilizer: Tractor,
  removal: Wheat,
  keep: Check,
  advisor: MessagesSquare,
  data: FlaskConical,
} as const

/** One view in the advice: the environment (PSD) or the crop (P-AL), with its icon. */
function AdvicePerspective({ kind, text }: { kind: "environmental" | "agronomic"; text: string }) {
  const Icon = kind === "environmental" ? Droplets : Sprout
  return (
    <div className="space-y-1 @2xl/advice:px-4 @2xl/advice:first:pl-0 @2xl/advice:last:pr-0">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Icon
          className={cn(
            "size-4 shrink-0",
            kind === "environmental" ? "text-sky-700" : "text-green-700",
          )}
          aria-hidden="true"
        />
        {kind === "environmental" ? "Milieu (PSD)" : "Opbrengst (P-AL)"}
      </p>
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  )
}

/**
 * What could be done on a field, below the soil indicators. The goal in one line, then the two
 * views apart, the environment (PSD) and the crop (P-AL), so they do not mix, then the options as a
 * short list. The fertilisation option is in the lever the user controls (kg P₂O₅/ha from fertilizers
 * per year, with the saldo as secondary figure). When it needs more fertilizer than the field's
 * phosphate application standard, a warning says the standard is lower (it applies at farm level).
 * The reliability of the data and links to complete it close the card.
 *
 * @param balance - The phosphate balance of the field.
 * @param phosphateNorm - The phosphate application standard of the field (kg P₂O₅ / ha), or `null`.
 * @param warnings - Missing or estimated data (Dutch).
 * @param links - Pages where the data can be completed.
 */
export function PhosphateAdviceCard({
  balance,
  phosphateNorm,
  warnings = [],
  links,
}: {
  balance: PhosphateBalanceField
  phosphateNorm: number | null
  warnings?: string[]
  links: PhosphateDataLinks
}) {
  const status = getPhosphateStatus(balance)
  const advice = getPhosphateAdvice(balance, status)
  const indicative = getPhosphateIndicativeReason(balance, status)
  const needed = status.balance_needed
  const aboveNorm = needed !== null && phosphateNorm !== null && needed.fertilizers > phosphateNorm

  return (
    <Card className="@container/advice">
      <CardHeader className="space-y-1.5 pb-3">
        <PhosphateCardHeading>Mogelijke aanpak</PhosphateCardHeading>
        <CardDescription>{advice.goal}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {advice.environment || advice.agronomic ? (
          <div className="grid gap-4 @2xl/advice:grid-cols-2 @2xl/advice:divide-x">
            {advice.environment ? (
              <AdvicePerspective kind="environmental" text={advice.environment} />
            ) : null}
            {advice.agronomic ? (
              <AdvicePerspective kind="agronomic" text={advice.agronomic} />
            ) : null}
          </div>
        ) : null}

        <section aria-labelledby="phosphate-options" className="space-y-3 border-t pt-4">
          <h4 id="phosphate-options" className="text-sm font-medium">
            Mogelijkheden
          </h4>
          <ul className="space-y-3">
            {advice.options.map((option) => {
              const Icon = OPTION_ICON[option.kind]
              return (
                <li key={option.title} className="flex items-start gap-3">
                  <span className="bg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{option.title}</p>
                    {option.detail ? (
                      <p className="text-muted-foreground max-w-[75ch] text-sm">{option.detail}</p>
                    ) : null}
                    {option.kind === "data" ? (
                      <NavLink
                        to={links.soil}
                        className="text-sm font-medium underline underline-offset-4"
                      >
                        Naar de bodemanalyses van dit perceel
                      </NavLink>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
          {aboveNorm && needed ? (
            <p className="flex max-w-[75ch] items-start gap-2 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                De fosfaatgebruiksnorm van dit perceel ({formatNumberNl(phosphateNorm)}{" "}
                {PHOSPHATE_UNIT}) is lager dan deze {formatNumberNl(needed.fertilizers)}{" "}
                {PHOSPHATE_UNIT} per jaar; de norm geldt op bedrijfsniveau en gaat voor.
              </span>
            </p>
          ) : null}
        </section>

        {indicative || warnings.length > 0 ? (
          <div className="space-y-2 border-t pt-3">
            {indicative ? (
              <p className="text-muted-foreground flex items-start gap-2 text-xs">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>Indicatief: {indicative}</span>
              </p>
            ) : null}
            {warnings.length > 0 ? (
              <Collapsible>
                <CollapsibleTrigger className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 group flex items-center gap-2 rounded-sm text-xs outline-none focus-visible:ring-[3px]">
                  <TriangleAlert className="size-3.5 shrink-0 text-amber-700" aria-hidden="true" />
                  Ontbrekende of geschatte gegevens ({warnings.length})
                  <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2 pl-5 text-xs">
                  {warnings.map((warning) => (
                    <p key={warning} className="text-muted-foreground">
                      {warning}
                    </p>
                  ))}
                  <p className="flex flex-wrap gap-x-4 gap-y-1">
                    <NavLink to={links.soil} className="font-medium underline underline-offset-4">
                      Bodemanalyses
                    </NavLink>
                    <NavLink
                      to={links.fertilizer}
                      className="font-medium underline underline-offset-4"
                    >
                      Bemesting
                    </NavLink>
                    <NavLink
                      to={links.cultivation}
                      className="font-medium underline underline-offset-4"
                    >
                      Gewassen en oogsten
                    </NavLink>
                  </p>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
