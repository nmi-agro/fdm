import type {
  DynaV2DailyPoint,
  DynaV2Result,
  FieldExclusionReason,
  MineralizationCultivation,
  MineralizationEvent,
  MineralizationInsights,
  MineralizationSignal,
  MineralizationUsedInput,
  SeasonPhase,
  WeatherForecast,
} from "@nmi-agro/fdm-calculator"
/**
 * Shared types and formatting helpers for the Mineralisatie pages.
 *
 * Safe to import from both server and client code: it only contains types and pure functions.
 */
import type { ShouldRevalidateFunctionArgs } from "react-router"

/** Main cultivation summary that is sent to the browser. */
export type MineralizationMainCultivation = Pick<
  MineralizationCultivation,
  "b_lu" | "b_lu_catalogue" | "b_lu_name" | "b_lu_harvestable"
> & { b_lu_croprotation: string | null }

interface OutcomeBase {
  b_id: string
  b_name: string | null
  b_area: number | null
}

/** Result of the mineralization calculation of one field. */
export type FieldMineralizationOutcome =
  | (OutcomeBase & { status: "excluded"; reason: FieldExclusionReason })
  | (OutcomeBase & { status: "missing_location" | "no_cultivation" })
  | (OutcomeBase & {
      status: "missing_harvest"
      mainCultivation: MineralizationMainCultivation
      defaultHarvestDate: string | null
    })
  | (OutcomeBase & { status: "error"; message: string })
  | (OutcomeBase & {
      status: "ok"
      mainCultivation: MineralizationMainCultivation
      result: DynaV2Result
      insights: MineralizationInsights
      events: MineralizationEvent[]
      usedInput: MineralizationUsedInput
      forecast: WeatherForecast | null
      /** Start of the main cultivation as sent to Dyna (`YYYY-MM-DD`). */
      mainStart: string
      /** (Last) harvest of the main cultivation (`YYYY-MM-DD`). */
      mainHarvest: string
      /** Whether cultivations after the main crop had to be left out of the calculation. */
      partial: boolean
      /** Fertilizers of the farm that can be used in a scenario. */
      fertilizerOptions: ScenarioFertilizerOption[]
    })

/** Fertilizer that can be chosen in a scenario. */
export interface ScenarioFertilizerOption {
  p_id: string
  p_name_nl: string | null
  /** Unit in which the amount is entered, e.g. `kg/ha` or `m3/ha`. */
  p_app_amount_unit: string
  /** Allowed application methods; empty when not restricted. */
  p_app_method_options: string[]
  /** Fertilizer type (e.g. `mineral`, `manure`, `compost`), for the icon on the event lane. */
  p_type: string | null
}

/** Outcome of a field that could be calculated. */
export type FieldMineralizationOk = Extract<FieldMineralizationOutcome, { status: "ok" }>

/**
 * Maximum number of harvests per cultivation that Dyna accepts. Mirrors
 * `DYNA_V2_MAX_HARVESTS_PER_CULTIVATION` of fdm-calculator, which client code cannot import.
 */
export const DYNA_V2_MAX_HARVESTS = 6

/** Dutch labels of the season phases. */
export const PHASE_LABELS: Record<SeasonPhase, string> = {
  planning: "Planning",
  growing: "Groeiseizoen",
  evaluation: "Evaluatie",
}

/** Dutch explanation why a field is not calculated, e.g. "Geen teelt in 2026". */
export function getNotCalculatedReason(
  outcome: Extract<
    FieldMineralizationOutcome,
    { status: "excluded" | "missing_location" | "no_cultivation" }
  >,
  year: number,
): string {
  if (outcome.status !== "excluded") {
    return outcome.status === "missing_location" ? "Geen perceelslocatie" : `Geen teelt in ${year}`
  }
  const reasons: Record<FieldExclusionReason, string> = {
    bufferstrip: "Bufferstrook",
    nature: "Natuur",
    landscape_element: "Landschapselement",
  }
  return reasons[outcome.reason]
}

const kgFormatter = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 })

/** Formats a nitrogen amount, e.g. "1.234 kg N/ha". */
export function formatKgN(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–"
  return `${kgFormatter.format(value)} kg N/ha`
}

/** Formats a nitrogen amount without unit, for tables that show the unit in the header. */
export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–"
  return kgFormatter.format(value)
}

/**
 * Where today lies relative to the selected year and the harvest of the main crop.
 *
 * - `past` / `future`: the selected year is before or after the current year.
 * - `before_harvest` / `after_harvest`: the selected year is the current year.
 */
export type SeasonTiming = "past" | "future" | "before_harvest" | "after_harvest"

