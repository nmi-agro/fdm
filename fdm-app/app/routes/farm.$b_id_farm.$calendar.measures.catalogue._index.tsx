import type { MeasureCatalogue } from "@nmi-agro/fdm-core"
import { getMeasuresFromCatalogue } from "@nmi-agro/fdm-core"
import { cn } from "cn"
import fuzzysort from "fuzzysort"
import { ChevronRight, Search, SearchX, SlidersHorizontal, X } from "lucide-react"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
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
import { Bln3HelpDialog } from "~/components/blocks/indicators/bln3-help-dialog"
import { MeasureCostIndicator } from "~/components/blocks/measures/measure-cost-indicator"
import { MeasureStatusLabel } from "~/components/blocks/measures/measure-status"
import {
  type MeasureStatusAvailability,
  MeasureStatusUnavailable,
} from "~/components/blocks/measures/measure-status-unavailable"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Skeleton } from "~/components/ui/skeleton"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { type FieldMeasureStatus, getFarmMeasureStatus } from "~/lib/farm-measures.server"
import { fdm } from "~/lib/fdm.server"
import { ECOSYSTEEMDIENSTEN, type Ecosysteemdienst } from "~/lib/indicators"
import { getEffectTypeInfo, getImpactedIndicators, MEASURE_COST_LEVELS } from "~/lib/measure-labels"
import { getMeasureCataloguePath } from "~/lib/measures-catalogue"

export const handle: HelpHandle = { help: "maatregelencatalogus" }

/**
 * Sets the page title and description of the measures catalogue.
 */
