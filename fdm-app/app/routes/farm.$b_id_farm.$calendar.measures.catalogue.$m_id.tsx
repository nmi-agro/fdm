import { checkPermission, getMeasuresFromCatalogue } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { AlertTriangle, ChevronRight, ExternalLink, Plus } from "lucide-react"
import { type ReactNode, Suspense, useEffect, useState } from "react"
import {
  Await,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  Link,
  useLoaderData,
  useParams,
  useSearchParams,
} from "react-router"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { MeasureCostIndicator } from "~/components/blocks/measures/measure-cost-indicator"
import { MeasureStatusLabel } from "~/components/blocks/measures/measure-status"
import {
  type MeasureStatusAvailability,
  MeasureStatusUnavailable,
} from "~/components/blocks/measures/measure-status-unavailable"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button, buttonVariants } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Skeleton } from "~/components/ui/skeleton"
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
  type ImpactedIndicator,
} from "~/lib/measure-labels"
import { getAddMeasurePath, getMeasureCataloguePath } from "~/lib/measures-catalogue"

export const handle: HelpHandle = { help: "maatregelencatalogus" }

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

/** The fields with their status for the measure, and which parts of the status could be loaded. */
type MeasureFieldsStatus = MeasureStatusAvailability & {
  fields: FieldMeasureEntry[]
}

