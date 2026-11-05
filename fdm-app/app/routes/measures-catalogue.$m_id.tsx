import { getMeasureFromCatalogue, getMeasuresFromCatalogue } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { AlertTriangle, ArrowLeft, ChevronRight, ExternalLink } from "lucide-react"
import { data, type LoaderFunctionArgs, type MetaFunction, Link, useLoaderData } from "react-router"
import { Header } from "~/components/blocks/header/base"
import { HeaderMeasuresCatalogue } from "~/components/blocks/header/measures-catalogue"
import { MeasureCostIndicator } from "~/components/blocks/measures/measure-cost-indicator"
import { getMeasureCataloguePath } from "~/components/blocks/measures/measure-detail-link"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getMeasureFamilyId } from "~/lib/indicators"
import {
  formatConditions,
  formatEffectRange,
  getEffectTypeInfo,
  getImpactedIndicators,
  getMeasureReferences,
} from "~/lib/measure-labels"

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const name = loaderData?.measure.m_name ?? "Maatregel"
  return [
    { title: `${name} | Maatregelencatalogus | ${clientConfig.name}` },
    {
      name: "description",
      content: loaderData?.measure.m_summary ?? `Details van de maatregel ${name}.`,
    },
  ]
}

/**
 * Loads one catalogue measure, the measures it conflicts with and the other variants of the
 * same measure. Throws a 404 for an unknown `m_id`.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const m_id = params.m_id
    if (!m_id) {
      throw data("Maatregel ID is verplicht", { status: 400 })
    }
    await getSession(request)

    const [measure, catalogue] = await Promise.all([
      getMeasureFromCatalogue(fdm, m_id),
      getMeasuresFromCatalogue(fdm),
    ])
    if (!measure) {
      throw data("Maatregel niet gevonden", { status: 404 })
    }

    // Only conflicts with measures that are in the catalogue and still active: a conflict with
    // a measure that cannot be taken has no meaning for the user.
    const activeById = new Map(
      catalogue.filter((item) => item.m_status !== "inactive").map((item) => [item.m_id, item]),
    )
    const conflicts = (measure.m_conflicts ?? []).flatMap((conflict_id) => {
      const item = activeById.get(conflict_id)
      return item ? [{ m_id: item.m_id, m_name: item.m_name, inactive: false }] : []
    })

    const familyId = getMeasureFamilyId(measure.m_id)
    const variants = catalogue
      .filter((item) => item.m_id !== measure.m_id && getMeasureFamilyId(item.m_id) === familyId)
      .map((item) => ({
        m_id: item.m_id,
        m_name: item.m_name,
        inactive: item.m_status === "inactive",
      }))
      .sort((a, b) => a.m_id.localeCompare(b.m_id, "nl", { numeric: true }))

    return { measure, conflicts, variants }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** Short measure code without the source prefix, e.g. `BM7` for `bln_BM7`. */
function getMeasureCode(m_id: string): string {
  return m_id.replace(/^bln_/, "")
}

const SOURCE_LABELS: Record<string, string> = { bln: "BLN3" }

/**
 * Renders the detail page of a single measure in the catalogue.
 */