export const meta: MetaFunction = () => {
  return [
    { title: `Maatregelencatalogus | Maatregelen | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Bekijk alle bodemmaatregelen: wat ze inhouden, wat ze kosten, op welke indicatoren ze effect hebben en op welke percelen ze zijn toegepast, aanbevolen of toepasbaar.",
    },
  ]
}

type StatusCounts = Record<FieldMeasureStatus, number>

/** Per measure the number of fields per status, and which parts of the status could be loaded. */
type CatalogueStatus = MeasureStatusAvailability & {
  countsByMeasure: Record<string, StatusCounts>
}

/**
 * Loads the measures catalogue and, per measure, on how many fields of the farm it is
 * applied, recommended or applicable in the selected year.
 *
 * The status needs NMI requests per field and can take seconds, so it is returned as a
 * promise: the catalogue renders first and the status fills in when it arrives.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("invalid: b_id_farm", { status: 400, statusText: "invalid: b_id_farm" })
    }
    const session = await getSession(request)
    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)

    const catalogue = await getMeasuresFromCatalogue(fdm)
    const status: Promise<CatalogueStatus> = getFarmMeasureStatus({
      principal_id: session.principal_id,
      b_id_farm,
      calendar,
      timeframe,
      catalogue,
    }).then((result) => {
      const countsByMeasure: Record<string, StatusCounts> = {}
      for (const [m_id, fields] of result.fieldsByMeasure) {
        const counts: StatusCounts = { applied: 0, recommended: 0, applicable: 0 }
        for (const field of fields) counts[field.status] += 1
        countsByMeasure[m_id] = counts
      }
      return {
        countsByMeasure,
        recommendationsAvailable: result.recommendationsAvailable,
        applicabilityAvailable: result.applicabilityAvailable,
        eligibleFieldCount: result.eligibleFieldCount,
        applicabilityFailedFieldCount: result.applicabilityFailedFieldCount,
      }
    })

    return { catalogue, status }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

type SortMode = "name" | "code" | "recommended"
type StatusFilter = "all" | FieldMeasureStatus

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "name", label: "Alfabetisch" },
  { value: "code", label: "Op code" },
  { value: "recommended", label: "Meest aanbevolen" },
]

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Alle maatregelen",
  applied: "Toegepast",
  recommended: "Aanbevolen",
  applicable: "Toepasbaar",
}

const STATUS_FILTERS = Object.keys(STATUS_LABELS) as StatusFilter[]

/** The status as an adjective before "maatregelen", e.g. "Toepasbare maatregelen". */
const STATUS_ADJECTIVES: Record<FieldMeasureStatus, string> = {
  applied: "Toegepaste",
  recommended: "Aanbevolen",
  applicable: "Toepasbare",
}

/** Effect types in the order the filter lists them; only types in the catalogue are shown. */
const EFFECT_TYPE_ORDER = ["qual", "classed", "quant"]

const NO_COUNTS: StatusCounts = { applied: 0, recommended: 0, applicable: 0 }

/** Names of the URL search parameters that hold the search and the filters. */
const PARAM = {
  query: "q",
  sort: "sorteer",
  status: "status",
  effectType: "effect",
  costLevel: "kosten",
  theme: "thema",
} as const

/**
 * Returns the value of a URL search parameter when it is one of the allowed values, otherwise
 * the fallback. Keeps a hand-edited or outdated link from selecting an unknown option.
 */
function readParam<T extends string>(
  params: URLSearchParams,
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = params.get(name)
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** Short measure code without the source prefix, e.g. `BM7` for `bln_BM7`. */
function getMeasureCode(m_id: string): string {
  return m_id.replace(/^bln_/, "")
}

/** Returns whether a status is missing because its NMI request failed. */
function isStatusUnavailable(status: FieldMeasureStatus, availability: CatalogueStatus): boolean {
  if (status === "recommended") return !availability.recommendationsAvailable
  if (status === "applicable") return !availability.applicabilityAvailable
  return false
}

type CatalogueRow = MeasureCatalogue & {
  code: string
  ecosysteemdiensten: Ecosysteemdienst[]
}

type Filters = {
  query: string
  sortMode: SortMode
  status: StatusFilter
  effectType: string
  costLevel: string
  theme: Ecosysteemdienst | "all"
}

/**
 * Renders the measures catalogue of a farm: a searchable, filterable list of all measures,
 * with on how many fields each measure is applied, recommended or applicable.
 */
export default function MeasuresCatalogueIndex() {
  const { catalogue, status: statusPromise } = useLoaderData<typeof loader>()
  const { calendar } = useParams()
  // The search and filters start from the URL, so Back and shared links keep them
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get(PARAM.query) ?? "")
  const [sortMode, setSortMode] = useState<SortMode>(() =>
    readParam(
      searchParams,
      PARAM.sort,
      SORT_OPTIONS.map((option) => option.value),
      "name",
    ),
  )
  const [status, setStatus] = useState<StatusFilter>(() =>
    readParam(searchParams, PARAM.status, STATUS_FILTERS, "all"),
  )
  const effectTypes = useMemo(() => {
    const present = new Set(catalogue.map((item) => item.m_effect_type))
    return EFFECT_TYPE_ORDER.filter((value) => present.has(value))
  }, [catalogue])
  const [effectType, setEffectType] = useState<string>(() =>
    readParam(searchParams, PARAM.effectType, ["all", ...EFFECT_TYPE_ORDER], "all"),
  )
  const [costLevel, setCostLevel] = useState<string>(() =>
    readParam(
      searchParams,
      PARAM.costLevel,
      ["all", ...MEASURE_COST_LEVELS.map((level) => String(level.value))],
      "all",
    ),
  )
  const [theme, setTheme] = useState<Ecosysteemdienst | "all">(() =>
    readParam<Ecosysteemdienst | "all">(
      searchParams,
      PARAM.theme,
      ["all", ...ECOSYSTEEMDIENSTEN],
      "all",
    ),
  )
  const moreFilterCount = [effectType, costLevel, theme].filter((value) => value !== "all").length
  const [showMoreFilters, setShowMoreFilters] = useState(moreFilterCount > 0)
  const searchRef = useRef<HTMLInputElement>(null)

  // Write the search and filters back to the URL without a navigation: a navigation would run
  // the loaders of this page and the farm again on every keystroke.
  useEffect(() => {
    const url = new URL(window.location.href)
    const values: Record<string, string> = {
      [PARAM.query]: query.trim(),
      [PARAM.sort]: sortMode === "name" ? "" : sortMode,
      [PARAM.status]: status === "all" ? "" : status,
      [PARAM.effectType]: effectType === "all" ? "" : effectType,
      [PARAM.costLevel]: costLevel === "all" ? "" : costLevel,
      [PARAM.theme]: theme === "all" ? "" : theme,
    }
    for (const [name, value] of Object.entries(values)) {
      if (value) url.searchParams.set(name, value)
      else url.searchParams.delete(name)
    }
    if (url.href !== window.location.href) {
      window.history.replaceState(window.history.state, "", url)
    }
  }, [query, sortMode, status, effectType, costLevel, theme])

  // "/" jumps to the search, as on many catalogue and documentation sites
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return
      }
      event.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const rows = useMemo((): CatalogueRow[] => {
    return catalogue.map((item) => ({
      ...item,
      code: getMeasureCode(item.m_id),
      ecosysteemdiensten: [
        ...new Set(
          getImpactedIndicators(item.m_impacts_score)
            .map((indicator) => indicator.ecosysteemdienst)
            .filter((value): value is Ecosysteemdienst => value !== null),
        ),
      ],
    }))
  }, [catalogue])

  const filters: Filters = { query, sortMode, status, effectType, costLevel, theme }
  const resetFilters = () => {
    setQuery("")
    setStatus("all")
    setEffectType("all")
    setCostLevel("all")
    setTheme("all")
  }

  return (
    <>
      <FarmTitle
        title="Maatregelencatalogus"
        help="maatregelencatalogus"
        description={`Alle bodemmaatregelen, met wat ze inhouden, wat ze kosten en op welke percelen ze in ${calendar} zijn toegepast, aanbevolen of toepasbaar.`}
        rightNode={<Bln3HelpDialog />}
      />
      <FarmContent>
        <div className="@container/catalogue space-y-4 pb-10">
          <div className="flex flex-col gap-3 @2xl/catalogue:flex-row @2xl/catalogue:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                ref={searchRef}
                aria-label="Zoek maatregelen"
                aria-keyshortcuts="/"
                placeholder="Zoek op naam, code of beschrijving…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pr-11 pl-9 pointer-coarse:h-11"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Zoekopdracht wissen"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none pointer-coarse:h-10 pointer-coarse:w-10"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <kbd
                  className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border px-1.5 font-sans text-xs pointer-fine:@2xl/catalogue:block"
                  aria-hidden="true"
                >
                  /
                </kbd>
              )}
            </div>
            {/* Not inside the status Suspense: a remount when the status arrives would close an
                open dropdown. "Meest aanbevolen" keeps the alphabetical order until then. */}
            <FilterSelect
              id="measures-catalogue-sort"
              label="Sorteer"
              value={sortMode}
              onChange={(v) => setSortMode(v as SortMode)}
              options={SORT_OPTIONS}
            />
          </div>

          <div className="flex flex-col gap-3 @md/catalogue:flex-row @md/catalogue:flex-wrap @md/catalogue:items-center @md/catalogue:gap-x-6">
            <Suspense fallback={<StatusSelect value={status} onChange={setStatus} />}>
              <Await
                resolve={statusPromise}
                errorElement={<StatusSelect value={status} onChange={setStatus} />}
              >
                {(loaded) => (
                  <StatusSelect value={status} onChange={setStatus} rows={rows} loaded={loaded} />
                )}
              </Await>
            </Suspense>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 self-start pointer-coarse:h-11"
              aria-expanded={showMoreFilters}
              aria-controls="measures-catalogue-more-filters"
              onClick={() => setShowMoreFilters((open) => !open)}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <span>Meer filters</span>
              {moreFilterCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 px-1.5 tabular-nums">
                  {moreFilterCount}
                  <span className="sr-only"> actief</span>
                </Badge>
              )}
            </Button>
          </div>

          <div
            id="measures-catalogue-more-filters"
            className={cn(
              "flex-col gap-3 @md/catalogue:flex-row @md/catalogue:flex-wrap @md/catalogue:items-center @md/catalogue:gap-x-6",
              showMoreFilters ? "flex" : "hidden",
            )}
          >
            <FilterSelect
              id="measures-catalogue-effect"
              label="Effect"
              value={effectType}
              onChange={setEffectType}
              options={[
                { value: "all", label: "Alle effecten" },
                ...effectTypes.map((value) => ({
                  value,
                  label: getEffectTypeInfo(value)?.label ?? value,
                })),
              ]}
            />
            <FilterSelect
              id="measures-catalogue-costs"
              label="Kosten"
              value={costLevel}
              onChange={setCostLevel}
              options={[
                { value: "all", label: "Alle kosten" },
                ...MEASURE_COST_LEVELS.map((level) => ({
                  value: String(level.value),
                  label: level.label,
                })),
              ]}
            />
            <FilterSelect
              id="measures-catalogue-theme"
              label="Thema"
              value={theme}
              onChange={(v) => setTheme(v as Ecosysteemdienst | "all")}
              options={[
                { value: "all", label: "Alle thema's" },
                ...ECOSYSTEEMDIENSTEN.map((value) => ({ value, label: value })),
              ]}
            />
          </div>

          <Suspense
            fallback={
              <CatalogueResults
                rows={rows}
                filters={filters}
                onReset={resetFilters}
                loaded={null}
              />
            }
          >
            <Await
              resolve={statusPromise}
              errorElement={
                <CatalogueResults
                  rows={rows}
                  filters={filters}
                  onReset={resetFilters}
                  loaded="failed"
                />
              }
            >
              {(loaded) => (
                <CatalogueResults
                  rows={rows}
                  filters={filters}
                  onReset={resetFilters}
                  loaded={loaded}
                />
              )}
            </Await>
          </Suspense>
        </div>
      </FarmContent>
    </>
  )
}

/**
 * The result count, the notice about missing statuses and the list of measures. Renders the
 * list without status while the status is loading (`loaded` is `null`) or when it failed.
 */
function CatalogueResults({
  rows,
  filters,
  onReset,
  loaded,
}: {
  rows: CatalogueRow[]
  filters: Filters
  onReset: () => void
  loaded: CatalogueStatus | "failed" | null
}) {
  const { b_id_farm = "", calendar = "" } = useParams()
  const statusData = loaded && loaded !== "failed" ? loaded : null
  const countsByMeasure = statusData?.countsByMeasure
  const { query, sortMode, status, effectType, costLevel, theme } = filters
  // A status filter can only be applied once the status is there
  const statusFilterPending = status !== "all" && loaded === null

  const filtered = useMemo(() => {
    const countsOf = (m_id: string) => countsByMeasure?.[m_id] ?? NO_COUNTS
    const sorted = [...rows]
    if (sortMode === "code") {
      sorted.sort((a, b) => a.code.localeCompare(b.code, "nl", { numeric: true }))
    } else if (sortMode === "recommended" && countsByMeasure) {
      sorted.sort(
        (a, b) =>
          countsOf(b.m_id).recommended - countsOf(a.m_id).recommended ||
          countsOf(b.m_id).applicable - countsOf(a.m_id).applicable ||
          a.m_name.localeCompare(b.m_name, "nl"),
      )
    } else {
      sorted.sort((a, b) => a.m_name.localeCompare(b.m_name, "nl"))
    }
    const passesFilters = sorted.filter(
      (row) =>
        // Measures no longer in the catalogue only show when the farm still applies them
        (row.m_status !== "inactive" || countsOf(row.m_id).applied > 0) &&
        (status === "all" || !countsByMeasure || countsOf(row.m_id)[status] > 0) &&
        (effectType === "all" || row.m_effect_type === effectType) &&
        (costLevel === "all" || String(row.m_effect_costs) === costLevel) &&
        (theme === "all" || row.ecosysteemdiensten.includes(theme)),
    )
    if (!query.trim()) return passesFilters
    const targets = passesFilters.map((row, index) => ({
      index,
      name: row.m_name,
      code: row.code,
      summary: row.m_summary ?? "",
      description: row.m_description ?? "",
    }))
    const results = fuzzysort.go(query, targets, {
      keys: ["name", "code", "summary", "description"],
    })
    // Keep the chosen sort order instead of the fuzzy score order
    const matched = new Set(results.map((r) => r.obj.index))
    return passesFilters.filter((_, index) => matched.has(index))
  }, [rows, countsByMeasure, query, sortMode, status, effectType, costLevel, theme])

  const hasFilters =
    query.trim().length > 0 ||
    status !== "all" ||
    effectType !== "all" ||
    costLevel !== "all" ||
    theme !== "all"
  // The chosen status could not be loaded: an empty list would wrongly read as "none"
  const filteredStatusUnavailable =
    status !== "all" &&
    (loaded === "failed" || (statusData !== null && isStatusUnavailable(status, statusData)))
  const showEmpty = filtered.length === 0 || filteredStatusUnavailable

  return (
    <div className="space-y-4">
      {loaded === "failed" ? (
        <MeasureStatusUnavailable availability="failed" />
      ) : statusData ? (
        <MeasureStatusUnavailable availability={statusData} />
      ) : null}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <p className="text-muted-foreground" aria-live="polite" aria-atomic="true">
          {statusFilterPending ? (
            <span key="pending">Status per perceel laden…</span>
          ) : filteredStatusUnavailable ? (
            <span key="unavailable">Status niet beschikbaar</span>
          ) : (
            <span key="count">
              {filtered.length === 1
                ? "1 maatregel gevonden"
                : `${filtered.length} maatregelen gevonden`}
            </span>
          )}
        </p>
        {hasFilters && (
          <Button type="button" variant="link" size="sm" onClick={onReset} className="h-auto p-0">
            Filters wissen
          </Button>
        )}
      </div>

      {statusFilterPending ? (
        <ul className="divide-y overflow-hidden rounded-lg border" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <li key={index} className="space-y-2 px-4 py-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </li>
          ))}
        </ul>
      ) : showEmpty ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>
              {rows.length === 0
                ? "Catalogus nog niet beschikbaar"
                : filteredStatusUnavailable
                  ? "Status niet beschikbaar"
                  : "Geen maatregelen gevonden"}
            </EmptyTitle>
            <EmptyDescription>
              {rows.length === 0
                ? "De maatregelencatalogus is nog niet geladen. Probeer het later opnieuw."
                : filteredStatusUnavailable
                  ? `${STATUS_ADJECTIVES[status as FieldMeasureStatus]} maatregelen konden niet worden geladen, daarom staat hier niets. Probeer het opnieuw of kies een andere status.`
                  : "Geen maatregel past bij deze zoekopdracht en filters. Pas ze aan of wis de filters."}
            </EmptyDescription>
          </EmptyHeader>
          {hasFilters && (
            <EmptyContent>
              <Button type="button" variant="outline" onClick={onReset}>
                Filters wissen
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {filtered.map((row) => (
            <CatalogueListRow
              key={row.m_id}
              row={row}
              href={getMeasureCataloguePath(b_id_farm, calendar, row.m_id)}
              counts={countsByMeasure ? (countsByMeasure[row.m_id] ?? NO_COUNTS) : null}
              statusPending={loaded === null}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * One measure in the catalogue list: name, summary, costs, themes and status per field. The
 * link is named by the measure name only; the rest is its description, so a screen reader
 * announces a short name first.
 */
function CatalogueListRow({
  row,
  href,
  counts,
  statusPending,
}: {
  row: CatalogueRow
  href: string
  counts: StatusCounts | null
  statusPending: boolean
}) {
  const isInactive = row.m_status === "inactive"
  const idBase = `catalogue-${row.m_id.replace(/[^A-Za-z0-9_-]/g, "-")}`
  const statusKeys = (["applied", "recommended", "applicable"] as const).filter(
    (key) => (counts?.[key] ?? 0) > 0,
  )
  return (
    <li>
      <Link
        to={href}
        aria-labelledby={`${idBase}-name`}
        aria-describedby={`${idBase}-details ${idBase}-status`}
        className="hover:bg-muted/50 focus-visible:ring-ring grid grid-cols-1 gap-x-6 gap-y-2 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset @2xl/catalogue:grid-cols-[minmax(0,1fr)_13rem_1rem] @2xl/catalogue:items-center"
      >
        <div className="min-w-0">
          <p
            id={`${idBase}-name`}
            className={cn(
              "text-sm font-medium wrap-break-word",
              isInactive && "text-muted-foreground",
            )}
          >
            <span className="text-muted-foreground mr-2 font-normal tabular-nums">{row.code}</span>
            <span>{row.m_name}</span>
          </p>
          <div id={`${idBase}-details`}>
            {(row.m_summary ?? row.m_description) && (
              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
                {row.m_summary ?? row.m_description}
              </p>
            )}
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <MeasureCostIndicator costs={row.m_effect_costs} />
              {row.ecosysteemdiensten.length > 0 && (
                <span>{row.ecosysteemdiensten.join(" · ")}</span>
              )}
              {row.m_stage_applicability === "farm" && (
                <Badge variant="outline" className="text-muted-foreground text-xs font-normal">
                  Bedrijfsniveau
                </Badge>
              )}
              {isInactive && (
                <Badge variant="secondary" className="text-xs">
                  Niet meer beschikbaar
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div
          id={`${idBase}-status`}
          className="flex flex-wrap gap-x-4 gap-y-1 text-xs @2xl/catalogue:flex-col @2xl/catalogue:flex-nowrap"
        >
          {statusPending ? (
            <Skeleton className="h-3.5 w-32" aria-hidden="true" />
          ) : (
            statusKeys.map((key) => (
              <MeasureStatusLabel key={key} status={key} count={counts?.[key]} />
            ))
          )}
        </div>
        <ChevronRight
          className="text-muted-foreground hidden h-4 w-4 shrink-0 @2xl/catalogue:block"
          aria-hidden="true"
        />
      </Link>
    </li>
  )
}

/**
 * The status filter. Each option shows how many measures have that status on one or more
 * fields, or that it could not be loaded. Disabled while the status is loading.
 */
function StatusSelect({
  value,
  onChange,
  rows,
  loaded,
}: {
  value: StatusFilter
  onChange: (value: StatusFilter) => void
  rows?: CatalogueRow[]
  loaded?: CatalogueStatus
}) {
  const options = STATUS_FILTERS.map((key) => {
    if (key === "all" || !loaded || !rows) return { value: key, label: STATUS_LABELS[key] }
    if (isStatusUnavailable(key, loaded)) {
      return { value: key, label: `${STATUS_LABELS[key]} (niet beschikbaar)` }
    }
    const count = rows.filter((row) => (loaded.countsByMeasure[row.m_id]?.[key] ?? 0) > 0).length
    return { value: key, label: `${STATUS_LABELS[key]} (${count})` }
  })
  return (
    <FilterSelect
      id="measures-catalogue-status"
      label="Status"
      value={value}
      onChange={(v) => onChange(v as StatusFilter)}
      options={options}
      disabled={!loaded}
      triggerClassName="@md/catalogue:w-56"
    />
  )
}

/**
 * A labelled select for one filter of the catalogue.
 */
function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
  triggerClassName,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  triggerClassName?: string
}) {
  return (
    <div className="flex w-full items-center gap-2 @md/catalogue:w-auto">
      <Label
        htmlFor={id}
        className="text-muted-foreground w-14 shrink-0 text-sm @md/catalogue:w-auto"
      >
        {label}
      </Label>
      <Select
        value={value}
        items={options}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== null) onChange(next)
        }}
      >
        <SelectTrigger
          id={id}
          className={cn(
            "min-w-0 flex-1 @md/catalogue:w-44 @md/catalogue:flex-none pointer-coarse:data-[size=default]:h-11",
            triggerClassName,
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
