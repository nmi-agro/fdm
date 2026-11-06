import type { MeasureCatalogue } from "@nmi-agro/fdm-core"
import { getMeasuresFromCatalogue } from "@nmi-agro/fdm-core"
import fuzzysort from "fuzzysort"
import { ChevronRight, Search, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  Link,
  useLoaderData,
  useSearchParams,
} from "react-router"
import { Header } from "~/components/blocks/header/base"
import { HeaderMeasuresCatalogue } from "~/components/blocks/header/measures-catalogue"
import { MeasureCostIndicator } from "~/components/blocks/measures/measure-cost-indicator"
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
import { getCalendarSelection } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { ECOSYSTEEMDIENSTEN, type Ecosysteemdienst } from "~/lib/indicators"
import { getEffectTypeInfo, getImpactedIndicators, MEASURE_COST_LEVELS } from "~/lib/measure-labels"
import {
  CATALOGUE_CALENDAR_PARAM,
  CATALOGUE_FARM_PARAM,
  CATALOGUE_NO_FARM,
  getMeasureCataloguePath,
} from "~/lib/measures-catalogue"
import { getCatalogueFarmData } from "~/lib/measures-catalogue.server"
import { cn } from "~/lib/utils"
import { useCalendarStore } from "~/store/calendar"
import { useFarmStore } from "~/store/farm"

/**
 * Sets the page title and description of the measures catalogue.
 */
