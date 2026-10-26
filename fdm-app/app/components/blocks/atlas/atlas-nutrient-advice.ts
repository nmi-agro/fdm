import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson"
import type {
  ExpressionSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
} from "maplibre-gl"
import type { FieldNutrientValue } from "~/components/blocks/nutrient-advice/overview-types"
import {
  type AdviceProgressStatus,
  computeAdviceProgress,
} from "~/components/blocks/nutrient-advice/progress-bar"

/* ================ MODES & COPY ================ */

/** Display modes of the Bemestingsadvies layer. */
export const NUTRIENT_ADVICE_MODES = ["remaining", "percentage", "advice"] as const
export type NutrientAdviceMode = (typeof NUTRIENT_ADVICE_MODES)[number]

export const DEFAULT_NUTRIENT_ADVICE_MODE: NutrientAdviceMode = "remaining"
export const DEFAULT_NUTRIENT_ADVICE_NUTRIENT = "N"

/**
 * Type guard for values read back from storage.
 *
 * @param value - Any value.
 * @returns `true` when `value` is a known {@link NutrientAdviceMode}.
 */
export function isNutrientAdviceMode(value: unknown): value is NutrientAdviceMode {
  return typeof value === "string" && (NUTRIENT_ADVICE_MODES as readonly string[]).includes(value)
}

/**
 * All Dutch UI copy of the layer in one place, so it can be moved to an i18n catalogue later
 * (fdm-app has no i18n library yet).
 */
export const NUTRIENT_ADVICE_COPY = {
  modes: {
    remaining: "Nog te geven",
    percentage: "% van advies",
    advice: "Advies",
  } satisfies Record<NutrientAdviceMode, string>,
  modeHints: {
    remaining: "Hoeveel er per hectare nog gegeven kan worden tot het advies.",
    percentage: "Hoeveel procent van het advies al gegeven is.",
    advice: "Hoe hoog het advies per hectare is.",
  } satisfies Record<NutrientAdviceMode, string>,
  nutrientGroups: {
    primary: "Primair",
    secondary: "Secundair",
    trace: "Sporenelementen",
  },
  advice: "Advies",
  applied: "Al gegeven",
  remaining: "Nog te geven",
  surplus: "Te veel gegeven",
  percentageOfAdvice: "Van advies",
  legendUnder: "Minder gegeven dan advies (< 90%)",
  legendMet: "Advies behaald (90–110%)",
  legendOver: "Meer gegeven dan advies (> 110%)",
  legendAdvice: "Advies",
  showLegend: "Legenda tonen",
  hideLegend: "Legenda verbergen",
  legendRemaining: "Nog te geven",
  legendPercentage: "Percentage van advies gegeven",
  noAdvice: "Geen advies beschikbaar",
  noNeed: "Geen behoefte (advies is 0)",
  noAdviceFarm: "Voor geen enkel perceel is advies beschikbaar.",
  loading: "Advies wordt berekend…",
  loadingProgress: (done: number, total: number) =>
    `Advies berekend voor ${done} van ${total} ${total === 1 ? "perceel" : "percelen"}…`,
  loadingFields: (count: number) =>
    `Advies wordt berekend voor ${count} ${count === 1 ? "perceel" : "percelen"}…`,
  loadFailed: "Het bemestingsadvies kon niet worden geladen.",
  retry: "Opnieuw proberen",
  openAdvice: "Bekijk bemestingsadvies",
  clickHint: "Klik op een perceel voor het volledige advies",
  openOverview: "Tabelweergave",
  desktopHint: "De kaart werkt het best op een groter scherm.",
} as const

/* ================ DATA SHAPES ================ */

/**
 * Slim per-field row streamed to the Atlas route. Only what the map, legend and tooltip need,
 * so the deferred payload stays small (no cultivation suggestion, no geometry).
 */
export type AtlasNutrientAdviceRow = {
  b_id: string
  /** Name of the main cultivation, or `null` when none is registered. */
  b_lu_name: string | null
  /** Friendly (Dutch) reason when no advice could be calculated. */
  errorMessage?: string
  /** Advice and applied dose per nutrient symbol, in kg/ha. */
  values: Record<string, FieldNutrientValue>
}

