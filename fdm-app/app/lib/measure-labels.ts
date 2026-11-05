/**
 * Dutch labels for the fields of the measures catalogue: cost levels, effect types, the
 * indicators a measure affects and the variables in its applicability conditions.
 *
 * Unknown codes fall back to the code itself, so new values from the catalogue still show.
 */
import type { MeasureCatalogue } from "@nmi-agro/fdm-core"
import { type Ecosysteemdienst, getIndicatorInfo } from "~/lib/indicators"

type CatalogueMeasureCondition = NonNullable<MeasureCatalogue["m_applicability"]>[number]

// ── Costs ──────────────────────────────────────────────────────────────────

export type MeasureCostLevel = 0 | 1 | 2

/** Cost levels of the catalogue, in ascending order. */
export const MEASURE_COST_LEVELS: { value: MeasureCostLevel; label: string; long: string }[] = [
  { value: 0, label: "Laag", long: "Lage kosten" },
  { value: 1, label: "Gemiddeld", long: "Gemiddelde kosten" },
  { value: 2, label: "Hoog", long: "Hoge kosten" },
]

/**
 * Returns the cost level of a measure, or `null` when the costs are unknown or outside the
 * scale.
 *
 * @param costs - `m_effect_costs` of the measure.
 */
export function getMeasureCostLevel(
  costs: number | null | undefined,
): (typeof MEASURE_COST_LEVELS)[number] | null {
  if (costs === null || costs === undefined) return null
  return MEASURE_COST_LEVELS.find((level) => level.value === costs) ?? null
}

// ── Effect type ────────────────────────────────────────────────────────────

const EFFECT_TYPES: Record<string, { label: string; description: string }> = {
  qual: {
    label: "Kwalitatief",
    description: "Deze maatregel heeft een vast effect op de bodemindicatoren.",
  },
  classed: {
    label: "Geclassificeerd",
    description: "Het effect van deze maatregel hangt af van de omstandigheden op het perceel.",
  },
  quant: {
    label: "Kwantitatief",
    description: "Deze maatregel wijzigt invoerwaarden voor de berekening.",
  },
}

/**
 * Returns the Dutch label and explanation of an effect type, or `null` when it is unknown.
 *
 * @param effectType - `m_effect_type` of the measure.
 */
export function getEffectTypeInfo(
  effectType: string | null | undefined,
): { value: string; label: string; description: string } | null {
  if (!effectType) return null
  const info = EFFECT_TYPES[effectType]
  return info
    ? { value: effectType, ...info }
    : { value: effectType, label: effectType, description: "" }
}

// ── Impacted indicators ────────────────────────────────────────────────────

type CatalogueMeasureEffectSize = NonNullable<MeasureCatalogue["m_effect_size"]>[number]

export type ImpactedIndicator = {
  /** Indicator ID without the `S_` prefix, e.g. `NUT_N` */
  id: string
  name: string
  ecosysteemdienst: Ecosysteemdienst | null
  /**
   * Lowest and highest effect size listed for this indicator in the catalogue, over the base
   * effects and all conditional effects; `null` when the catalogue gives no effect size.
   */
  effectRange: { min: number; max: number } | null
}

/**
 * Collects, per score variable, the lowest and highest effect size listed in the effect
 * sizes of a measure. The values are taken as listed; they are not added up.
 *
 * @param effectSize - `m_effect_size` of the measure.
 */
export function getEffectRanges(
  effectSize: CatalogueMeasureEffectSize[] | null | undefined,
): Map<string, { min: number; max: number }> {
  const ranges = new Map<string, { min: number; max: number }>()
  for (const block of effectSize ?? []) {
    for (const impact of block.impacts ?? []) {
      if (typeof impact.value !== "number" || !Number.isFinite(impact.value)) continue
      const range = ranges.get(impact.key)
      if (range) {
        range.min = Math.min(range.min, impact.value)
        range.max = Math.max(range.max, impact.value)
      } else {
        ranges.set(impact.key, { min: impact.value, max: impact.value })
      }
    }
  }
  return ranges
}

