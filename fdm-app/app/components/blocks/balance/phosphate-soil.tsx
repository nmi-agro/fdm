import type { PhosphateBalanceField } from "@nmi-agro/fdm-calculator"
import type { ReactNode } from "react"
import { ChevronDown, CircleAlert, CircleCheck, CircleX } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { cn } from "~/lib/utils"
import {
  formatNumberNl,
  formatPAlLevel,
  formatSaturationSource,
  getPhosphateTrendStatus,
  getPhosphateYearsToThreshold,
  P_AL_HIGH,
  P_AL_LOW,
  type PhosphateTrendStatus,
} from "./phosphate-format"
import { PhosphateTrendChart } from "./phosphate-trend-chart"

/**
 * Status icon of a field: a green check when the balance moves the phosphorus saturation degree
 * (PSD) towards its field-specific threshold or keeps it below, a red cross when it moves away from
 * it or will exceed it, an orange alert when the PSD or the threshold is unknown.
 *
 * @param status - The trend status.
 * @param className - Extra classes (size).
 */
export function PhosphateStatusIcon({
  status,
  className,
}: {
  status: PhosphateTrendStatus
  className?: string
}) {
  if (status === "on_track") {
    return (
      <CircleCheck
        aria-label="Het saldo past bij het doel voor de fosfaatverzadiging"
        className={cn("shrink-0 rounded-full bg-green-100 p-0 text-green-500", className)}
      />
    )
  }
  if (status === "off_track") {
    return (
      <CircleX
        aria-label="Het saldo past niet bij het doel voor de fosfaatverzadiging"
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

/** Collapsible "Meer details" block for advisors: data sources, calculation and references. */
function MoreDetails({ children }: { children: ReactNode }) {
  return (
    <Collapsible className="border-t pt-2">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex w-full items-center justify-between text-sm">
        Meer details
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

const ILLUSTRATIVE_NOTE = "Illustratief: het verloop als het saldo van dit jaar elk jaar terugkomt."

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
  "nl-other-nmi": "geschat met NMI BodemSchat, geen meting",
  other: "ander laboratorium",
}

/** Dutch description of where the soil data come from (lab measurement or NMI estimate). */
function formatSources(sources: string[]): string {
  if (sources.length === 0) return "bron onbekend"
  return sources.map((source) => SOIL_SOURCE_LABELS[source] ?? source).join("; ")
}

/**
 * Soil phosphate stock: P-AL now, its level and its change per year at the current balance, with
 * an illustrative trend and details for advisors.
 *
 * @param balance - The phosphate balance of the field.
 */
export function PhosphateStockCard({ balance }: { balance: PhosphateBalanceField }) {
  const projection = balance.projection
  const pAl = projection?.p_al ?? null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Bodemvoorraad (P-AL)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {projection && pAl ? (
          <>
            <Row label="Nu">{formatNumberNl(pAl.current)} mg P₂O₅ / 100 g</Row>
            <Row label="Niveau">{formatPAlLevel(pAl.current)}</Row>
            <Row label="Verandering bij dit saldo">
              {pAl.delta_per_year.value > 0 ? "+" : ""}
              {formatNumberNl(pAl.delta_per_year.value, 1)} per jaar
            </Row>
            <PhosphateTrendChart
              current={pAl.current}
              deltaPerYear={pAl.delta_per_year.value}
              bounds={[
                { value: P_AL_LOW, label: "laag <" },
                { value: P_AL_HIGH, label: "hoog >" },
              ]}
              band={{ from: P_AL_LOW, to: P_AL_HIGH }}
              unit=""
            />
            <p className="text-muted-foreground text-xs">{ILLUSTRATIVE_NOTE}</p>
            <MoreDetails>
              <Detail title="Gegevens">
                P-AL: fosfaat uit ammoniumlactaat-extractie (mg P₂O₅/100 g), uit de meest recente
                bodemanalyse ({formatSources(balance.saturation.analysis_sources)}), laag 0–
                {formatNumberNl(projection.depth.value * 100)} cm.
              </Detail>
              <Detail title="Berekening">
                Verandering P-AL per jaar = (saldo − vastlegging) ÷ buffer. Vastlegging:{" "}
                {formatNumberNl(projection.fixation)} kg P₂O₅/ha/jaar. Buffer:{" "}
                {formatNumberNl(pAl.buffer.value)} kg P₂O₅/ha per eenheid P-AL voor deze grondsoort
                en laagdikte
                {pAl.buffer.min !== pAl.buffer.max
                  ? ` (bereik ${formatNumberNl(pAl.buffer.min)}–${formatNumberNl(pAl.buffer.max)})`
                  : ""}
                .
              </Detail>
              <Detail title="Niveaus">
                Indeling op P-AL uit de opzet van deze fosfaatbalans (prototype): onder {P_AL_LOW}{" "}
                laag (opbouwen), {P_AL_LOW}–{P_AL_HIGH} gemiddeld (onderhouden), boven {P_AL_HIGH}{" "}
                hoog (afbouwen). Ter vergelijking: het landbouwkundige streefniveau voor bouwland is
                P-AL 40 (Handboek Bodem en Bemesting); de wettelijke fosfaatklasse (RVO) gebruikt
                P-AL én P-CaCl₂.
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

/**
 * Phosphorus saturation degree (PSD): the years until the threshold is crossed (the key figure),
 * now, the field-specific threshold and the change per year, with an illustrative trend, a warning
 * when the balance moves away from the aim, and details for advisors.
 *
 * @param balance - The phosphate balance of the field.
 */
export function PhosphateSaturationCard({ balance }: { balance: PhosphateBalanceField }) {
  const projection = balance.projection
  const psd = projection?.psd ?? null
  const status = getPhosphateTrendStatus(balance)
  const years = getPhosphateYearsToThreshold(balance)
  const offTrack = status === "off_track"
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Fosfaatverzadiging (PSD)</CardTitle>
        <PhosphateStatusIcon status={status} className="h-8 w-8" />
      </CardHeader>
      <CardContent className="space-y-2">
        {projection && psd ? (
          <>
            {years ? (
              <div>
                <p className="text-muted-foreground text-xs">{years.label}</p>
                <div className={cn("text-2xl font-bold", offTrack && "text-red-600")}>
                  {years.value}
                </div>
              </div>
            ) : null}
            {offTrack ? (
              <p className="text-sm font-medium text-red-600">
                Het overschot vergroot de kans op uit- en afspoeling van fosfaat naar grond- en
                oppervlaktewater.
              </p>
            ) : null}
            <Row label="Nu">{formatNumberNl(psd.current.value)} %</Row>
            <Row label="Grenswaarde">{formatNumberNl(psd.threshold.value)} %</Row>
            <Row label="Verandering bij dit saldo">
              {psd.delta_per_year > 0 ? "+" : ""}
              {formatNumberNl(psd.delta_per_year, 1)} % per jaar
            </Row>
            {psd.threshold.value !== null ? (
              <PhosphateTrendChart
                current={psd.current.value}
                deltaPerYear={psd.delta_per_year}
                bounds={[{ value: psd.threshold.value, label: "grens" }]}
                unit=" %"
                max={100}
              />
            ) : null}
            <p className="text-muted-foreground text-xs">
              {ILLUSTRATIVE_NOTE}
              {balance.saturation.source === "estimated_from_p_al"
                ? " De PSD is geschat uit P-AL en daarom indicatief."
                : ""}
            </p>
            <MoreDetails>
              <Detail title="Gegevens">
                {formatSaturationSource(balance.saturation.source)} (
                {formatSources(balance.saturation.analysis_sources)}). Fosfaatbindingscapaciteit
                (PSC): {formatNumberNl(balance.saturation.psc)} mmol/kg.
              </Detail>
              <Detail title="Berekening">
                PSC = 0,5 × (Fe-ox + Al-ox); PSD = P-ox ÷ PSC × 100. Verandering per jaar uit (saldo
                − vastlegging) verdeeld over de laag van{" "}
                {formatNumberNl(projection.depth.value * 100)} cm met dichtheid{" "}
                {formatNumberNl(projection.a_density_sa.value, 2)} g/cm³.
              </Detail>
              <Detail title="Grenswaarde">
                {psd.threshold.source === "field"
                  ? `Per perceel berekend uit P-CaCl₂ en de grondwatertrap (gemiddeld hoogste grondwaterstand ${formatNumberNl(psd.threshold.ghg)} cm): milieugrens ${formatNumberNl(psd.threshold.psd_env)} %, begrensd op de PSD bij het landbouwkundige streefniveau (${formatNumberNl(psd.threshold.psd_agronomic)} %).`
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