export const meta: MetaFunction = () => {
  return [
    { title: `Maatregelencatalogus | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Bekijk alle beschikbare bodemmaatregelen: wat ze inhouden, wat ze kosten, op welke indicatoren ze effect hebben en wanneer ze van toepassing zijn.",
    },
  ]
}

/**
 * Loads the full measures catalogue and, when a farm is selected, on how many fields of that
 * farm each measure is applied in the selected year.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const session = await getSession(request)
    const [catalogue, farmData] = await Promise.all([
      getMeasuresFromCatalogue(fdm),
      getCatalogueFarmData(session.principal_id, new URL(request.url)),
    ])
    const appliedCount: Record<string, number> = {}
    for (const [m_id, fields] of farmData.appliedFields) {
      appliedCount[m_id] = new Set(fields.map((field) => field.b_id)).size
    }
    return {
      catalogue,
      farms: farmData.farms,
      farm: farmData.farm,
      calendar: farmData.calendar,
      appliedCount,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

type SortMode = "name" | "code"

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "name", label: "Alfabetisch" },
  { value: "code", label: "Op code" },
]

const EFFECT_TYPE_FILTERS = ["qual", "classed"] as const

/** Short measure code without the source prefix, e.g. `BM7` for `bln_BM7`. */
function getMeasureCode(m_id: string): string {
  return m_id.replace(/^bln_/, "")
}

const SOURCE_LABELS: Record<string, string> = { bln: "BLN3" }

type CatalogueRow = MeasureCatalogue & {
  code: string
  indicatorCount: number
  ecosysteemdiensten: Set<Ecosysteemdienst>
  appliedFieldCount: number
}

/**
 * Renders the measures catalogue: a searchable, filterable and sortable list of all
 * measures, each linking to its detail page. With a farm selected, measures applied on that
 * farm are marked and can be filtered.
 */
export default function MeasuresCatalogueIndex() {
  const { catalogue, farms, farm, calendar, appliedCount } = useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSearchParams()
  const lastFarmId = useFarmStore((state) => state.farmId)
  const lastCalendar = useCalendarStore((state) => state.calendar)
  const [query, setQuery] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("name")
  const [effectType, setEffectType] = useState<string>("all")
  const [costLevel, setCostLevel] = useState<string>("all")
  const [theme, setTheme] = useState<Ecosysteemdienst | "all">("all")
  const [status, setStatus] = useState<"all" | "applied">("all")

  // Without an explicit choice, start with the farm and year the user last worked on
  const hasFarmParam = searchParams.has(CATALOGUE_FARM_PARAM)
  useEffect(() => {
    if (hasFarmParam || !lastFarmId) return
    if (!farms.some((item) => item.b_id_farm === lastFarmId)) return
    setSearchParams(
      { [CATALOGUE_FARM_PARAM]: lastFarmId, [CATALOGUE_CALENDAR_PARAM]: lastCalendar },
      { replace: true },
    )
  }, [hasFarmParam, lastFarmId, lastCalendar, farms, setSearchParams])

  const farmContext = farm ? { b_id_farm: farm.b_id_farm, calendar } : undefined

  const selectFarm = (value: string) => {
    setStatus("all")
    setSearchParams(
      value === CATALOGUE_NO_FARM
        ? { [CATALOGUE_FARM_PARAM]: CATALOGUE_NO_FARM }
        : { [CATALOGUE_FARM_PARAM]: value, [CATALOGUE_CALENDAR_PARAM]: calendar },
    )
  }

  const selectCalendar = (value: string) => {
    if (!farm) return
    setSearchParams({ [CATALOGUE_FARM_PARAM]: farm.b_id_farm, [CATALOGUE_CALENDAR_PARAM]: value })
  }

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
        appliedFieldCount: appliedCount[item.m_id] ?? 0,
      }
    })
  }, [catalogue, appliedCount])

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
        // Measures no longer in the catalogue only show when the farm still uses them
        (row.m_status !== "inactive" || row.appliedFieldCount > 0) &&
        (status === "all" || row.appliedFieldCount > 0) &&
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
      <Header action={undefined}>
        <HeaderMeasuresCatalogue />
      </Header>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Maatregelencatalogus</h1>
          <p className="text-muted-foreground text-sm">
            Alle bodemmaatregelen uit BLN3. Open een maatregel voor wat hij inhoudt, wat hij kost,
            op welke indicatoren hij effect heeft en wanneer hij van toepassing is.
          </p>
        </div>

        {farms.length > 0 && (
          <div className="bg-muted/30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="measures-catalogue-farm" className="text-muted-foreground text-sm">
                Bedrijf
              </Label>
              <Select value={farm?.b_id_farm ?? CATALOGUE_NO_FARM} onValueChange={selectFarm}>
                <SelectTrigger id="measures-catalogue-farm" className="h-8 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CATALOGUE_NO_FARM}>Geen bedrijf</SelectItem>
                  {farms.map((item) => (
                    <SelectItem key={item.b_id_farm} value={item.b_id_farm}>
                      {item.b_name_farm ?? item.b_id_farm}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {farm && (
              <>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="measures-catalogue-calendar"
                    className="text-muted-foreground text-sm"
                  >
                    Jaar
                  </Label>
                  <Select value={calendar} onValueChange={selectCalendar}>
                    <SelectTrigger id="measures-catalogue-calendar" className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getCalendarSelection().map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="measures-catalogue-status"
                    className="text-muted-foreground text-sm"
                  >
                    Status
                  </Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as "all" | "applied")}>
                    <SelectTrigger id="measures-catalogue-status" className="h-8 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle maatregelen</SelectItem>
                      <SelectItem value="applied">Toegepast op dit bedrijf</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
            <div className="flex items-center gap-2">
              <Label htmlFor="measures-catalogue-sort" className="text-muted-foreground text-sm">
                Sorteer
              </Label>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger id="measures-catalogue-sort" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="measures-catalogue-effect" className="text-muted-foreground text-sm">
                Effect
              </Label>
              <Select value={effectType} onValueChange={setEffectType}>
                <SelectTrigger id="measures-catalogue-effect" className="h-8 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle effecten</SelectItem>
                  {EFFECT_TYPE_FILTERS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {getEffectTypeInfo(value)?.label ?? value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="measures-catalogue-costs" className="text-muted-foreground text-sm">
                Kosten
              </Label>
              <Select value={costLevel} onValueChange={setCostLevel}>
                <SelectTrigger id="measures-catalogue-costs" className="h-8 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle kosten</SelectItem>
                  {MEASURE_COST_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={String(level.value)}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="measures-catalogue-theme" className="text-muted-foreground text-sm">
                Thema
              </Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as Ecosysteemdienst | "all")}>
                <SelectTrigger id="measures-catalogue-theme" className="h-8 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle thema&apos;s</SelectItem>
                  {ECOSYSTEEMDIENSTEN.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-muted-foreground text-sm" aria-live="polite">
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
                    to={getMeasureCataloguePath(row.m_id, farmContext)}
                    className={cn(
                      "hover:bg-muted/50 focus-visible:bg-muted/50 flex items-start gap-3 px-4 py-3 transition-colors focus-visible:outline-none",
                      isInactive && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {row.code}
                        </span>
                        <span className="truncate text-sm font-medium">{row.m_name}</span>
                      </div>
                      {(row.m_summary ?? row.m_description) && (
                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
                          {row.m_summary ?? row.m_description}
                        </p>
                      )}
                      <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                        {row.appliedFieldCount > 0 && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                              aria-hidden="true"
                            />
                            {row.appliedFieldCount === 1
                              ? "Toegepast op 1 perceel"
                              : `Toegepast op ${row.appliedFieldCount} percelen`}
                          </span>
                        )}
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
                        <Badge variant="outline" className="text-xs">
                          {SOURCE_LABELS[row.m_source] ?? row.m_source}
                        </Badge>
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
                    <ChevronRight
                      className="text-muted-foreground mt-1 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