/**
 * Shading class of a field, written into the GeoJSON properties as `nav_class`:
 * - `loading`: the advice is still being calculated,
 * - `none`: no advice could be calculated for this field,
 * - `zero`: the advice is 0 and nothing was applied (no need for this nutrient),
 * - `under` / `on-target` / `over`: applied vs. advice ("% van advies"); the colour comes from the
 *   percentage of the advice in `nav_t`,
 * - `remaining`: amount still to apply ("Nog te geven"; ramp position in `nav_t`),
 * - `advice`: height of the advice ("Advies"; ramp position in `nav_t`).
 */
export type NutrientAdviceClass =
  | "loading"
  | "none"
  | "zero"
  | AdviceProgressStatus
  | "remaining"
  | "advice"

/** Feature property names used by the MapLibre style expressions. */
export const NAV_CLASS = "nav_class"
/**
 * Colour position: the percentage of the advice applied (0–{@link NUTRIENT_ADVICE_PERCENTAGE_MAX})
 * in "% van advies", the 0–1 ramp position in "Nog te geven" and "Advies".
 */
export const NAV_T = "nav_t"

/* ================ COLOURS ================ */

/**
 * Status colours for applied vs. advice:
 * - orange: applied is less than the advice (< 90 %),
 * - green: applied is within ±10 % of the advice (90–110 %),
 * - red: applied is more than the advice (> 110 %); never for EOC.
 *
 * Same thresholds and colours as `computeAdviceProgress`, the progress bars and the overview table
 * (Tailwind orange-500, green-500 and red-500). Used for the legend and tooltip swatches; the map
 * itself uses the continuous {@link NUTRIENT_ADVICE_PERCENTAGE_STOPS}. Colour alone is not
 * colour-blind safe, so the legend and the tooltip always add a text label (DESIGN.md).
 */
export const NUTRIENT_ADVICE_STATUS_COLORS: Record<AdviceProgressStatus, string> = {
  under: "#f97316",
  "on-target": "#22c55e",
  over: "#ef4444",
}

/** Highest percentage of the advice on the colour scale; anything above gets the last colour. */
export const NUTRIENT_ADVICE_PERCENTAGE_MAX = 200

/**
 * Continuous palette for "% van advies", as `[percentage of advice, colour]` stops: dark
 * orange at 0 %, through orange to green around 100 %, then through red to dark red at
 * {@link NUTRIENT_ADVICE_PERCENTAGE_MAX} %. Small differences between fields stay visible, while
 * 90–110 % is the same green as the "on target" status class.
 */
export const NUTRIENT_ADVICE_PERCENTAGE_STOPS: readonly (readonly [number, string])[] = [
  [0, "#c2410c"],
  [50, "#f97316"],
  [80, "#fb923c"],
  [90, "#22c55e"],
  [110, "#22c55e"],
  [125, "#f87171"],
  [150, "#ef4444"],
  [NUTRIENT_ADVICE_PERCENTAGE_MAX, "#991b1b"],
]

/**
 * Sequential ramp for the "Advies" mode (t = 0 lowest advice … 1 highest advice), ColorBrewer Blues
 * without its near-white first step, so low values stay visible on the satellite map.
 * Deliberately not orange/green/red, so those colours always mean "applied vs. advice".
 */
export const NUTRIENT_ADVICE_SEQUENTIAL_RAMP = [
  "#c6dbef",
  "#9ecae1",
  "#6baed6",
  "#3182bd",
  "#08519c",
] as const

/**
 * Sequential ramp for the "Nog te geven" mode (t = 0 nothing left … 1 most still to apply on the
 * farm), ColorBrewer Purples: light means little or nothing left, dark means a lot. Distinct from
 * the status palette and the blue advice ramp.
 */
export const NUTRIENT_ADVICE_REMAINING_RAMP = [
  "#efedf5",
  "#dadaeb",
  "#bcbddc",
  "#9e9ac8",
  "#807dba",
  "#6a51a3",
  "#4a1486",
] as const