/**
 * Formats an effect range for display, e.g. `0,9` or `0,05 – 1`.
 *
 * @param range - Range from {@link getEffectRanges}.
 */
export function formatEffectRange(range: { min: number; max: number } | null): string {
  if (!range) return "—"
  const format = (value: number) => value.toLocaleString("nl-NL", { maximumFractionDigits: 2 })
  return range.min === range.max ? format(range.min) : `${format(range.min)} – ${format(range.max)}`
}

/**
 * Translates the score variables a measure affects (`S_NUT_N`) to indicators with their
 * Dutch name, ecosystem service and range of effect sizes, sorted by ecosystem service and
 * name.
 *
 * @param impactsScore - `m_impacts_score` of the measure.
 * @param effectSize - `m_effect_size` of the measure, for the effect ranges.
 */
export function getImpactedIndicators(
  impactsScore: string[] | null | undefined,
  effectSize?: CatalogueMeasureEffectSize[] | null,
): ImpactedIndicator[] {
  const order: Record<string, number> = {
    Productie: 0,
    Klimaat: 1,
    Water: 2,
    Nutriëntenkringloop: 3,
  }
  const ranges = getEffectRanges(effectSize)
  return [...new Set(impactsScore ?? [])]
    .map((key) => {
      const id = key.replace(/^S_/, "")
      const info = getIndicatorInfo(id)
      return {
        id,
        name: info?.name ?? id,
        ecosysteemdienst: info?.ecosysteemdienst ?? null,
        effectRange: ranges.get(key) ?? null,
      }
    })
    .sort(
      (a, b) =>
        (order[a.ecosysteemdienst ?? ""] ?? 9) - (order[b.ecosysteemdienst ?? ""] ?? 9) ||
        a.name.localeCompare(b.name, "nl"),
    )
}

// ── Applicability conditions ───────────────────────────────────────────────

/** Variables that are shown elsewhere on the page and not as a condition. */
const HIDDEN_CONDITION_VARIABLES = new Set(["M_STAGE_APPLICABILITY"])

const CONDITION_VARIABLE_LABELS: Record<string, string> = {
  A_P_AL: "Fosfaattoestand (P-AL)",
  A_P_CC: "Plantbeschikbaar fosfaat (P-CaCl2)",
  B_AER_CBS: "Landbouwgebied (CBS)",
  B_LS_HYDROCAT: "Landschap",
  B_LU_BBWP: "Gewascategorie (BBWP)",
  B_LU_CROPROTATION: "Gewas",
  B_LU_CULTCAT4: "Gewascategorie",
  B_LU_N_RESIDUE: "Stikstof in gewasresten",
  B_SOILTYPE_SCCAT4: "Grondsoort",
  M_DRAIN: "Buisdrainage",
  M_FARM_SECTOR: "Bedrijfstype",
}

const CONDITION_VALUE_LABELS: Record<string, Record<string, string>> = {
  B_LS_HYDROCAT: {
    hoge_gronden: "Hoge gronden",
    flanken: "Flanken",
    beekdalen: "Beekdalen",
    lokale_laagtes: "Lokale laagtes",
    polders: "Polders",
  },
  B_LU_BBWP: {
    gras_permanent: "Blijvend grasland",
    gras_tijdelijk: "Tijdelijk grasland",
    rustgewas: "Rustgewas",
    rooivrucht: "Rooivrucht",
    groenten: "Groenten",
    bollensierteelt: "Bollen- en sierteelt",
    boomfruitteelt: "Boom- en fruitteelt",
    natuur: "Natuur",
    mais: "Maïs",
    randensloot: "Rand langs sloot",
    vanggewas: "Vanggewas",
    eiwitgewas: "Eiwitgewas",
  },
  B_LU_CROPROTATION: {
    grass: "Grasland",
    clover: "Klaver",
    alfalfa: "Luzerne",
    maize: "Maïs",
    mais: "Maïs",
    cereal: "Granen",
    potato: "Aardappel",
    sugarbeet: "Suikerbiet",
    rapeseed: "Koolzaad",
    starch: "Zetmeelaardappel",
    other: "Overig",
  },
  B_LU_CULTCAT4: {
    akkerbouw: "Akkerbouw",
    grasland: "Grasland",
    mais: "Maïs",
    natuur: "Natuur",
  },
  B_SOILTYPE_SCCAT4: {
    zand: "Zand",
    klei: "Klei",
    veen: "Veen",
    loess: "Löss",
  },
  M_FARM_SECTOR: {
    dairy: "Melkveehouderij",
    arable: "Akkerbouw",
    vegetables_outdoor: "Vollegrondsgroenten",
    bulbs: "Bollenteelt",
    tree_nursery: "Boomkwekerij",
  },
}

