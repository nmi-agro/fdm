import { getMeasureFromCatalogue, getMeasuresFromCatalogue } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { AlertTriangle, ChevronRight, ExternalLink } from "lucide-react"
import { useState } from "react"
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  Link,
  useLoaderData,
  useParams,
} from "react-router"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { MeasureCostIndicator } from "~/components/blocks/measures/measure-cost-indicator"
import { MeasureStatusLabel } from "~/components/blocks/measures/measure-status"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import {
  type FieldMeasureEntry,
  type FieldMeasureStatus,
  getFarmMeasureStatus,
} from "~/lib/farm-measures.server"
import { fdm } from "~/lib/fdm.server"
import { getMeasureFamilyId } from "~/lib/indicators"
import {
  formatConditions,
  formatEffectRange,
  getEffectTypeInfo,
  getImpactedIndicators,
  getMeasureReferences,
} from "~/lib/measure-labels"
import { getMeasureCataloguePath } from "~/lib/measures-catalogue"

/**
 * Sets the page title and description from the name and summary of the measure.
 */
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
 * Loads one catalogue measure, the measures it conflicts with, the other variants of the
 * same measure and the fields of the farm on which it is applied, recommended or applicable.
 * Throws a 404 for an unknown `m_id`.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { b_id_farm, m_id } = params
    if (!b_id_farm) {
      throw data("invalid: b_id_farm", { status: 400, statusText: "invalid: b_id_farm" })
    }
    if (!m_id) {
      throw data("Maatregel ID is verplicht", { status: 400 })
    }
    const session = await getSession(request)
    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)

    const [measure, catalogue] = await Promise.all([
      getMeasureFromCatalogue(fdm, m_id),
      getMeasuresFromCatalogue(fdm),
    ])
    if (!measure) {
      throw data("Maatregel niet gevonden", { status: 404 })
    }

    const status = await getFarmMeasureStatus({
      principal_id: session.principal_id,
      b_id_farm,
      calendar,
      timeframe,
      catalogue,
    })

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

    return {
      measure,
      conflicts,
      variants,
      fields: status.fieldsByMeasure.get(measure.m_id) ?? [],
      recommendationsAvailable: status.recommendationsAvailable,
      applicabilityAvailable: status.applicabilityAvailable,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/** Short measure code without the source prefix, e.g. `BM7` for `bln_BM7`. */
function getMeasureCode(m_id: string): string {
  return m_id.replace(/^bln_/, "")
}

/**
 * Formats the period in which a measure is applied, e.g. "1-3-2026 – doorlopend".
 *
 * @param start - First day of the measure, or `null` when unknown.
 * @param end - Last day of the measure, or `null` when it is ongoing.
 */
function formatPeriod(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
) {
  const formatDate = (value: Date | string) => format(new Date(value), "d-M-yyyy", { locale: nl })
  return `${start ? formatDate(start) : "?"} – ${end ? formatDate(end) : "doorlopend"}`
}

/**
 * Renders the detail page of a measure in the catalogue of a farm.
 */
export default function MeasureCatalogueDetail() {
  const { measure, conflicts, variants, fields, recommendationsAvailable, applicabilityAvailable } =
    useLoaderData<typeof loader>()
  const { b_id_farm = "", calendar = "" } = useParams()
  const isInactive = measure.m_status === "inactive"
  const effectType = getEffectTypeInfo(measure.m_effect_type)
  const indicators = getImpactedIndicators(measure.m_impacts_score, measure.m_effect_size)
  const conditions = formatConditions(measure.m_applicability)
  const references = getMeasureReferences(measure.m_external_ids, measure.m_source_url)

  return (
    <>
      <FarmTitle
        title={measure.m_name}
        description=""
        descriptionNode={
          <p className="text-muted-foreground">
            {getMeasureCode(measure.m_id)}
            {measure.m_summary ? ` · ${measure.m_summary}` : ""}
          </p>
        }
        rightNode={
          <div className="flex flex-wrap gap-2">
            {measure.m_stage_applicability === "farm" && (
              <Badge variant="outline">Bedrijfsniveau</Badge>
            )}
            {measure.m_stage_applicability === "field" && (
              <Badge variant="outline">Perceelsniveau</Badge>
            )}
            {isInactive && <Badge variant="secondary">Niet meer beschikbaar</Badge>}
          </div>
        }
      />
      <FarmContent>
        <div className="space-y-6 pb-10">
          {isInactive && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                Deze maatregel staat niet meer in de catalogus. U kunt hem niet meer toevoegen;
                percelen waarop hij al is vastgelegd houden hem.
              </p>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Beschrijving</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="max-w-[75ch] text-sm leading-relaxed whitespace-pre-line">
                    {measure.m_description ||
                      "Voor deze maatregel is geen beschrijving beschikbaar."}
                  </p>
                </CardContent>
              </Card>

              <FieldsCard
                key={measure.m_id}
                fields={fields}
                basePath={`/farm/${b_id_farm}/${calendar}/measures`}
                calendar={calendar}
                recommendationsAvailable={recommendationsAvailable}
                applicabilityAvailable={applicabilityAvailable}
              />
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Kenmerken</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4 text-sm">
                  <div className="space-y-1">
                    <dt className="font-medium">Kosten</dt>
                    <dd>
                      {measure.m_effect_costs !== null && measure.m_effect_costs !== undefined ? (
                        <MeasureCostIndicator costs={measure.m_effect_costs} long />
                      ) : (
                        "Onbekend"
                      )}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="font-medium">Effect</dt>
                    <dd>
                      {effectType ? (
                        <>
                          {effectType.label}
                          {effectType.description && (
                            <span className="block leading-relaxed">{effectType.description}</span>
                          )}
                        </>
                      ) : (
                        "Onbekend"
                      )}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="font-medium">Referenties</dt>
                    <dd>
                      {references.length === 0 ? (
                        "Geen"
                      ) : (
                        <ul className="space-y-1">
                          {references.map((ref) => (
                            <li key={ref.key}>
                              {ref.href ? (
                                <a
                                  href={ref.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={ref.href}
                                  className="inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline"
                                >
                                  {ref.value}
                                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                </a>
                              ) : (
                                `${ref.label} ${ref.value}`
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Impact op indicatoren</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {indicators.length === 0 ? (
                  <p className="text-sm">Voor deze maatregel zijn geen indicatoren bekend.</p>
                ) : (
                  <>
                    <p className="text-sm">
                      Deze maatregel heeft effect op{" "}
                      {indicators.length === 1
                        ? "deze indicator"
                        : `deze ${indicators.length} indicatoren`}
                      .
                      {measure.m_effect_type === "classed" &&
                        " Hoe groot het effect is, hangt af van de omstandigheden op het perceel."}
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Indicator</TableHead>
                          <TableHead>Thema</TableHead>
                          <TableHead className="text-right">Effectgrootte</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {indicators.map((indicator) => (
                          <TableRow key={indicator.id}>
                            <TableCell className="font-medium">{indicator.name}</TableCell>
                            <TableCell>{indicator.ecosysteemdienst ?? "—"}</TableCell>
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
                  <p className="text-sm">Voor deze maatregel gelden geen voorwaarden.</p>
                ) : (
                  <>
                    <p className="text-sm">
                      De maatregel is van toepassing als aan alle voorwaarden is voldaan.
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
              <CardContent className="space-y-3">
                {conflicts.length === 0 ? (
                  <p className="text-sm">Geen conflicterende maatregelen.</p>
                ) : (
                  <>
                    <p className="text-sm">
                      Deze maatregel kan niet tegelijk met de volgende maatregelen op hetzelfde
                      perceel worden genomen.
                    </p>
                    <MeasureList items={conflicts} b_id_farm={b_id_farm} calendar={calendar} />
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
                  <MeasureList items={variants} b_id_farm={b_id_farm} calendar={calendar} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </FarmContent>
    </>
  )
}

type FieldFilter = "all" | FieldMeasureStatus

const FIELD_FILTERS: { value: FieldFilter; label: string }[] = [
  { value: "all", label: "Alle percelen" },
  { value: "applied", label: "Toegepast" },
  { value: "recommended", label: "Aanbevolen" },
  { value: "applicable", label: "Toepasbaar" },
]

/**
 * Lists the fields of the farm on which the measure is applied, recommended or applicable,
 * applied first. About five rows are visible; the rest scroll inside the card.
 */
function FieldsCard({
  fields,
  basePath,
  calendar,
  recommendationsAvailable,
  applicabilityAvailable,
}: {
  fields: FieldMeasureEntry[]
  basePath: string
  calendar: string
  recommendationsAvailable: boolean
  applicabilityAvailable: boolean
}) {
  const [filter, setFilter] = useState<FieldFilter>("all")
  const counts = { applied: 0, recommended: 0, applicable: 0 }
  for (const field of fields) counts[field.status] += 1
  const visible = filter === "all" ? fields : fields.filter((field) => field.status === filter)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Percelen in {calendar}</CardTitle>
        {fields.length > 0 && (
          <Select value={filter} onValueChange={(v) => setFilter(v as FieldFilter)}>
            <SelectTrigger className="h-8 w-40" aria-label="Toon percelen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                  {option.value !== "all" ? ` (${counts[option.value]})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.length === 0 ? (
          <p className="text-sm">
            Deze maatregel is op geen enkel perceel toegepast, aanbevolen of toepasbaar.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {(["applied", "recommended", "applicable"] as const).map((key) =>
                counts[key] > 0 ? (
                  <MeasureStatusLabel key={key} status={key} count={counts[key]} />
                ) : null,
              )}
            </div>
            {visible.length === 0 ? (
              <p className="text-sm">Geen percelen met deze status.</p>
            ) : (
              <ul className="max-h-[14.5rem] divide-y overflow-y-auto rounded-md border">
                {visible.map((field) => (
                  <li key={`${field.b_id}-${field.status}`}>
                    <Link
                      to={`${basePath}/${field.b_id}`}
                      className="hover:bg-muted/50 flex h-11 items-center gap-3 px-3 text-sm transition-colors"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {field.b_name ?? field.b_id}
                      </span>
                      {field.status === "applied" && (
                        <span className="hidden shrink-0 sm:inline">
                          {formatPeriod(field.m_start, field.m_end)}
                        </span>
                      )}
                      <MeasureStatusLabel status={field.status} className="w-28 shrink-0" />
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {(!recommendationsAvailable || !applicabilityAvailable) && (
          <p className="text-sm">
            {!recommendationsAvailable && !applicabilityAvailable
              ? "Aanbevolen en toepasbare percelen konden niet worden geladen."
              : !recommendationsAvailable
                ? "Aanbevolen percelen konden niet worden geladen."
                : "Toepasbare percelen konden niet worden geladen."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * List of linked catalogue measures of the same farm; inactive measures are marked.
 */
function MeasureList({
  items,
  b_id_farm,
  calendar,
}: {
  items: { m_id: string; m_name: string; inactive: boolean }[]
  b_id_farm: string
  calendar: string
}) {
  return (
    <ul className="divide-y rounded-md border">
      {items.map((item) => (
        <li key={item.m_id}>
          <Link
            to={getMeasureCataloguePath(b_id_farm, calendar, item.m_id)}
            className="hover:bg-muted/50 flex items-center gap-2 px-3 py-2 text-sm transition-colors"
          >
            <span className="shrink-0">{getMeasureCode(item.m_id)}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{item.m_name}</span>
            {item.inactive && (
              <Badge variant="secondary" className="text-xs">
                Niet meer beschikbaar
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
