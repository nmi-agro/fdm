import type {
  PhosphateBalanceField,
  PhosphateFieldInput,
  PhosphateVerdict,
} from "@nmi-agro/fdm-calculator"
import type { ReactNode } from "react"
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  Droplets,
  Info,
  Sprout,
} from "lucide-react"
import { InfoTip } from "~/components/blocks/fertilizer-applications/bulk/info-tip"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { cn } from "~/lib/utils"
import {
  formatLongTermYears,
  formatNumberNl,
  formatPAlLevel,
  formatSaturationSource,
  formatYearsBand,
  getPhosphateStatus,
  getPhosphateYearsToThreshold,
  P_AL_HIGH,
  P_AL_LOW,
  PHOSPHATE_VERDICT_TEXT,
} from "./phosphate-format"
import {
  getTrendChartStart,
  type PhosphateMeasurement,
  PhosphateTrendChart,
} from "./phosphate-trend-chart"

/**
 * Icon and colours per verdict: never colour alone, always with an icon and a label. Text and
 * icons use the -700/-800 shades so they meet WCAG AA on their light tint.
 */
const VERDICT_STYLE = {
  good: {
    Icon: CircleCheck,
    icon: "bg-green-100 text-green-700",
    badge: "border-green-700/30 bg-green-50 text-green-800",
  },
  attention: {
    Icon: CircleAlert,
    icon: "bg-amber-100 text-amber-700",
    badge: "border-amber-700/30 bg-amber-50 text-amber-800",
  },
  adjust: {
    Icon: CircleX,
    icon: "bg-red-100 text-red-700",
    badge: "border-red-700/30 bg-red-50 text-red-800",
  },
  unknown: {
    Icon: CircleHelp,
    icon: "bg-muted text-muted-foreground",
    badge: "border-border bg-muted text-muted-foreground",
  },
} as const

/**
 * Status icon of a field: check (good), alert (attention), cross (adjust) or question mark
 * (unknown), with the verdict and its meaning as accessible label.
 *
 * @param verdict - The verdict of the field.
 * @param className - Extra classes (size).
 */
export function PhosphateStatusIcon({
  verdict,
  className,
}: {
  verdict: PhosphateVerdict
  className?: string
}) {
  const { Icon, icon } = VERDICT_STYLE[verdict]
  const text = PHOSPHATE_VERDICT_TEXT[verdict]
  return (
    <Icon
      role="img"
      aria-label={`${text.label}: ${text.description}`}
      className={cn("shrink-0 rounded-full p-0", icon, className)}
    />
  )
}

/**
 * Verdict as a quiet outlined badge with icon and label (e.g. "Aandacht"). Its meaning opens on
 * hover, keyboard focus and tap.
 *
 * @param verdict - The verdict of the field.
 * @param className - Extra classes.
 */