/**
 * Returns the Dutch label of a condition variable, or the code itself when it is unknown.
 *
 * @param variable - Variable code, e.g. `B_SOILTYPE_SCCAT4`.
 */
export function getConditionVariableLabel(variable: string): string {
  return CONDITION_VARIABLE_LABELS[variable] ?? variable
}

/**
 * Returns the Dutch label of a value of a condition variable.
 *
 * @param variable - Variable code, e.g. `B_SOILTYPE_SCCAT4`.
 * @param value - Value of the variable, e.g. `zand` or `true`.
 */
export function getConditionValueLabel(variable: string, value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "Ja" : "Nee"
  if (typeof value === "number") return value.toLocaleString("nl-NL")
  return CONDITION_VALUE_LABELS[variable]?.[value] ?? value.replace(/_/g, " ")
}

export type FormattedCondition = {
  variable: string
  label: string
  /** The condition in words, e.g. "Zand, Klei" or "ten minste 80" */
  value: string
}

/**
 * Translates applicability conditions to rows for a table. Conditions that are shown
 * elsewhere on the page (such as the stage of the measure) are left out.
 *
 * @param conditions - `m_applicability` of the measure.
 */
export function formatConditions(
  conditions: CatalogueMeasureCondition[] | null | undefined,
): FormattedCondition[] {
  return (conditions ?? [])
    .filter((condition) => !HIDDEN_CONDITION_VARIABLES.has(condition.variable))
    .map((condition) => ({
      variable: condition.variable,
      label: getConditionVariableLabel(condition.variable),
      value: formatConditionValue(condition),
    }))
}

function formatConditionValue(condition: CatalogueMeasureCondition): string {
  if (condition.values && condition.values.length > 0) {
    return condition.values
      .map((value) => getConditionValueLabel(condition.variable, value))
      .join(", ")
  }
  const min = condition.min?.toLocaleString("nl-NL")
  const max = condition.max?.toLocaleString("nl-NL")
  if (min !== undefined && max !== undefined) return `tussen ${min} en ${max}`
  if (min !== undefined) return `ten minste ${min}`
  if (max !== undefined) return `ten hoogste ${max}`
  return "—"
}

// ── External references ────────────────────────────────────────────────────

const EXTERNAL_ID_LABELS: Record<string, string> = {
  bbwp: "BBWP",
  boot26: "BOOT-lijst 2026",
  ecoregeling24: "Eco-regeling 2024",
}

export type MeasureReference = {
  key: string
  label: string
  /** ID in the related scheme, or the link text of the source */
  value: string
  href: string | null
}

/**
 * Builds the references of a measure: its IDs in related schemes as plain text, followed by
 * a "Bekijk bron" link to its source when the catalogue gives one. The catalogue has no
 * citation of the linked document, so no author or year is shown.
 *
 * @param externalIds - `m_external_ids` of the measure.
 * @param sourceUrl - `m_source_url` of the measure.
 */
export function getMeasureReferences(
  externalIds: Record<string, string> | null | undefined,
  sourceUrl: string | null | undefined,
): MeasureReference[] {
  const references: MeasureReference[] = Object.entries(externalIds ?? {}).map(([key, value]) => ({
    key,
    label: EXTERNAL_ID_LABELS[key] ?? key,
    value,
    href: null,
  }))
  if (sourceUrl) {
    references.push({ key: "source", label: "", value: "Bekijk bron", href: sourceUrl })
  }
  return references
}
