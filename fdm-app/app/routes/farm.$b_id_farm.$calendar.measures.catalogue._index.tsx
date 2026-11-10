import type { MeasureCatalogue } from "@nmi-agro/fdm-core"
import { getMeasuresFromCatalogue } from "@nmi-agro/fdm-core"
import fuzzysort from "fuzzysort"
import { ChevronRight, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
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
import { Bln3HelpDialog } from "~/components/blocks/indicators/bln3-help-dialog"
import { MeasureCostIndicator } from "~/components/blocks/measures/measure-cost-indicator"
import { MeasureStatusLabel } from "~/components/blocks/measures/measure-status"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { type FieldMeasureStatus, getFarmMeasureStatus } from "~/lib/farm-measures.server"
import { fdm } from "~/lib/fdm.server"
import { ECOSYSTEEMDIENSTEN, type Ecosysteemdienst } from "~/lib/indicators"
import { getEffectTypeInfo, getImpactedIndicators, MEASURE_COST_LEVELS } from "~/lib/measure-labels"
import { getMeasureCataloguePath } from "~/lib/measures-catalogue"
import { cn } from "~/lib/utils"

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

/**
 * Loads the measures catalogue and, per measure, on how many fields of the farm it is
 * applied, recommended or applicable in the selected year.
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
    const status = await getFarmMeasureStatus({
      principal_id: session.principal_id,
      b_id_farm,
      calendar,
      timeframe,
      catalogue,
    })

    const countsByMeasure: Record<string, StatusCounts> = {}
    for (const [m_id, fields] of status.fieldsByMeasure) {
      const counts: StatusCounts = { applied: 0, recommended: 0, applicable: 0 }
      for (const field of fields) counts[field.status] += 1
      countsByMeasure[m_id] = counts
    }

    return {
      catalogue,
      countsByMeasure,
      recommendationsAvailable: status.recommendationsAvailable,
      applicabilityAvailable: status.applicabilityAvailable,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

type SortMode = "name" | "code"
type StatusFilter = "all" | FieldMeasureStatus

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "name", label: "Alfabetisch" },
  { value: "code", label: "Op code" },
]

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Alle maatregelen" },
  { value: "applied", label: "Toegepast" },
  { value: "recommended", label: "Aanbevolen" },
  { value: "applicable", label: "Toepasbaar" },
]

const EFFECT_TYPE_FILTERS = ["qual", "classed"] as const

const NO_COUNTS: StatusCounts = { applied: 0, recommended: 0, applicable: 0 }

/** Short measure code without the source prefix, e.g. `BM7` for `bln_BM7`. */
function getMeasureCode(m_id: string): string {
  return m_id.replace(/^bln_/, "")
}

type CatalogueRow = MeasureCatalogue & {
  code: string
  indicatorCount: number
  ecosysteemdiensten: Set<Ecosysteemdienst>
  counts: StatusCounts
}

/**
 * Renders the measures catalogue of a farm: a searchable, filterable list of all measures,
 * with on how many fields each measure is applied, recommended or applicable.
 */
export default function MeasuresCatalogueIndex() {
  const { catalogue, countsByMeasure, recommendationsAvailable, applicabilityAvailable } =
    useLoaderData<typeof loader>()
  const { b_id_farm, calendar } = useParams()
  const [query, setQuery] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("name")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [effectType, setEffectType] = useState<string>("all")
  const [costLevel, setCostLevel] = useState<string>("all")
  const [theme, setTheme] = useState<Ecosysteemdienst | "all">("all")

  const rows = useMemo((): CatalogueRow[] => {
    return catalogue.map((item) => {
      const indicators = getImpactedIndicators(item.m_impacts_score)
      return {
        ...item,
        code: getMeasureCode(item.m_id),
        indicatorCount: indicators.length,
        ecosysteemdiensten: new Set(
          indicators
            .map((indicator) => indicator.ecosysteemdienst)
            .filter((value): value is Ecosysteemdienst => value !== null),
        ),
        counts: countsByMeasure[item.m_id] ?? NO_COUNTS,
      }
    })
  }, [catalogue, countsByMeasure])

  const sorted = useMemo(() => {
    const items = [...rows]
    if (sortMode === "code") {
      return items.sort((a, b) => a.code.localeCompare(b.code, "nl", { numeric: true }))
    }
    return items.sort((a, b) => a.m_name.localeCompare(b.m_name, "nl"))
  }, [rows, sortMode])

  const filtered = useMemo((): CatalogueRow[] => {
    const passesFilters = sorted.filter(
      (row) =>
        // Measures no longer in the catalogue only show when the farm still applies them
        (row.m_status !== "inactive" || row.counts.applied > 0) &&
        (status === "all" || row.counts[status] > 0) &&
        (effectType === "all" || row.m_effect_type === effectType) &&
        (costLevel === "all" || String(row.m_effect_costs) === costLevel) &&
        (theme === "all" || row.ecosysteemdiensten.has(theme)),
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
  }, [query, sorted, status, effectType, costLevel, theme])

  const hasFilters =
    query.trim().length > 0 ||
    status !== "all" ||
    effectType !== "all" ||
    costLevel !== "all" ||
    theme !== "all"

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
        description={`Alle bodemmaatregelen, met wat ze inhouden, wat ze kosten en op welke percelen ze in ${calendar} zijn toegepast, aanbevolen of toepasbaar.`}
        rightNode={<Bln3HelpDialog />}
      />
      <FarmContent>
        <div className="space-y-4 pb-10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                aria-label="Zoek maatregelen"
                placeholder="Zoek op naam, code of beschrijving…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Zoekopdracht wissen"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <FilterSelect
              id="measures-catalogue-sort"
              label="Sorteer"
              value={sortMode}
              onChange={(v) => setSortMode(v as SortMode)}
              options={SORT_OPTIONS}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FilterSelect
              id="measures-catalogue-status"
              label="Status"
              value={status}
              onChange={(v) => setStatus(v as StatusFilter)}
              options={STATUS_FILTERS}
            />
            <FilterSelect
              id="measures-catalogue-effect"
              label="Effect"
              value={effectType}
              onChange={setEffectType}
              options={[
                { value: "all", label: "Alle effecten" },
                ...EFFECT_TYPE_FILTERS.map((value) => ({
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

          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <p className="text-muted-foreground" aria-live="polite">
              {filtered.length === 1
                ? "1 maatregel gevonden"
                : `${filtered.length} maatregelen gevonden`}
              {hasFilters && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={resetFilters}
                  className="ml-2 h-auto p-0"
                >
                  Filters wissen
                </Button>
              )}
            </p>
            {(!recommendationsAvailable || !applicabilityAvailable) && (
              <p className="text-muted-foreground">
                {!recommendationsAvailable && !applicabilityAvailable
                  ? "Aanbevolen en toepasbare maatregelen konden niet worden geladen."
                  : !recommendationsAvailable
                    ? "Aanbevolen maatregelen konden niet worden geladen."
                    : "Toepasbare maatregelen konden niet worden geladen."}
              </p>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border py-12 text-center text-sm">
              {catalogue.length === 0
                ? "De maatregelencatalogus is nog niet beschikbaar."
                : "Geen maatregelen gevonden met deze zoekopdracht en filters."}
            </div>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border">
              {filtered.map((row) => {
                const isInactive = row.m_status === "inactive"
                const effectInfo = getEffectTypeInfo(row.m_effect_type)
                return (
                  <li key={row.m_id}>
                    <Link
                      to={getMeasureCataloguePath(b_id_farm ?? "", calendar ?? "", row.m_id)}
                      className={cn(
                        "hover:bg-muted/50 focus-visible:bg-muted/50 grid gap-x-6 gap-y-2 px-4 py-3 transition-colors focus-visible:outline-none md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center",
                        isInactive && "opacity-60",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          <span className="text-muted-foreground mr-2">{row.code}</span>
                          {row.m_name}
                        </p>
                        {(row.m_summary ?? row.m_description) && (
                          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
                            {row.m_summary ?? row.m_description}
                          </p>
                        )}
                        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <MeasureCostIndicator costs={row.m_effect_costs} />
                          {row.indicatorCount > 0 && (
                            <span>
                              {row.indicatorCount === 1
                                ? "1 indicator"
                                : `${row.indicatorCount} indicatoren`}
                            </span>
                          )}
                          {effectInfo && (
                            <Badge
                              variant="outline"
                              className="text-xs"
                              title={effectInfo.description || undefined}
                            >
                              {effectInfo.label}
                            </Badge>
                          )}
                          {row.m_stage_applicability === "farm" && (
                            <Badge variant="outline" className="text-xs">
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
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:justify-end">
                        {(["applied", "recommended", "applicable"] as const).map((key) =>
                          row.counts[key] > 0 ? (
                            <MeasureStatusLabel key={key} status={key} count={row.counts[key]} />
                          ) : null,
                        )}
                      </div>
                      <ChevronRight
                        className="text-muted-foreground hidden h-4 w-4 shrink-0 md:block"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </FarmContent>
    </>
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
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-muted-foreground text-sm">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-44">
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