export function PhosphateVerdictBadge({
  verdict,
  className,
}: {
  verdict: PhosphateVerdict
  className?: string
}) {
  const { Icon, badge } = VERDICT_STYLE[verdict]
  const text = PHOSPHATE_VERDICT_TEXT[verdict]
  return (
    <InfoTip content={`${text.description}.`} className="max-w-xs">
      <button
        type="button"
        className={cn(
          "focus-visible:ring-ring/50 inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm font-medium outline-none focus-visible:ring-[3px]",
          badge,
          className,
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
        {text.label}
      </button>
    </InfoTip>
  )
}

/** Heading of a phosphate card (a real heading, so the page can be navigated by headings). */
export function PhosphateCardHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-base leading-tight font-semibold">{children}</h3>
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

/** Collapsible block, by default "Meer details" for advisors: data sources, calculation, references. */
function MoreDetails({
  children,
  title = "Meer details",
  className,
}: {
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <Collapsible className={cn("border-t pt-2", className)}>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex w-full items-center justify-between text-sm">
        {title}
        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground space-y-2 pt-2 text-xs">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

/** A titled paragraph inside "Meer details". */
function Detail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-foreground font-medium">{title}</p>
      <div>{children}</div>
    </div>
  )
}

/** A reference with a link. */
function Reference({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer" className="hover:text-foreground underline">
        {children}
      </a>
    </li>
  )
}

/** Note under the trend charts: the trend repeats the long-term average balance every year. */
function illustrativeNote(balance: PhosphateBalanceField): string {
  const years = formatLongTermYears(balance.long_term.years)
  return `Illustratief: het verloop als de gemiddelde balans${years ? ` van ${years}` : ""} elk jaar terugkomt.`
}

/** Colour of the P-AL floor line: different from the PSD threshold. */
const P_AL_LEVEL_COLOR = "var(--color-sky-700)"

/** Laboratories and estimates by their `a_source` code (as in the fdm-core soil analysis options). */
const SOIL_SOURCE_LABELS: Record<string, string> = {
  "nl-rva-l122": "gemeten door Eurofins Agro Testing Wageningen",
  "nl-rva-l136": "gemeten door Nutrilab",
  "nl-rva-l264": "gemeten door Normec Robalab",
  "nl-rva-l320": "gemeten door ALNN",
  "nl-rva-l335": "gemeten door Normec Groen Agro Control",
  "nl-rva-l610": "gemeten door Normec Dumea",
  "nl-rva-l648": "gemeten door Fertilab",
  "nl-rva-l697": "gemeten door Care4Agro",
  "nl-other-nmi": "geschat met NMI BodemSchat, geen bodemanalyse",
  other: "ander laboratorium",
}

/** Laboratory names by their `a_source` code, for the tooltip of a measured point. */
const SOIL_LAB_NAMES: Record<string, string> = {
  "nl-rva-l122": "Eurofins Agro Testing Wageningen",
  "nl-rva-l136": "Nutrilab",
  "nl-rva-l264": "Normec Robalab",
  "nl-rva-l320": "ALNN",
  "nl-rva-l335": "Normec Groen Agro Control",
  "nl-rva-l610": "Normec Dumea",
  "nl-rva-l648": "Fertilab",
  "nl-rva-l697": "Care4Agro",
  other: "Ander laboratorium",
}

/** Dutch description of where the soil data come from (lab measurement or NMI estimate). */
function formatSources(sources: string[]): string {
  if (sources.length === 0) return "bron onbekend"
  return sources.map((source) => SOIL_SOURCE_LABELS[source] ?? source).join("; ")
}

/** Measurements older than this (years before the selected year) are not shown in the chart. */
const MEASUREMENT_HISTORY_YEARS = 15

/**
 * Dated soil analyses of P-AL as points for the trend chart, in years relative to the start of the
 * selected calendar year, with the sampling date and the laboratory for the tooltip. NMI estimates
 * (`nl-other-nmi`) are not soil analyses and are left out.
 *
 * @param soilAnalyses - The soil analyses of the field.
 * @param calendarYear - The selected calendar year ("nu" in the chart).
 * @returns The points, oldest first.
 */
function getMeasuredPAl(
  soilAnalyses: PhosphateFieldInput["soilAnalyses"],
  calendarYear: number,
): PhosphateMeasurement[] {
  if (!Number.isInteger(calendarYear)) return []
  const reference = new Date(calendarYear, 0, 1).getTime()
  return soilAnalyses
    .filter(
      (a) =>
        a.a_p_al !== null &&
        a.a_p_al !== undefined &&
        a.b_sampling_date &&
        a.a_source !== "nl-other-nmi",
    )
    .map((a) => ({
      year:
        (new Date(a.b_sampling_date as Date).getTime() - reference) / (365.25 * 24 * 3600 * 1000),
      value: a.a_p_al as number,
      date: new Date(a.b_sampling_date as Date),
      source: a.a_source ? (SOIL_LAB_NAMES[a.a_source] ?? a.a_source) : "Laboratorium onbekend",
    }))
    .filter((m) => m.year >= -MEASUREMENT_HISTORY_YEARS && m.year <= 1)
    .sort((a, b) => a.year - b.year)
}

/**
 * Line under a soil card title that says what the indicator is about: the crop (P-AL) or the
 * environment (PSD), with an icon so it is not carried by text colour alone.
 */
function IndicatorPurpose({ kind }: { kind: "agronomic" | "environmental" }) {
  return kind === "agronomic" ? (
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <Sprout className="size-3.5 shrink-0 text-green-700" aria-hidden="true" />
      Landbouwkundig: is er genoeg fosfaat voor het gewas?
    </p>
  ) : (
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <Droplets className="size-3.5 shrink-0 text-sky-700" aria-hidden="true" />
      Milieu: hoe groot is de kans dat fosfaat naar sloot en grondwater gaat?
    </p>
  )
}

/** Small badge on the soil card whose bound sets the aim of the field; explained on focus or tap. */
function BindingBadge() {
  return (
    <InfoTip
      content="Deze indicator bepaalt het oordeel en het advies voor dit perceel."
      className="max-w-xs"
    >
      <button
        type="button"
        className="bg-secondary text-secondary-foreground focus-visible:ring-ring/50 shrink-0 rounded-md px-2 py-0.5 text-xs font-medium outline-none focus-visible:ring-[3px]"
      >
        bepalend
      </button>
    </InfoTip>
  )
}

/**
 * Start of the shared time axis of the PSD and P-AL charts: the oldest P-AL soil analysis shown,
 * so both charts put "nu" at the same place.
 *
 * @param soilAnalyses - The soil analyses of the field.
 * @param calendarYear - The selected calendar year.
 * @returns The start (years before "nu", 0 without analyses).
 */
export function getPhosphateChartStart(
  soilAnalyses: PhosphateFieldInput["soilAnalyses"],
  calendarYear: number,
): number {
  return getTrendChartStart(getMeasuredPAl(soilAnalyses, calendarYear))
}

/**
 * Soil phosphate stock: P-AL now, its level, its change per year at the long-term average balance
 * (with the range from the soil buffer) and when it reaches the agronomic minimum, with an
 * illustrative trend (plus the dated lab measurements as points) and details for advisors.
 *
 * @param balance - The phosphate balance of the field.
 * @param soilAnalyses - The soil analyses of the field (for the measured points).
 * @param calendarYear - The selected calendar year.
 * @param chartStart - Start of the shared time axis (see `getPhosphateChartStart`).
 * @param className - Extra classes for the card.
 */
export function PhosphateStockCard({
  balance,
  soilAnalyses = [],
  calendarYear,
  chartStart,
  className,
}: {
  balance: PhosphateBalanceField
  soilAnalyses?: PhosphateFieldInput["soilAnalyses"]
  calendarYear?: number
  chartStart?: number
  className?: string
}) {
  const projection = balance.projection
  const pAl = projection?.p_al ?? null
  const status = getPhosphateStatus(balance)
  const measurements = calendarYear ? getMeasuredPAl(soilAnalyses, calendarYear) : []
  const delta = pAl?.delta_per_year
  const below = pAl !== null && pAl.current < P_AL_LOW
  const minYears = below
    ? status.aim === "opbouwen"
      ? formatYearsBand(status.years)
      : null
    : formatYearsBand(status.p_al_min_years)
  // Without a usable PSD, P-AL 25–45 is the whole target zone; otherwise only its floor counts
  const pAlOnly = !(
    projection?.psd &&
    projection.psd.threshold.value !== null &&
    balance.saturation.psd_valid
  )
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="space-y-1">
          <PhosphateCardHeading>Bodemvoorraad (P-AL)</PhosphateCardHeading>
          <IndicatorPurpose kind="agronomic" />
        </div>
        {status.binding === "p_al" ? <BindingBadge /> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {projection && pAl && delta ? (
          <>
            <Row label="Nu">{formatNumberNl(pAl.current)} mg P₂O₅ / 100 g</Row>
            <Row label="Niveau">{formatPAlLevel(pAl.current)}</Row>
            <Row label="Verandering bij gemiddelde balans">
              {delta.value > 0 ? "+" : ""}
              {formatNumberNl(delta.value, 1)} per jaar
              {delta.min !== delta.max ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  ({formatNumberNl(delta.min, 1)} tot {formatNumberNl(delta.max, 1)})
                </span>
              ) : null}
            </Row>
            <Row label={below ? `P-AL ${P_AL_LOW} bereikt over` : `P-AL onder ${P_AL_LOW} over`}>
              {minYears ?? "niet bij de huidige balans"}
            </Row>
            <PhosphateTrendChart
              current={pAl.current}
              deltaPerYear={delta.value}
              deltaRange={delta.min !== delta.max ? { min: delta.min, max: delta.max } : undefined}
              bounds={[
                { value: P_AL_LOW, label: "ondergrens gewas" },
                ...(pAlOnly ? [{ value: P_AL_HIGH, label: "hoog" }] : []),
              ]}
              band={{ from: P_AL_LOW, to: pAlOnly ? P_AL_HIGH : undefined, label: "streefzone" }}
              boundColor={P_AL_LEVEL_COLOR}
              unit=""
              measurements={measurements}
              xMin={chartStart}
            />
            <p className="text-muted-foreground text-xs">
              {illustrativeNote(balance)}
              {delta.min !== delta.max ? " Vlak: bereik door de onzekerheid in de buffer." : ""}
              {measurements.length > 0
                ? " Punten: P-AL uit bodemanalyses (wijs een punt aan voor datum en laboratorium)."
                : ""}
            </p>
            <MoreDetails className="mt-auto">
              <Detail title="Gegevens">
                P-AL: fosfaat uit ammoniumlactaat-extractie (mg P₂O₅/100 g), uit de meest recente
                bodemanalyse (
                {formatSources(
                  balance.saturation.a_p_al_source ? [balance.saturation.a_p_al_source] : [],
                )}
                ), laag 0–
                {formatNumberNl(projection.depth.value * 100)} cm.
              </Detail>
              <Detail title="Berekening">
                Verandering P-AL per jaar = (gemiddelde balans + uitspoeling − vastlegging) ÷
                buffer. Vastlegging: {formatNumberNl(projection.fixation)} kg P₂O₅/ha/jaar. Buffer:{" "}
                {formatNumberNl(pAl.buffer.value)} kg P₂O₅/ha per eenheid P-AL voor deze grondsoort
                en laagdikte
                {pAl.buffer.min !== pAl.buffer.max
                  ? ` (bereik ${formatNumberNl(pAl.buffer.min)}–${formatNumberNl(pAl.buffer.max)})`
                  : ""}
                .
              </Detail>
              <Detail title="Niveaus">
                P-AL {P_AL_LOW} is de landbouwkundige ondergrens van de streefzone: daaronder is
                opbouwen nodig voor de opbrengst. Boven {P_AL_HIGH} is de voorraad hoog; zonder
                bruikbare fosfaatverzadiging is dat de bovengrens. Ter vergelijking: het
                landbouwkundige streefniveau voor bouwland is P-AL 40 (Handboek Bodem en Bemesting);
                de wettelijke fosfaatklasse (RVO) gebruikt P-AL én P-CaCl₂.
              </Detail>
              <Detail title="Bronnen">
                <ul className="list-disc pl-4">
                  <Reference href="https://www.handboekbodemenbemesting.nl/bemestingsadviezen/fosfaat/bodemgericht-advies-op-basis-van-p-al/">
                    Handboek Bodem en Bemesting: fosfaatadvies op basis van P-AL
                  </Reference>
                  <Reference href="https://doi.org/10.1111/sum.12333">
                    Van der Salm et al. (2017), Soil Use and Management 33: 2–12 (vastlegging)
                  </Reference>
                </ul>
              </Detail>
            </MoreDetails>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Geen P-AL bekend.</p>
        )}
      </CardContent>
    </Card>
  )
}

/** Short definition of the PSD, shown behind the info icon next to the title. */
const PSD_DEFINITION =
  "Hoeveel van de fosfaatbinding van de bodem al bezet is. Hoe hoger, hoe groter de kans dat fosfaat naar grond- en oppervlaktewater verdwijnt."

/**
 * Phosphorus saturation degree (PSD): now, the field-specific threshold, the change per year and
 * when the threshold is crossed, with an illustrative trend, the definition behind an info icon and
 * details for advisors. The verdict and advice are on the status card.
 *
 * @param balance - The phosphate balance of the field.
 * @param chartStart - Start of the shared time axis (see `getPhosphateChartStart`).
 * @param className - Extra classes for the card (e.g. `h-full` to match the height of a card next
 *   to it).
 */
export function PhosphateSaturationCard({
  balance,
  chartStart,
  className,
}: {
  balance: PhosphateBalanceField
  chartStart?: number
  className?: string
}) {
  const projection = balance.projection
  const psd = projection?.psd ?? null
  const status = getPhosphateStatus(balance)
  const years = getPhosphateYearsToThreshold(balance)
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <PhosphateCardHeading>Fosfaatverzadiging (PSD)</PhosphateCardHeading>
            <InfoTip content={PSD_DEFINITION} className="max-w-xs">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -m-1 rounded-sm p-1 outline-none focus-visible:ring-[3px]"
                aria-label="Wat is de fosfaatverzadiging?"
              >
                <Info className="size-4" aria-hidden="true" />
              </button>
            </InfoTip>
          </div>
          <IndicatorPurpose kind="environmental" />
        </div>
        {status.binding === "psd" ? <BindingBadge /> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {projection && psd ? (
          <>
            <Row label="Nu">{formatNumberNl(psd.current.value)} %</Row>
            <Row label="Milieugrens">{formatNumberNl(psd.threshold.value)} %</Row>
            <Row label="Verandering bij gemiddelde balans">
              {psd.delta_per_year > 0 ? "+" : ""}
              {formatNumberNl(psd.delta_per_year, Math.abs(psd.delta_per_year) < 0.1 ? 2 : 1)}{" "}
              %-punt per jaar
            </Row>
            {years ? <Row label={years.label}>{years.value}</Row> : null}
            {psd.threshold.value !== null ? (
              <PhosphateTrendChart
                current={psd.current.value}
                deltaPerYear={psd.delta_per_year}
                bounds={[{ value: psd.threshold.value, label: "milieugrens" }]}
                band={{ from: 0, to: psd.threshold.value, label: "streefzone" }}
                unit=" %"
                max={100}
                xMin={chartStart}
              />
            ) : null}
            <p className="text-muted-foreground text-xs">{illustrativeNote(balance)}</p>
            {balance.saturation.soil_note ? (
              <p className="text-muted-foreground text-xs">{balance.saturation.soil_note}</p>
            ) : null}
            {/* At the bottom, so the card can match the height of the balance card */}
            <MoreDetails className="mt-auto">
              <Detail title="Wat zegt de fosfaatverzadiging?">
                Het deel van de fosfaatbinding van de bodem (ijzer- en aluminiumoxiden) dat al bezet
                is. P-AL zegt hoeveel fosfaat het gewas kan opnemen; de PSD zegt ook hoe vol de
                bodem zit. Boven de milieugrens spoelt fosfaat uit en af naar sloten en grondwater.
                De milieugrens is de bovengrens van de streefzone; boven de grens is afbouwen nodig,
                ook als P-AL voor de opbrengst op peil is.
              </Detail>
              <Detail title="Gemiddelde balans">
                {formatNumberNl(balance.long_term.balance)} kg P₂O₅/ha per jaar
                {balance.long_term.years.length > 0
                  ? ` over ${formatLongTermYears(balance.long_term.years)}`
                  : ""}
                , zodat een vruchtwisseling meetelt.
                {balance.long_term.estimated_removal_years.length > 0
                  ? ` Afvoer zonder geregistreerde oogst (${balance.long_term.estimated_removal_years.join(", ")}): standaardopbrengst en fosfaatgehalte van het gewas.`
                  : ""}
                {balance.long_term.fertilizer_years.length < balance.long_term.years.length
                  ? ` Bemesting: gemiddelde van ${balance.long_term.fertilizer_years.join(", ")}.`
                  : ""}
              </Detail>
              <Detail title="Gegevens">
                {formatSaturationSource(balance.saturation.source)} (
                {formatSources(balance.saturation.analysis_sources)}). Fosfaatbindingscapaciteit
                (PSC): {formatNumberNl(balance.saturation.psc)} mmol/kg.
              </Detail>
              <Detail title="Berekening">
                PSC = 0,5 × (Fe-ox + Al-ox); PSD = P-ox ÷ PSC × 100. Verandering per jaar uit
                (gemiddelde balans − uitspoeling − vastlegging) verdeeld over de laag van{" "}
                {formatNumberNl(projection.depth.value * 100)} cm met dichtheid{" "}
                {formatNumberNl(projection.a_density_sa.value, 2)} g/cm³.
              </Detail>
              <Detail title="Grenswaarde">
                {psd.threshold.source === "field"
                  ? `Per perceel berekend uit P-CaCl₂ en de grondwatertrap (gemiddeld hoogste grondwaterstand ${formatNumberNl(psd.threshold.ghg)} cm): milieugrens ${formatNumberNl(psd.threshold.psd_env)} %.`
                  : "Geen P-CaCl₂ bekend: de algemene grens van 25 % is gebruikt."}
              </Detail>
              <Detail title="Bronnen">
                <ul className="list-disc pl-4">
                  <Reference href="https://doi.org/10.18174/681704">
                    Van Doorn (2026), proefschrift Wageningen University (hoofdstuk 5)
                  </Reference>
                  <Reference href="https://doi.org/10.1080/10643389.2023.2240211">
                    Van Doorn et al. (2024), Critical Reviews in Environmental Science and
                    Technology 54: 385–404
                  </Reference>
                </ul>
              </Detail>
            </MoreDetails>
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