export default function MeasureCatalogueDetail() {
  const { measure, conflicts, variants } = useLoaderData<typeof loader>()
  const sourceLabel = SOURCE_LABELS[measure.m_source] ?? measure.m_source
  const lastChanged = measure.updated ?? measure.created
  const isInactive = measure.m_status === "inactive"
  const effectType = getEffectTypeInfo(measure.m_effect_type)
  const indicators = getImpactedIndicators(measure.m_impacts_score, measure.m_effect_size)
  const conditions = formatConditions(measure.m_applicability)
  const references = getMeasureReferences(measure.m_external_ids, measure.m_source_url)

  return (
    <>
      <Header action={undefined}>
        <HeaderMeasuresCatalogue measureName={measure.m_name} />
      </Header>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-6">
        <Link
          to="/measures-catalogue"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Terug naar catalogus
        </Link>

        {isInactive && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Deze maatregel staat niet meer in de {sourceLabel}-catalogus. U kunt hem niet meer
              toevoegen; percelen waarop hij al is vastgelegd houden hem.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{sourceLabel}</Badge>
            {measure.m_stage_applicability === "farm" && (
              <Badge variant="outline">Bedrijfsniveau</Badge>
            )}
            {measure.m_stage_applicability === "field" && (
              <Badge variant="outline">Perceelsniveau</Badge>
            )}
            {isInactive && <Badge variant="secondary">Niet meer beschikbaar</Badge>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-muted-foreground mr-2 font-mono text-lg">
              {getMeasureCode(measure.m_id)}
            </span>
            {measure.m_name}
          </h1>
          {measure.m_summary && (
            <p className="text-muted-foreground text-base leading-relaxed">{measure.m_summary}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FactCard title="Kosten">
            {measure.m_effect_costs !== null && measure.m_effect_costs !== undefined ? (
              <MeasureCostIndicator costs={measure.m_effect_costs} long className="text-sm" />
            ) : (
              <span className="text-muted-foreground text-sm">Onbekend</span>
            )}
          </FactCard>
          <FactCard title="Effect">
            {effectType ? (
              <p className="text-sm font-medium">{effectType.label}</p>
            ) : (
              <span className="text-muted-foreground text-sm">Onbekend</span>
            )}
          </FactCard>
          <FactCard title="Referenties">
            {references.length > 0 ? (
              <dl className="space-y-1 text-sm">
                {references.map((ref) => (
                  <div key={ref.key} className="flex justify-between gap-2">
                    {ref.label && <dt className="text-muted-foreground shrink-0">{ref.label}</dt>}
                    <dd className={ref.label ? "min-w-0 text-right" : "min-w-0"}>
                      {ref.href ? (
                        <a
                          href={ref.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={ref.href}
                          className="text-primary inline-flex max-w-full items-center gap-1 underline-offset-2 hover:underline"
                        >
                          <span className="truncate">{ref.value}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </a>
                      ) : (
                        ref.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <span className="text-muted-foreground text-sm">Geen</span>
            )}
          </FactCard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Beschrijving</CardTitle>
          </CardHeader>
          <CardContent>
            {measure.m_description ? (
              <p className="text-sm leading-relaxed whitespace-pre-line">{measure.m_description}</p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Voor deze maatregel is geen beschrijving beschikbaar.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Impact op indicatoren</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {indicators.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Voor deze maatregel zijn geen indicatoren bekend.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  Volgens {sourceLabel} heeft deze maatregel effect op{" "}
                  {indicators.length === 1
                    ? "deze indicator"
                    : `deze ${indicators.length} indicatoren`}
                  .{" "}
                  {measure.m_effect_type === "classed" &&
                    "Hoe groot het effect is, hangt af van de omstandigheden op het perceel. "}
                  Het verwachte effect op uw eigen percelen ziet u bij Maatregelen van uw bedrijf.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicator</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Thema</TableHead>
                      <TableHead className="text-right">Effectgrootte</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {indicators.map((indicator) => (
                      <TableRow key={indicator.id}>
                        <TableCell className="font-medium">{indicator.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {indicator.id}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {indicator.ecosysteemdienst ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatEffectRange(indicator.effectRange)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Toepasbaarheid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {conditions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Voor deze maatregel gelden geen voorwaarden.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  De maatregel is van toepassing als aan alle voorwaarden is voldaan. Of dat voor uw
                  perceel zo is, wordt per perceel gecontroleerd bij Maatregelen van uw bedrijf.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voorwaarde</TableHead>
                      <TableHead>Waarde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conditions.map((condition, index) => (
                      <TableRow key={`${condition.variable}-${index}`}>
                        <TableCell className="font-medium">{condition.label}</TableCell>
                        <TableCell className="whitespace-normal">{condition.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conflicterende maatregelen</CardTitle>
          </CardHeader>
          <CardContent>
            {conflicts.length === 0 ? (
              <p className="text-muted-foreground text-sm">Geen conflicterende maatregelen.</p>
            ) : (
              <>
                <p className="text-muted-foreground mb-3 text-sm">
                  Deze maatregel kan niet tegelijk met de volgende maatregelen op hetzelfde perceel
                  worden genomen.
                </p>
                <MeasureList items={conflicts} />
              </>
            )}
          </CardContent>
        </Card>

        {variants.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Andere varianten van deze maatregel</CardTitle>
            </CardHeader>
            <CardContent>
              <MeasureList items={variants} />
            </CardContent>
          </Card>
        )}

        <footer className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-4 text-xs">
          <span>Catalogus: NMI {sourceLabel}</span>
          <span>
            Laatst bijgewerkt: {format(new Date(lastChanged), "d MMMM yyyy", { locale: nl })}
          </span>
        </footer>
      </main>
    </>
  )
}

function FactCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</p>
      {children}
    </div>
  )
}

/**
 * List of linked catalogue measures; inactive measures are marked.
 */
function MeasureList({ items }: { items: { m_id: string; m_name: string; inactive: boolean }[] }) {
  return (
    <ul className="divide-y rounded-md border">
      {items.map((item) => (
        <li key={item.m_id}>
          <Link
            to={getMeasureCataloguePath(item.m_id)}
            className="hover:bg-muted/50 flex items-center gap-2 px-3 py-2 text-sm transition-colors"
          >
            <span className="text-muted-foreground shrink-0 font-mono text-xs">
              {getMeasureCode(item.m_id)}
            </span>
            <span className="min-w-0 flex-1 truncate">{item.m_name}</span>
            {item.inactive && (
              <Badge variant="secondary" className="text-xs">
                Niet meer beschikbaar
              </Badge>
            )}
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