/** Outline of every field: white dotted line, so field boundaries stand out on the satellite map. */
export const NUTRIENT_ADVICE_OUTLINE_COLOR = "#ffffff"

/** Fill colour of fields without advice (dark grey, never confused with the status colours). */
export const NUTRIENT_ADVICE_NONE_COLOR = "#4b5563"
/** Fill colour of fields without a need for the nutrient (light, so they recede). */
export const NUTRIENT_ADVICE_ZERO_COLOR = "#e7e5e4"
/** Fill colour while the advice is still loading. */
export const NUTRIENT_ADVICE_LOADING_COLOR = "#f1f5f9"

/* ================ SCALE & SHADING ================ */

/** Farm-wide scale for the selected nutrient. */
export type NutrientAdviceScale = {
  /** Lowest and highest positive advice on the farm (kg/ha), used by the "Advies" mode. */
  minAdvice: number
  maxAdvice: number
  /** Largest amount still to apply on the farm (kg/ha), used by the "Nog te geven" mode. */
  maxRemaining: number
}

/**
 * Computes the farm-wide scale of one nutrient over all fields that have advice.
 *
 * Fields with an advice of 0 are left out, so fields without a need for the nutrient (nature,
 * woodland) do not stretch the "Advies" ramp down to 0.
 *
 * @param rows - Streamed rows of the farm.
 * @param nutrient - Selected nutrient symbol.
 * @returns The scale; safe defaults when no field has advice.
 */
