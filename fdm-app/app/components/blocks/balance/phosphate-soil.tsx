import type { PhosphateBalanceField, ValueWithRange } from "@nmi-agro/fdm-calculator"
import type { ReactNode } from "react"
import { TriangleAlert } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
  formatNumberNl,
  formatSaturationSource,
  formatYearsClass,
  getPhosphateSaturationOutlook,
  PHOSPHATE_UNIT,
} from "./phosphate-format"

/** A label-value row. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

/** Formats a value with its range, e.g. "1,2 (0,9 – 1,5)"; the range is omitted when there is none. */
function formatRange(value: ValueWithRange, decimals = 0): string {
  const main = formatNumberNl(value.value, decimals)
  if (value.min === value.max) return main
  return `${main} (${formatNumberNl(value.min, decimals)} – ${formatNumberNl(value.max, decimals)})`
}

/** List of warnings, each with an icon. */
function Warnings({ warnings }: { warnings: string[] }) {
  const unique = [...new Set(warnings)]
  if (unique.length === 0) return null
  return (
    <ul className="space-y-1.5 pt-2">
      {unique.map((warning) => (
        <li key={warning} className="text-muted-foreground flex gap-2 text-xs">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden />
          <span>{warning}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Soil phosphate stock (P-AL): current value, change per year at the current balance and the
 * time until the lower bound of the frame is reached, with the assumptions stated inline.
 *
 * @param balance - The phosphate balance of the field.
 */
export function PhosphateStockCard({ balance }: { balance: PhosphateBalanceField }) {
  const projection = balance.projection
  const pAl = projection?.p_al ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bodemvoorraad (P-AL)</CardTitle>
        <CardDescription>
          Wat het saldo betekent voor de fosfaatvoorraad in de bouwvoor, als het saldo van dit jaar
          elk jaar zo blijft.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!projection || !pAl ? (
          <p className="text-muted-foreground text-sm">
            Geen P-AL bekend: de ontwikkeling van de voorraad kan niet worden berekend.
          </p>
        ) : (
          <>
            <Row label="P-AL nu">{formatNumberNl(pAl.current)} mg P₂O₅ / 100 g</Row>
            <Row label="Saldo min vastlegging">
              {formatNumberNl(projection.balance_effective_per_year)} {PHOSPHATE_UNIT} / jaar
            </Row>
            <Row label="Verandering P-AL">{formatRange(pAl.delta_per_year, 1)} per jaar</Row>
            {pAl.floor !== null ? (
              <Row label={`Tijd tot P-AL ${pAl.floor}`}>
                {pAl.years ? formatYearsClass(pAl.years_class) : "daalt niet bij dit saldo"}
              </Row>
            ) : null}
            <p className="text-muted-foreground pt-2 text-xs">
              Aannames: vastlegging {formatNumberNl(projection.fixation)} {PHOSPHATE_UNIT} / jaar;{" "}
              {formatRange(pAl.buffer)} kg P₂O₅ / ha per eenheid P-AL voor een laag van{" "}
              {formatNumberNl(projection.depth.value * 100)} cm. Indicatief: één jaar zegt weinig,
              een verandering van één klasse is pas na meerdere jaren meetbaar.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Phosphorus saturation degree (PSD) of the topsoil compared with the field-specific threshold
 * (van Doorn 2026), and the time until the threshold is crossed at the current balance.
 *
 * @param balance - The phosphate balance of the field.
 */
export function PhosphateSaturationCard({ balance }: { balance: PhosphateBalanceField }) {
  const { saturation } = balance
  const psdProjection = balance.projection?.psd ?? null
  const threshold = psdProjection?.threshold ?? null
  const warnings = [...saturation.warnings, ...(threshold?.warnings ?? [])]

  const outlook = getPhosphateSaturationOutlook(balance)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fosfaatverzadiging (milieu)</CardTitle>
        <CardDescription>
          De fosfaatverzadigingsgraad (PSD) geeft aan hoeveel van de fosfaatbindingscapaciteit van
          de bodem al gevuld is. Boven de grenswaarde neemt het risico op uit- en afspoeling toe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!saturation.psd ? (
          <p className="text-muted-foreground text-sm">
            Onvoldoende gegevens om de fosfaatverzadigingsgraad te bepalen.
          </p>
        ) : (
          <>
            <Row label="PSD nu">{formatRange(saturation.psd)} %</Row>
            <Row label="Bron">{formatSaturationSource(saturation.source)}</Row>
            {saturation.psc !== null ? (
              <Row label="Bindingscapaciteit (PSC)">{formatNumberNl(saturation.psc)} mmol / kg</Row>
            ) : null}
            {threshold?.value != null ? (
              <Row label="Grenswaarde">
                {formatNumberNl(threshold.value)} %
                {threshold.source === "default_25" ? " (standaard)" : " (perceel)"}
              </Row>
            ) : null}
            {psdProjection ? (
              <Row label="Verandering PSD">
                {formatNumberNl(psdProjection.delta_per_year, 1)} %-punt per jaar
              </Row>
            ) : null}
            {outlook ? <Row label="Vooruitzicht">{outlook.text}</Row> : null}
            {threshold?.source === "field" ? (
              <p className="text-muted-foreground pt-2 text-xs">
                Grenswaarde per perceel (van Doorn, 2026): de laagste van de milieugrens (
                {formatNumberNl(threshold.psd_env)} %, bij een grondwaterstand van{" "}
                {formatNumberNl(threshold.ghg)} cm) en de PSD bij het landbouwkundige streefniveau (
                {formatNumberNl(threshold.psd_agronomic)} %).
              </p>
            ) : null}
          </>
        )}
        <Warnings warnings={warnings} />
      </CardContent>
    </Card>
  )
}

/**
 * One-line summary for field lists: PSD, threshold and outlook, plus a note when data for the
 * balance is missing.
 *
 * @param balance - The phosphate balance of the field.
 */
export function PhosphateFieldSummary({ balance }: { balance: PhosphateBalanceField }) {
  const psd = balance.saturation.psd
  const threshold = balance.projection?.psd?.threshold.value ?? null
  const outlook = getPhosphateSaturationOutlook(balance)
  const incomplete = (balance.warnings ?? []).length > 0
  if (!psd && !incomplete) return null
  return (
    <div className="text-muted-foreground space-y-0.5 text-xs">
      {psd ? (
        <p>
          PSD {formatNumberNl(psd.value)} %
          {threshold !== null ? ` · grens ${formatNumberNl(threshold)} %` : ""}
          {outlook ? ` · ${outlook.text.charAt(0).toLowerCase()}${outlook.text.slice(1)}` : ""}
        </p>
      ) : null}
      {incomplete ? (
        <p className="flex items-center gap-1">
          <TriangleAlert className="h-3 w-3 shrink-0 text-orange-500" aria-hidden />
          Gegevens voor de afvoer ontbreken
        </p>
      ) : null}
    </div>
  )
}