/** Determines the {@link SeasonTiming} of a field. */
export function getSeasonTiming(year: number, today: string, mainHarvest: string): SeasonTiming {
  const currentYear = Number(today.slice(0, 4))
  if (year < currentYear) return "past"
  if (year > currentYear) return "future"
  return today > mainHarvest ? "after_harvest" : "before_harvest"
}

/**
 * Link to the bulk harvest form of the crop rotation, with the given fields selected.
 *
 * @param args.returnUrl - Page to return to after saving.
 */
export function getBulkHarvestHref(args: {
  b_id_farm: string
  calendar: string
  b_lu_catalogue: string
  fieldIds: string[]
  returnUrl: string
}): string {
  const search = new URLSearchParams({
    cultivationIds: args.b_lu_catalogue,
    fieldIds: args.fieldIds.join(","),
    returnUrl: args.returnUrl,
  })
  return `/farm/${args.b_id_farm}/${args.calendar}/rotation/harvest?${search.toString()}`
}

/** Formats a number with Dutch separators and the given number of decimals. */
export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits }).format(value)
}

/** Formats a calendar date (`YYYY-MM-DD`) as e.g. "5 mrt". */
export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}

/** Formats a calendar date (`YYYY-MM-DD`) as e.g. "5 maart 2026". */
export function formatLongDate(date: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}

/** Adds days to a calendar date (`YYYY-MM-DD`). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Returns the simulation days within a calendar year. */
export function seriesInYear(series: DynaV2DailyPoint[], year: number): DynaV2DailyPoint[] {
  const prefix = `${year}-`
  return series.filter((p) => p.b_date_calculation.startsWith(prefix))
}

/** Signal or problem shown on the farm overview, ordered by priority. */
export type AttentionItem =
  | { kind: "missing_harvest" }
  | { kind: "error"; message: string }
  | { kind: "harvest_limit"; count: number }
  | { kind: "signal"; signal: MineralizationSignal }

const SIGNAL_PRIORITY: Record<MineralizationSignal["type"], number> = {
  n_shortage: 2,
  rain_near_event: 3,
  high_leaching: 4,
  residual_n: 5,
}

/** Priority of an attention item; lower is more urgent. */
export function getAttentionPriority(item: AttentionItem): number {
  if (item.kind === "missing_harvest") return 0
  if (item.kind === "error") return 1
  if (item.kind === "harvest_limit") return 1.5
  return SIGNAL_PRIORITY[item.signal.type]
}

/** Returns the items that need attention for a field, most urgent first. */
export function getAttentionItems(outcome: FieldMineralizationOutcome): AttentionItem[] {
  if (outcome.status === "missing_harvest") return [{ kind: "missing_harvest" }]
  if (outcome.status === "error") return [{ kind: "error", message: outcome.message }]
  if (outcome.status !== "ok") return []
  const omitted = outcome.usedInput.omittedHarvests.length
  return [
    ...(omitted > 0 ? [{ kind: "harvest_limit" as const, count: omitted }] : []),
    ...outcome.insights.signals.map((signal): AttentionItem => ({ kind: "signal", signal })),
  ].sort((a, b) => getAttentionPriority(a) - getAttentionPriority(b))
}

/** Short Dutch description of an attention item. */
export function describeAttentionItem(item: AttentionItem): string {
  if (item.kind === "missing_harvest") return "Oogst ontbreekt"
  if (item.kind === "error") return "Berekening mislukt"
  if (item.kind === "harvest_limit") {
    return item.count === 1 ? "1 snede niet meegerekend" : `${item.count} sneden niet meegerekend`
  }
  const { signal } = item
  switch (signal.type) {
    case "n_shortage":
      return `N-tekort verwacht rond ${formatShortDate(signal.date)}`
    case "rain_near_event":
      return `${formatNumber(signal.rainMm, 1)} mm regen rond ${
        signal.eventType === "harvest" ? "geplande oogst" : "geplande gift"
      } (${formatShortDate(signal.eventDate)})`
    case "high_leaching":
      return `Uitspoeling ${formatKgN(signal.leachingKgHa)}`
    case "residual_n":
      return `${formatKgN(signal.availableN)} over bij oogst`
  }
}

/**
 * Skips reloading the mineralization loaders when only the `phase` search parameter changes; the
 * phase is a view setting and does not change any calculation.
 */
export function shouldRevalidateMineralization({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  if (formMethod || currentUrl.pathname !== nextUrl.pathname) return defaultShouldRevalidate
  // Same URL means an explicit revalidation, e.g. a retry button
  if (currentUrl.search === nextUrl.search) return defaultShouldRevalidate
  const current = new URLSearchParams(currentUrl.search)
  const next = new URLSearchParams(nextUrl.search)
  current.delete("phase")
  next.delete("phase")
  if (current.toString() === next.toString()) return false
  return defaultShouldRevalidate
}