export function getNutrientAdviceScale(
  rows: AtlasNutrientAdviceRow[],
  nutrient: string,
): NutrientAdviceScale {
  let minAdvice = Number.POSITIVE_INFINITY
  let maxAdvice = Number.NEGATIVE_INFINITY
  let maxRemaining = 0
  for (const row of rows) {
    const value = row.values[nutrient]
    if (!value || value.advice <= 0) continue
    minAdvice = Math.min(minAdvice, value.advice)
    maxAdvice = Math.max(maxAdvice, value.advice)
    maxRemaining = Math.max(maxRemaining, value.advice - value.filling)
  }
  if (!Number.isFinite(minAdvice)) {
    minAdvice = 0
    maxAdvice = 1
  }
  return { minAdvice, maxAdvice, maxRemaining }
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Shading of one field: its class and its position on the colour scale. */
export type FieldShading = {
  class: NutrientAdviceClass
  /** Percentage of the advice ("% van advies") or 0–1 ramp position (other modes); 0 otherwise. */
  t: number
}

/**
 * Converts the advice and applied dose of one field into its shading.
 *
 * - An advice of 0 with nothing applied is `zero` in every mode (no need, not "advice met").
 * - "Nog te geven": `remaining` with `t` = amount still to apply relative to the largest amount on
 *   the farm. A surplus (more applied than advised) counts as 0: nothing left to apply.
 * - "% van advies": the status class from `computeAdviceProgress` — `on-target` when applied is
 *   90–110 % of the advice, `over` above, `under` below — so the map, the overview table and the
 *   field cards always agree, and `t` is the percentage of the advice for the continuous palette.
 *   EOC is never `over` (`excessExempt`), so its percentage is capped at 100.
 * - "Advies": `advice` with `t` between the lowest and highest advice on the farm.
 *
 * @param value - Advice and applied dose in kg/ha, or `undefined` when the field has no advice.
 * @param mode - Display mode.
 * @param scale - Farm-wide scale from {@link getNutrientAdviceScale}.
 * @param excessExempt - `true` for nutrients that are never harmful in excess (EOC).
 * @returns The {@link FieldShading} of the field.
 */
export function getFieldShading(
  value: FieldNutrientValue | undefined,
  mode: NutrientAdviceMode,
  scale: NutrientAdviceScale,
  excessExempt: boolean,
): FieldShading {
  if (!value) return { class: "none", t: 0 }
  const { advice, filling } = value
  if (advice <= 0 && filling <= 0) return { class: "zero", t: 0 }

  if (mode === "advice") {
    const range = scale.maxAdvice - scale.minAdvice
    const t = range > 0 ? clamp((advice - scale.minAdvice) / range, 0, 1) : 0.5
    return { class: "advice", t }
  }

  if (mode === "remaining") {
    const remaining = Math.max(advice - filling, 0)
    const t = scale.maxRemaining > 0 ? clamp(remaining / scale.maxRemaining, 0, 1) : 0
    return { class: "remaining", t }
  }

  const { status } = computeAdviceProgress(filling, advice, excessExempt)
  // Something applied against a zero advice is too much by definition: the end of the scale.
  const percentage = advice > 0 ? (filling / advice) * 100 : NUTRIENT_ADVICE_PERCENTAGE_MAX
  const upper = excessExempt ? 100 : NUTRIENT_ADVICE_PERCENTAGE_MAX
  return { class: status, t: clamp(percentage, 0, upper) }
}

/**
 * Writes `nav_class` and `nav_t` for the selected nutrient and mode into a copy of the fields.
 * Doing this in JS (instead of in a MapLibre expression) keeps the style simple and testable, and
 * avoids nested objects in GeoJSON properties (MapLibre stringifies those).
 *
 * The advice arrives per field. A field without a row is `loading` until every row has arrived
 * (`complete`), and `none` (no advice) after that. The scale is taken from the rows received so
 * far, so colours can still shift slightly while the last fields arrive.
 *
 * @param fieldsData - Field geometries with at least `b_id` in the properties.
 * @param rowsById - Advice rows received so far, by field ID.
 * @param complete - `true` once the advice of every field has arrived.
 * @param nutrient - Selected nutrient symbol.
 * @param mode - Display mode.
 * @returns A new FeatureCollection; the input is not mutated.
 */
export function applyNutrientAdviceShading(
  fieldsData: FeatureCollection<Geometry, GeoJsonProperties>,
  rowsById: Map<string, AtlasNutrientAdviceRow>,
  complete: boolean,
  nutrient: string,
  mode: NutrientAdviceMode,
): FeatureCollection<Geometry, GeoJsonProperties> {
  const scale = getNutrientAdviceScale([...rowsById.values()], nutrient)
  const excessExempt = nutrient === "EOC"

  const features = fieldsData.features.map((feature): Feature<Geometry, GeoJsonProperties> => {
    const b_id = feature.properties?.b_id as string | undefined
    const row = b_id ? rowsById.get(b_id) : undefined
    const shading: FieldShading =
      row || complete
        ? getFieldShading(row?.values[nutrient], mode, scale, excessExempt)
        : { class: "loading", t: 0 }
    return {
      ...feature,
      properties: {
        ...feature.properties,
        [NAV_CLASS]: shading.class,
        [NAV_T]: shading.t,
      },
    }
  })

  return { ...fieldsData, features }
}

/**
 * Counts the fields per shading class, for the legend.
 *
 * @param shadedFields - Output of {@link applyNutrientAdviceShading}.
 * @returns Number of fields per {@link NutrientAdviceClass}; classes without fields are 0.
 */
export function countNutrientAdviceClasses(
  shadedFields: FeatureCollection<Geometry, GeoJsonProperties> | undefined,
): Record<NutrientAdviceClass, number> {
  const counts: Record<NutrientAdviceClass, number> = {
    loading: 0,
    none: 0,
    zero: 0,
    under: 0,
    "on-target": 0,
    over: 0,
    remaining: 0,
    advice: 0,
  }
  for (const feature of shadedFields?.features ?? []) {
    const cls = feature.properties?.[NAV_CLASS] as NutrientAdviceClass | undefined
    if (cls && cls in counts) counts[cls] += 1
  }
  return counts
}

/**
 * CSS gradient of the comparison palette for the legend, from 0 % to `max` % of the advice.
 *
 * @param max - Highest percentage shown: 100 for EOC (never too much), otherwise
 * {@link NUTRIENT_ADVICE_PERCENTAGE_MAX}.
 * @returns A `linear-gradient(...)` value.
 */
export function getNutrientAdvicePercentageGradient(max: number): string {
  const stops = NUTRIENT_ADVICE_PERCENTAGE_STOPS.filter(([value]) => value <= max).map(
    ([value, color]) => `${color} ${(value / max) * 100}%`,
  )
  return `linear-gradient(to right, ${stops.join(", ")})`
}

/* ================ MAPLIBRE STYLES ================ */

/**
 * Evenly spaced `interpolate` stops for a ramp over [from, to].
 *
 * @param ramp - Colours, low to high.
 * @param from - Value of the first colour.
 * @param to - Value of the last colour.
 * @returns Flat `[value, colour, value, colour, …]` list.
 */
function rampStops(ramp: readonly string[], from: number, to: number): (number | string)[] {
  return ramp.flatMap((color, i) => [from + ((to - from) * i) / (ramp.length - 1), color])
}

/**
 * Fill style of the layer, driven by `nav_class` and `nav_t`. The status classes share the
 * continuous orange–green–red palette on the percentage of the advice (interpolated in Lab, so the
 * transitions stay even); "Nog te geven" uses the purple ramp and "Advies" the blue ramp. The style does not depend on the data or
 * the mode: the mode is already encoded in the classes.
 *
 * @returns Layer `type` and `paint` props.
 */
export function getNutrientAdviceFillStyle(): {
  type: "fill"
  paint: FillLayerSpecification["paint"]
} {
  const percentageColor = [
    "interpolate-lab",
    ["linear"],
    ["get", NAV_T],
    ...NUTRIENT_ADVICE_PERCENTAGE_STOPS.flat(),
  ] as ExpressionSpecification
  const adviceColor = [
    "interpolate",
    ["linear"],
    ["get", NAV_T],
    ...rampStops(NUTRIENT_ADVICE_SEQUENTIAL_RAMP, 0, 1),
  ] as ExpressionSpecification

  return {
    type: "fill",
    paint: {
      "fill-color": [
        "match",
        ["get", NAV_CLASS],
        ["under", "on-target", "over"],
        percentageColor,
        "remaining",
        [
          "interpolate",
          ["linear"],
          ["get", NAV_T],
          ...rampStops(NUTRIENT_ADVICE_REMAINING_RAMP, 0, 1),
        ],
        "advice",
        adviceColor,
        "zero",
        NUTRIENT_ADVICE_ZERO_COLOR,
        "none",
        NUTRIENT_ADVICE_NONE_COLOR,
        NUTRIENT_ADVICE_LOADING_COLOR,
      ] as ExpressionSpecification,
      "fill-opacity": [
        "match",
        ["get", NAV_CLASS],
        "loading",
        0.55,
        "zero",
        0.5,
        "none",
        0.55,
        0.75,
      ] as ExpressionSpecification,
    },
  }
}

/**
 * Outline of **all** fields of the farm: a white dotted line, so the field boundaries are easy to
 * spot on the satellite map regardless of the fill colour.
 *
 * `line-cap: round` with a short dash turns the dashes into dots. The route merges its own
 * `visibility` into this `layout`.
 *
 * @returns Layer `type`, `layout` and `paint` props.
 */
export function getNutrientAdviceOutlineStyle(): {
  type: "line"
  layout: LineLayerSpecification["layout"]
  paint: LineLayerSpecification["paint"]
} {
  return {
    type: "line",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": NUTRIENT_ADVICE_OUTLINE_COLOR,
      "line-width": 2.5,
      // Dash lengths are in line widths: a near-zero dash + round cap = a dot, then a 2-width gap.
      "line-dasharray": [0.1, 2],
    },
  }
}

/* ================ FORMATTING ================ */

/**
 * Formats a kg/ha amount in Dutch notation with sensible precision: whole numbers from 10,
 * one decimal from 1, otherwise up to three decimals (trace elements are fractions of a kg).
 *
 * @param value - Amount in kg/ha.
 * @returns Formatted number without unit.
 */
export function formatKgPerHa(value: number): string {
  const abs = Math.abs(value)
  const maximumFractionDigits = abs >= 10 ? 0 : abs >= 1 ? 1 : 3
  return value.toLocaleString("nl-NL", { maximumFractionDigits })
}