/**
 * Loads one catalogue measure, the measures it conflicts with, the other variants of the
 * same measure and whether the user may add measures to the farm. The fields of the farm on
 * which the measure is applied, recommended or applicable need NMI requests per field, so
 * they are returned as a promise and fill in after the page renders. Throws a 404 for an
 * unknown `m_id`.
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

    const [catalogue, farmWritePermission] = await Promise.all([
      getMeasuresFromCatalogue(fdm),
      checkPermission(
        fdm,
        "farm",
        "write",
        b_id_farm,
        session.principal_id,
        "routes/farm.$b_id_farm.$calendar.measures.catalogue.$m_id",
        false,
      ),
    ])
    const measure = catalogue.find((item) => item.m_id === m_id)
    if (!measure) {
      throw data("Maatregel niet gevonden", { status: 404 })
    }

    const fieldsStatus: Promise<MeasureFieldsStatus> = getFarmMeasureStatus({
      principal_id: session.principal_id,
      b_id_farm,
      calendar,
      timeframe,
      catalogue,
    }).then((status) => ({
      fields: status.fieldsByMeasure.get(measure.m_id) ?? [],
      recommendationsAvailable: status.recommendationsAvailable,
      applicabilityAvailable: status.applicabilityAvailable,
      eligibleFieldCount: status.eligibleFieldCount,
      applicabilityFailedFieldCount: status.applicabilityFailedFieldCount,
    }))

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

    return { measure, conflicts, variants, farmWritePermission, fieldsStatus }
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

/** Fields per indicator on which the measure is recommended to improve that indicator. */
function countRecommendedFieldsByIndicator(fields: FieldMeasureEntry[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const field of fields) {
    if (field.status !== "recommended") continue
    for (const indicatorId of field.indicatorIds ?? []) {
      counts.set(indicatorId, (counts.get(indicatorId) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * Renders the detail page of a measure in the catalogue of a farm.
 */
export default function MeasureCatalogueDetail() {
  const { measure, conflicts, variants, farmWritePermission, fieldsStatus } =
    useLoaderData<typeof loader>()
  const { b_id_farm = "", calendar = "" } = useParams()
  const isInactive = measure.m_status === "inactive"
  const isFarmLevel = measure.m_stage_applicability === "farm"
  const canAdd = farmWritePermission && !isInactive && !isFarmLevel
  const effectType = getEffectTypeInfo(measure.m_effect_type)
  const indicators = getImpactedIndicators(measure.m_impacts_score, measure.m_effect_size)
  const conditions = formatConditions(measure.m_applicability)
  const references = getMeasureReferences(measure.m_external_ids, measure.m_source_url)

  return (
    <>
      <FarmTitle
        title={measure.m_name}
        help="maatregelencatalogus"
        wrapTitle
        description=""
        descriptionNode={
          <p className="text-muted-foreground">
            {getMeasureCode(measure.m_id)}
            {measure.m_summary ? ` · ${measure.m_summary}` : ""}
          </p>
        }
        rightNode={
          <div className="flex flex-wrap items-center gap-2">
            {isFarmLevel && <Badge variant="outline">Bedrijfsniveau</Badge>}
            {measure.m_stage_applicability === "field" && (
              <Badge variant="outline">Perceelsniveau</Badge>
            )}
            {isInactive && <Badge variant="secondary">Niet meer beschikbaar</Badge>}
            {canAdd && (
              <Suspense fallback={<AddMeasureLink m_id={measure.m_id} fieldIds={[]} />}>
                <Await
                  resolve={fieldsStatus}
                  errorElement={<AddMeasureLink m_id={measure.m_id} fieldIds={[]} />}
                >
                  {(loaded) => (
                    <AddMeasureLink
                      m_id={measure.m_id}
                      fieldIds={loaded.fields
                        .filter((field) => field.status === "recommended")
                        .map((field) => field.b_id)}
                    />
                  )}
                </Await>
              </Suspense>
            )}
          </div>
        }
      />
      <FarmContent>
        <div className="@container/measure space-y-6 pb-10">
          {isInactive && (
            <Alert>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Deze maatregel staat niet meer in de catalogus. U kunt hem niet meer toevoegen;
                percelen waarop hij al is vastgelegd houden hem.
              </AlertDescription>
            </Alert>
          )}
          {isFarmLevel && !isInactive && farmWritePermission && (
            <p className="text-muted-foreground max-w-[75ch] text-sm">
              Deze maatregel geldt voor het hele bedrijf. Maatregelen legt u per perceel vast,
              daarom kunt u deze maatregel hier niet toevoegen.
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 @4xl/measure:grid-cols-3">
            <div className="min-w-0 space-y-6 @4xl/measure:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle role="heading" aria-level={3}>
                    Beschrijving
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="max-w-[75ch] text-sm leading-relaxed whitespace-pre-line">
                    {measure.m_description ||
                      "Voor deze maatregel is geen beschrijving beschikbaar."}
                  </p>
                </CardContent>
              </Card>

              <Suspense fallback={<FieldsCardSkeleton calendar={calendar} />}>
                <Await
                  resolve={fieldsStatus}
                  errorElement={
                    <FieldsCardShell calendar={calendar}>
                      <MeasureStatusUnavailable availability="failed" />
                    </FieldsCardShell>
                  }
                >
                  {(loaded) => (
                    <FieldsCard
                      key={measure.m_id}
                      loaded={loaded}
                      basePath={`/farm/${b_id_farm}/${calendar}/measures`}
                      calendar={calendar}
                    />
                  )}
                </Await>
              </Suspense>
            </div>

            <Card className="h-fit min-w-0">
              <CardHeader>
                <CardTitle role="heading" aria-level={3}>
                  Kenmerken
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4 text-sm">
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Kosten</dt>
                    <dd>
                      {measure.m_effect_costs !== null && measure.m_effect_costs !== undefined ? (
                        <MeasureCostIndicator costs={measure.m_effect_costs} long />
                      ) : (
                        <span className="text-muted-foreground">Onbekend</span>
                      )}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Effect</dt>
                    <dd>
                      {effectType ? (
                        <>
                          <span>{effectType.label}</span>
                          {effectType.description && (
                            <span className="text-muted-foreground mt-1 block leading-relaxed">
                              {effectType.description}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Onbekend</span>
                      )}
                    </dd>
                  </div>
                  {conflicts.length === 0 && (
                    <div className="space-y-1">
                      <dt className="text-muted-foreground">Conflicterende maatregelen</dt>
                      <dd>Geen</dd>
                    </div>
                  )}
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Referenties</dt>
                    <dd>
                      {references.length === 0 ? (
                        <span className="text-muted-foreground">Geen</span>
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
                                  <span>{ref.value}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                  <span className="sr-only">(opent in nieuw tabblad)</span>
                                </a>
                              ) : (
                                <span>
                                  <span className="text-muted-foreground">
                                    Code in {ref.label}:
                                  </span>{" "}
                                  <span className="tabular-nums">{ref.value}</span>
                                </span>
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

          <div className="grid grid-cols-1 gap-6 @3xl/measure:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle role="heading" aria-level={3}>
                  Impact op indicatoren
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {indicators.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Voor deze maatregel zijn geen indicatoren bekend.
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground text-sm">
                      Deze maatregel heeft effect op{" "}
                      {indicators.length === 1
                        ? "deze indicator"
                        : `deze ${indicators.length} indicatoren`}
                      . De effectgrootte komt uit de BLN-catalogus: hoe sterk de maatregel de score
                      van de indicator verandert.
                      {measure.m_effect_type === "classed" &&
                        " Hoe groot het effect is, hangt af van de omstandigheden op het perceel."}
                    </p>
                    <Suspense fallback={<ImpactTable indicators={indicators} />}>
                      <Await
                        resolve={fieldsStatus}
                        errorElement={<ImpactTable indicators={indicators} />}
                      >
                        {(loaded) => (
                          <ImpactTable
                            indicators={indicators}
                            recommendedByIndicator={
                              loaded.recommendationsAvailable
                                ? countRecommendedFieldsByIndicator(loaded.fields)
                                : undefined
                            }
                          />
                        )}
                      </Await>
                    </Suspense>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle role="heading" aria-level={3}>
                  Toepasbaarheid
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {conditions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {(measure.m_applicability ?? []).length > 0
                      ? `Er gelden geen voorwaarden voor het perceel. De maatregel geldt op ${isFarmLevel ? "bedrijfsniveau" : "perceelsniveau"}.`
                      : "Voor deze maatregel gelden geen voorwaarden."}
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground text-sm">
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

            {conflicts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle role="heading" aria-level={3}>
                    Conflicterende maatregelen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-muted-foreground text-sm">
                    Deze maatregel kan niet tegelijk met de volgende maatregelen op hetzelfde
                    perceel worden genomen.
                  </p>
                  <MeasureList items={conflicts} b_id_farm={b_id_farm} calendar={calendar} />
                </CardContent>
              </Card>
            )}

            {variants.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle role="heading" aria-level={3}>
                    Andere varianten van deze maatregel
                  </CardTitle>
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

/**
 * Primary action of the detail page: opens the measures page of the farm with the dialog to
 * add this measure, with the fields on which it is recommended already selected.
 */
function AddMeasureLink({ m_id, fieldIds }: { m_id: string; fieldIds: string[] }) {
  const { b_id_farm = "", calendar = "" } = useParams()
  return (
    <Link
      to={getAddMeasurePath(b_id_farm, calendar, m_id, fieldIds)}
      className={buttonVariants({ className: "gap-1.5 pointer-coarse:h-11" })}
      data-slot="button"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      <span>Toevoegen aan percelen</span>
    </Link>
  )
}

/**
 * The indicators the measure affects with the catalogue's effect size and, once the
 * recommendations are loaded, on how many fields of this farm the measure is recommended to
 * improve that indicator.
 */
function ImpactTable({
  indicators,
  recommendedByIndicator,
}: {
  indicators: ImpactedIndicator[]
  recommendedByIndicator?: Map<string, number>
}) {
  const showFarm = recommendedByIndicator !== undefined && recommendedByIndicator.size > 0
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Indicator</TableHead>
          <TableHead className="hidden sm:table-cell">Thema</TableHead>
          <TableHead className="text-right">Effectgrootte</TableHead>
          {showFarm && <TableHead className="text-right">Aanbevolen op</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {indicators.map((indicator) => {
          const recommended = recommendedByIndicator?.get(indicator.id) ?? 0
          return (
            <TableRow key={indicator.id}>
              <TableCell className="font-medium whitespace-normal">{indicator.name}</TableCell>
              <TableCell className="text-muted-foreground hidden sm:table-cell">
                {indicator.ecosysteemdienst ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatEffectRange(indicator.effectRange)}
              </TableCell>
              {showFarm && (
                <TableCell className="text-right tabular-nums">
                  {recommended === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : recommended === 1 ? (
                    "1 perceel"
                  ) : (
                    `${recommended} percelen`
                  )}
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

type FieldFilter = "all" | FieldMeasureStatus

const FIELD_FILTERS: { value: FieldFilter; label: string }[] = [
  { value: "all", label: "Alle percelen" },
  { value: "applied", label: "Toegepast" },
  { value: "recommended", label: "Aanbevolen" },
  { value: "applicable", label: "Toepasbaar" },
]

/** Number of fields shown on a touch screen before "Toon alle … percelen". */
const TOUCH_VISIBLE_FIELDS = 6

/** URL search parameter that keeps the field filter, so Back returns to the same view. */
const FIELD_FILTER_PARAM = "percelen"

/** The frame of the fields card, shared by the loaded, loading and failed states. */
function FieldsCardShell({
  calendar,
  action,
  children,
}: {
  calendar: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle role="heading" aria-level={3}>
          Percelen in {calendar}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="@container/fields space-y-3">{children}</CardContent>
    </Card>
  )
}

/** Placeholder for the fields card while the status per field loads. */
function FieldsCardSkeleton({ calendar }: { calendar: string }) {
  return (
    <FieldsCardShell calendar={calendar}>
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Status per perceel laden…
      </p>
      <div className="divide-y rounded-md border" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </FieldsCardShell>
  )
}

/**
 * Lists the fields of the farm on which the measure is applied, recommended or applicable,
 * applied first. About five rows are visible; the rest scroll inside the card.
 */
function FieldsCard({
  loaded,
  basePath,
  calendar,
}: {
  loaded: MeasureFieldsStatus
  basePath: string
  calendar: string
}) {
  const { fields } = loaded
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState<FieldFilter>(() => {
    const value = searchParams.get(FIELD_FILTER_PARAM)
    return FIELD_FILTERS.some((option) => option.value === value) ? (value as FieldFilter) : "all"
  })

  // Keep the filter in the URL without a navigation, which would load the status again
  useEffect(() => {
    const url = new URL(window.location.href)
    if (filter === "all") url.searchParams.delete(FIELD_FILTER_PARAM)
    else url.searchParams.set(FIELD_FILTER_PARAM, filter)
    if (url.href !== window.location.href) {
      window.history.replaceState(window.history.state, "", url)
    }
  }, [filter])

  const counts = { applied: 0, recommended: 0, applicable: 0 }
  for (const field of fields) counts[field.status] += 1
  const visible = filter === "all" ? fields : fields.filter((field) => field.status === filter)
  const [showAll, setShowAll] = useState(false)
  const filterItems = FIELD_FILTERS.map((option) => ({
    value: option.value,
    label: option.value === "all" ? option.label : `${option.label} (${counts[option.value]})`,
  }))

  return (
    <FieldsCardShell
      calendar={calendar}
      action={
        fields.length > 0 ? (
          <Select
            value={filter}
            items={filterItems}
            onValueChange={(next) => {
              if (next !== null) setFilter(next)
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-44 pointer-coarse:data-[size=sm]:h-11"
              aria-label="Toon percelen"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterItems.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null
      }
    >
      <MeasureStatusUnavailable availability={loaded} />
      {fields.length === 0 ? (
        <p className="text-muted-foreground max-w-[75ch] text-sm">
          Deze maatregel is in {calendar} op geen enkel perceel toegepast, aanbevolen of toepasbaar.
          Percelen zonder BLN3-score, zoals bufferstroken en natuur, tellen hier niet mee.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">Geen percelen met deze status.</p>
      ) : (
        <>
          <ul
            role="region"
            aria-label={`Percelen met deze maatregel in ${calendar}`}
            // Scrollable with a mouse or trackpad, so it must be reachable with the keyboard
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            className="focus-visible:ring-ring divide-y rounded-md border focus-visible:ring-2 focus-visible:outline-none pointer-fine:max-h-[14.5rem] pointer-fine:overflow-y-auto"
          >
            {visible.map((field, index) => (
              <li
                key={`${field.b_id}-${field.status}`}
                // On touch a list that scrolls inside the page is hard to use: show the first
                // rows and a button for the rest instead
                className={
                  !showAll && index >= TOUCH_VISIBLE_FIELDS ? "pointer-coarse:hidden" : undefined
                }
              >
                <Link
                  to={`${basePath}/${field.b_id}`}
                  className="hover:bg-muted/50 focus-visible:ring-ring flex items-center gap-3 px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset @md/fields:min-h-11 @md/fields:py-0"
                >
                  {/* Narrow card: name on its own line, status and period below it */}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 @md/fields:flex-row @md/fields:items-center @md/fields:gap-3">
                    <span className="min-w-0 font-medium wrap-break-word @md/fields:flex-1 @md/fields:truncate">
                      {field.b_name ?? field.b_id}
                    </span>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 @md/fields:shrink-0 @md/fields:flex-nowrap">
                      {field.status === "applied" && (
                        <span className="text-muted-foreground tabular-nums">
                          {formatPeriod(field.m_start, field.m_end)}
                        </span>
                      )}
                      <MeasureStatusLabel status={field.status} className="@md/fields:w-28" />
                    </div>
                  </div>
                  <ChevronRight
                    className="text-muted-foreground h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
          {!showAll && visible.length > TOUCH_VISIBLE_FIELDS && (
            <Button
              type="button"
              variant="outline"
              className="hidden w-full pointer-coarse:inline-flex pointer-coarse:h-11"
              onClick={() => setShowAll(true)}
            >
              <span>{`Toon alle ${visible.length} percelen`}</span>
            </Button>
          )}
        </>
      )}
    </FieldsCardShell>
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
            className="hover:bg-muted/50 focus-visible:ring-ring flex items-center gap-2 px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset pointer-coarse:min-h-11"
          >
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {getMeasureCode(item.m_id)}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{item.m_name}</span>
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
