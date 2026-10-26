import type { SoilParameterDescription } from "@nmi-agro/fdm-core"
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson"
import { ChevronUp, TriangleAlert } from "lucide-react"
import { type ReactNode, useId, useMemo, useState } from "react"
import { Bar, BarChart, type BarShapeProps, Rectangle, XAxis, YAxis } from "recharts"
import type { AdviceProgressStatus } from "~/components/blocks/nutrient-advice/progress-bar"
import { cn } from "@/app/lib/utils"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ChartContainer } from "~/components/ui/chart"
import { Spinner } from "~/components/ui/spinner"
import { useIsMobile } from "~/hooks/use-mobile"
import {
  formatKgPerHa,
  NUTRIENT_ADVICE_COPY,
  getNutrientAdvicePercentageGradient,
  NUTRIENT_ADVICE_NONE_COLOR,
  NUTRIENT_ADVICE_PERCENTAGE_MAX,
  NUTRIENT_ADVICE_REMAINING_RAMP,
  NUTRIENT_ADVICE_SEQUENTIAL_RAMP,
  NUTRIENT_ADVICE_STATUS_COLORS,
  NUTRIENT_ADVICE_ZERO_COLOR,
  type NutrientAdviceClass,
  type NutrientAdviceMode,
  type NutrientAdviceScale,
} from "./atlas-nutrient-advice"
import {
  GRADIENT_DEFINITIONS,
  GRADIENT_SHADED_SOIL_PARAMETERS,
  getShadedSoilParameters,
  getShadingParameterMapper,
  SHADED_SOIL_TYPES,
  type ShadedSoilParameters,
  transformGradientStops,
} from "./atlas-soil-analysis"

/** Shared swatch row for the "currently selected field" highlight used across atlas surfaces. */
export function SelectedFieldSwatch({ color = "#ffcf0d" }: { color?: string }) {
  return (
    <div className="text-muted-foreground mt-1.5 flex items-center gap-1">
      <div
        className="border-foreground/20 h-2.5 w-2.5 shrink-0 rounded-full border"
        style={{ backgroundColor: color }}
      />
      <span>Huidig perceel</span>
    </div>
  )
}

interface ScoreLegendProps {
  /** Human-readable label shown above the scale, e.g. the selected indicator's name. */
  label?: string
  /** Whether to show the "currently selected field" swatch (field-detail surfaces only). */
  showSelectedFieldSwatch?: boolean
}

function ScoreLegendBar({
  size,
  marker,
  color,
  roundStart,
  roundEnd,
}: {
  size: number
  marker: number
  color: string
  roundStart?: boolean
  roundEnd?: boolean
}) {
  return (
    <div
      className={cn(
        "relative h-2.5 overflow-visible",
        roundStart && "rounded-l-sm",
        roundEnd && "rounded-r-sm",
      )}
      style={{ flex: size, backgroundColor: color }}
    >
      <div className="text-muted-foreground absolute top-full right-0 z-20 translate-x-1/2 translate-y-0.5 text-xs tabular-nums">
        {marker}
      </div>
    </div>
  )
}

/**
 * Legend for maps that colour fields on the shared 0–100 red→yellow→green score scale
 * (`getScoreColor`/`getScoreTier` in `~/lib/indicators`, and the matching `step` expression
 * in `getFieldsScoreStyle`). Used by the farm-level indicators atlas and the field-level
 * indicators mini-map so both surfaces explain the same colour key.
 */
export function ScoreLegend({ label, showSelectedFieldSwatch }: ScoreLegendProps) {
  return (
    <Card className="pointer-events-none max-w-[200px] p-2 text-xs shadow-sm">
      {label && <p className="text-foreground mb-1.5 truncate font-medium">{label}</p>}
      <div className="mb-5 flex h-2.5 w-full gap-px px-1.5">
        <ScoreLegendBar size={0} marker={0} color="#ef4444" />
        <ScoreLegendBar size={40} marker={40} color="#ef4444" roundStart />
        <ScoreLegendBar size={30} marker={70} color="#eab308" />
        <ScoreLegendBar size={30} marker={100} color="#22c55e" roundEnd />
      </div>
      <div className="text-muted-foreground mt-1.5 flex items-center gap-1">
        <div className="bg-muted-foreground/40 h-2.5 w-2.5 shrink-0 rounded-full" />
        <span>Geen data</span>
      </div>
      {showSelectedFieldSwatch && <SelectedFieldSwatch />}
    </Card>
  )
}

/**
 * Legend for maps that colour fields by measure count on a grey → light-green → dark-green
 * scale (see `getMeasureCountFillStyle` in `measures-atlas.tsx`).
 */
export function MeasureCountLegend({
  showSelectedFieldSwatch,
}: {
  showSelectedFieldSwatch?: boolean
}) {
  return (
    <Card className="pointer-events-none max-w-[200px] p-2 text-xs shadow-sm">
      <p className="text-foreground mb-1.5 font-medium">Maatregelen</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <div className="border-foreground/10 h-2.5 w-2.5 shrink-0 rounded-full border bg-[#d1d5db]" />
          <span className="text-muted-foreground">Geen maatregelen</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="border-foreground/10 h-2.5 w-2.5 shrink-0 rounded-full border bg-[#86efac]" />
          <span className="text-muted-foreground">1 maatregel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="border-foreground/10 h-2.5 w-2.5 shrink-0 rounded-full border bg-[#16a34a]" />
          <span className="text-muted-foreground">5+ maatregelen</span>
        </div>
      </div>
      {showSelectedFieldSwatch && <SelectedFieldSwatch />}
    </Card>
  )
}

interface ElevationLegendProps {
  min?: number
  max?: number
  loading?: boolean
  hoverValue?: number | null
  showScale?: boolean
  networkStatus?: "idle" | "loading" | "slow" | "error"
  message?: string
}

export function ElevationLegend({
  min,
  max,
  loading,
  hoverValue,
  showScale = true,
  networkStatus,
  message,
}: ElevationLegendProps) {
  return (
    <div className="w-40">
      <Card className="shadow-xs">
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Hoogte (AHN4)
            </h4>
            {loading && <Spinner className="h-3 w-3" />}
          </div>

          {networkStatus === "slow" && (
            <div className="mb-2 text-xs font-medium text-orange-600">Trage verbinding...</div>
          )}

          {networkStatus === "error" && (
            <div className="text-destructive mb-2 text-xs font-medium">Fout bij laden</div>
          )}

          {message && (
            <div className="text-muted-foreground mb-2 text-xs font-medium">{message}</div>
          )}

          {showScale && (
            <div className="flex flex-col gap-1">
              <div className="border-border relative flex h-4 w-full overflow-hidden rounded border">
                <div
                  className="absolute inset-0 h-full w-full"
                  style={{
                    // BrewerSpectral11 Reversed (Blue -> Red)
                    background:
                      "linear-gradient(to right, #5e4fa2, #3288bd, #66c2a5, #abdda4, #e6f598, #ffffbf, #fee08b, #fdae61, #f46d43, #d53e4f, #9e0142)",
                  }}
                />
              </div>
              <div className="text-muted-foreground flex justify-between text-xs font-medium tabular-nums">
                <span>{min !== undefined ? `${min.toFixed(1)}m` : "Laag"}</span>
                <span>{max !== undefined ? `${max.toFixed(1)}m` : "Hoog"}</span>
              </div>
              {hoverValue !== undefined && hoverValue !== null && (
                <div className="mt-2 text-left text-xs font-bold">
                  Hoogte: {hoverValue.toFixed(2)} m NAP
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
interface SoilAnalysisLegendProps {
  fieldsData?: FeatureCollection<Geometry, GeoJsonProperties>
  selectedParameter: ShadedSoilParameters
  soilParametersDescriptions: SoilParameterDescription
  min?: number
  max?: number
}

export function SoilAnalysisLegend(props: SoilAnalysisLegendProps) {
  const { fieldsData, selectedParameter } = props

  // Parameter shading config
  const shadingConfig = Object.fromEntries(
    getShadedSoilParameters().map((item) => [item.parameter, item]),
  )

  if (!shadingConfig[selectedParameter]) {
    console.warn(`${selectedParameter} not found in shaded soil parameters.`)
  }

  const anyDataAvailable = fieldsData?.features.some(
    (feature) => feature.properties && selectedParameter in feature.properties,
  )

  const parameterDescription = props.soilParametersDescriptions.find(
    (item) => item.parameter === props.selectedParameter,
  )

  const unitDisplay =
    parameterDescription?.unit && parameterDescription.unit !== "-"
      ? ` (${parameterDescription.unit})`
      : ""
  const title = parameterDescription ? `${parameterDescription.name}${unitDisplay}` : undefined

  return (
    <Card className="min-h-0 flex-initial space-y-2 overflow-y-auto p-4 shadow-xs">
      <CardHeader className="p-0">
        <CardTitle className="text-muted-foreground text-center text-xs">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!shadingConfig[selectedParameter] ? null : shadingConfig[selectedParameter].shading ===
          "enum" ? (
          <EnumSoilAnalysisLegend {...props} />
        ) : (
          <GradientSoilAnalysisLegend {...props} selectedParameter={selectedParameter} />
        )}
        {fieldsData && fieldsData.features.length > 0 && !anyDataAvailable && (
          <p className="flex flex-row items-center gap-2 text-xs">
            <TriangleAlert className="h-4 w-4 text-orange-500" />
            Geen data op hele bedrijf
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function EnumSoilAnalysisLegend(props: SoilAnalysisLegendProps) {
  const displayedOptions = useMemo(() => {
    if (props.selectedParameter !== "b_soiltype_agr") return []
    if (!props.fieldsData) return SHADED_SOIL_TYPES

    const found = new Set<string>()

    for (const feature of props.fieldsData.features) {
      const value = feature.properties?.[props.selectedParameter]
      if (typeof value !== "undefined") {
        found.add(value as string)
      }
    }

    return SHADED_SOIL_TYPES.filter((item) => found.has(item.value))
  }, [props.selectedParameter, props.fieldsData])

  return (
    <table className="border-separate border-spacing-1">
      <tbody>
        {displayedOptions.map((opt) => (
          <tr key={opt.value}>
            <td className="align-middle">
              <div className="size-3 rounded" style={{ backgroundColor: opt.fill }} />
            </td>
            <td className="text-muted-foreground align-middle text-sm">{opt.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GradientSoilAnalysisLegend(
  props: SoilAnalysisLegendProps & {
    selectedParameter: ShadedSoilParameters
  },
) {
  const gradientId = useId()

  const gradDef =
    GRADIENT_DEFINITIONS[
      GRADIENT_SHADED_SOIL_PARAMETERS[
        props.selectedParameter as keyof typeof GRADIENT_SHADED_SOIL_PARAMETERS
      ]
    ]

  if (!gradDef) {
    console.warn(`No gradient definition found for parameter: ${props.selectedParameter}`)
    return null
  }

  const parameterMapper = getShadingParameterMapper(props.selectedParameter)

  const min = props.min ?? 0
  const max = props.max ?? 1

  const chartData = [{ name: "Legenda", min: min, max: max }]
  const gradient = transformGradientStops(gradDef.gradient, min, max, gradDef.center)

  return (
    <ChartContainer
      config={{}}
      initialDimension={{ width: 150, height: 40 }}
      className="-mx-3 aspect-3/1 min-w-40 last:-mbe-3"
    >
      <BarChart
        className="overflow-visible"
        barSize={20}
        data={chartData}
        layout="vertical"
        margin={{
          left: 12,
          right: 12,
          top: 0,
          bottom: 0,
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            {gradient.map((stop) => (
              <stop
                key={stop.normalPosition}
                offset={`${stop.normalPosition * 100}%`}
                stopColor={stop.color}
              />
            ))}
          </linearGradient>
        </defs>
        <XAxis
          type="number"
          domain={[min, max]}
          niceTicks="snap125"
          tickFormatter={(n) => (Math.round(parameterMapper.inverse(n) * 100) / 100).toString()}
        />
        <YAxis type="category" dataKey="name" tickLine={false} hide />
        <Bar
          isAnimationActive={false}
          dataKey={(entry: (typeof chartData)[number]): [number, number] => [entry.min, entry.max]}
          shape={(props: BarShapeProps) => <Rectangle {...props} fill={`url(#${gradientId})`} />}
        />
      </BarChart>
    </ChartContainer>
  )
}

/** Colour swatch of the Bemestingsadvies layer, shared by the legend and the tooltip. */
export function NutrientAdviceSwatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-3.5 shrink-0 rounded-sm", className)}
      style={{ backgroundColor: color }}
    />
  )
}

/** Swatch per status class, shared by the legend and the tooltip. */
export const NUTRIENT_ADVICE_STATUS_SWATCHES = {
  under: { color: NUTRIENT_ADVICE_STATUS_COLORS.under },
  "on-target": { color: NUTRIENT_ADVICE_STATUS_COLORS["on-target"] },
  over: { color: NUTRIENT_ADVICE_STATUS_COLORS.over },
} as const

interface NutrientAdviceLegendProps {
  /** Display mode of the layer. */
  mode: NutrientAdviceMode
  /** Name of the selected nutrient, e.g. "Stikstof, werkzaam". */
  nutrientName: string
  /** Unit of the selected nutrient, always kg/ha (e.g. "kg N/ha"). */
  unit: string
  /** Farm-wide scale, or `null` while the advice is still loading. */
  scale: NutrientAdviceScale | null
  /** Number of fields per shading class, from `countNutrientAdviceClasses`. */
  counts: Record<NutrientAdviceClass, number>
  /** Number of fields on the map. */
  fieldCount: number
  /** How many fields' advice has arrived (`settled`) out of `total`; shown while streaming. */
  progress: { settled: number; total: number }
  /** Reason shown when no field has advice (e.g. the first error message), if known. */
  noAdviceReason?: string
  /** `true` when loading the advice failed (network/transport error), not "no advice". */
  loadFailed?: boolean
  /** Called by the retry button shown when `loadFailed` is `true`. */
  onRetry?: () => void
  /** Disables the retry button while a retry is running. */
  isRetrying?: boolean
  /** `true` for nutrients that are never harmful in excess (EOC): no "over" swatch. */
  excessExempt?: boolean
}

/** One legend row: swatch, label and the number of fields in that class. */
function NutrientAdviceLegendRow({
  swatch,
  label,
  count,
}: {
  swatch: ReactNode
  label: string
  count: number
}) {
  return (
    <li className={cn("flex items-center gap-2 text-xs", count === 0 && "text-muted-foreground")}>
      {swatch}
      <span className="grow">{label}</span>
      <span className="text-muted-foreground tabular-nums">
        {count}
        <span className="sr-only"> {count === 1 ? "perceel" : "percelen"}</span>
      </span>
    </li>
  )
}

/**
 * Colour bar of a continuous scale with its values underneath: lowest and highest, plus an optional
 * middle value centred under the bar.
 */
function NutrientAdviceLegendRamp({
  background,
  from,
  middle,
  to,
  label,
}: {
  background: string
  from: string
  middle?: string
  to: string
  label: string
}) {
  return (
    <div className="space-y-1">
      <div
        className="h-3 w-full rounded-sm"
        style={{ background }}
        role="img"
        aria-label={`${label}: van ${from} tot ${to}`}
      />
      <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>{from}</span>
        {middle && <span>{middle}</span>}
        <span>{to}</span>
      </div>
    </div>
  )
}

/**
 * Legend of the Atlas "Bemestingsadvies" layer.
 *
 * - "Nog te geven": a purple bar from 0 (nothing left, also for a surplus) to the largest amount
 *   still to apply on the farm.
 * - "% van advies": the continuous orange–green–red bar on the percentage of the advice, plus the
 *   number of fields that are under (< 90 %), on (90–110 %) and over (> 110 %) the advice. EOC is
 *   never "over", so its bar ends at 100 % and it has no red row.
 * - "Advies": a blue bar from the lowest to the highest advice on the farm.
 *
 * Rows for "no need" (advice 0) and "no advice" appear only when such fields exist. While loading
 * the legend shows progress instead of an empty key; when no field has advice it says so for the
 * whole farm. Every colour has a text label next to it (DESIGN.md: colour is never the only signal).
 */
export function NutrientAdviceLegend(props: NutrientAdviceLegendProps) {
  const {
    mode,
    nutrientName,
    unit,
    scale,
    counts,
    fieldCount,
    progress,
    noAdviceReason,
    loadFailed,
    onRetry,
    isRetrying,
    excessExempt = false,
  } = props

  // On a phone the key starts collapsed to its title, so it does not cover half of the map.
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)
  const collapsed = isMobile && !expanded

  const title = (
    <>
      <span className="block text-sm leading-tight font-medium">{nutrientName}</span>
      <span className="text-muted-foreground block text-xs">
        {unit} · {NUTRIENT_ADVICE_COPY.modes[mode]}
      </span>
    </>
  )
  // Announced to screen readers when the nutrient or mode changes. Only collapsible states get the
  // toggle, so `aria-expanded` always matches what is shown.
  const renderHeader = (collapsible: boolean) => (
    <CardHeader className="space-y-0.5 p-0" aria-live="polite">
      {collapsible ? (
        <button
          type="button"
          // The legend wrapper ignores pointer events so it never blocks the map.
          className="pointer-events-auto -m-1 flex min-h-11 items-center justify-between gap-2 rounded-sm p-1 text-left"
          aria-expanded={!collapsed}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="space-y-0.5">{title}</span>
          <span className="sr-only">
            {collapsed ? NUTRIENT_ADVICE_COPY.showLegend : NUTRIENT_ADVICE_COPY.hideLegend}
          </span>
          <ChevronUp
            aria-hidden="true"
            className={cn(
              "text-muted-foreground size-4 shrink-0 transition-transform motion-reduce:transition-none",
              collapsed && "rotate-180",
            )}
          />
        </button>
      ) : (
        title
      )}
    </CardHeader>
  )
  const header = renderHeader(isMobile)
  // Failure and "no advice" messages stay visible (the retry button must stay reachable), so
  // their header has no toggle.
  const staticHeader = renderHeader(false)
  const cardClassName =
    "min-h-0 w-72 max-w-[calc(100vw-2rem)] flex-initial space-y-3 overflow-y-auto p-3 shadow-xs md:p-4"

  // A failed load gets its own message and retry button instead of a legend that would suggest
  // the fields have no advice.
  if (loadFailed) {
    return (
      <Card className={cardClassName}>
        {staticHeader}
        <CardContent className="space-y-2 p-0">
          <p className="flex items-start gap-2 text-xs" role="alert">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-orange-500" />
            {NUTRIENT_ADVICE_COPY.loadFailed}
          </p>
          {onRetry && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              // The legend wrapper ignores pointer events so it never blocks the map.
              className="pointer-events-auto w-full"
              onClick={onRetry}
              disabled={isRetrying}
            >
              {isRetrying && <Spinner className="size-3" />}
              {NUTRIENT_ADVICE_COPY.retry}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  if (scale === null) {
    if (collapsed) return <Card className={cardClassName}>{header}</Card>
    return (
      <Card className={cardClassName}>
        {header}
        <CardContent className="p-0">
          <p className="flex items-center gap-2 text-xs" role="status">
            <Spinner className="size-3" />
            {fieldCount > 0
              ? NUTRIENT_ADVICE_COPY.loadingFields(fieldCount)
              : NUTRIENT_ADVICE_COPY.loading}
          </p>
        </CardContent>
      </Card>
    )
  }

  const complete = progress.settled >= progress.total
  // Progress while the advice streams in field by field; also shown when collapsed on a phone.
  const progressLine = complete ? null : (
    <p className="text-muted-foreground flex items-center gap-2 text-xs" role="status">
      <Spinner className="size-3" />
      {NUTRIENT_ADVICE_COPY.loadingProgress(progress.settled, progress.total)}
    </p>
  )

  if (complete && fieldCount > 0 && counts.none === fieldCount) {
    return (
      <Card className={cardClassName}>
        {staticHeader}
        <CardContent className="space-y-1 p-0" role="alert">
          <p className="flex items-start gap-2 text-xs">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-orange-500" />
            {NUTRIENT_ADVICE_COPY.noAdviceFarm}
          </p>
          {noAdviceReason && <p className="text-muted-foreground text-xs">{noAdviceReason}</p>}
        </CardContent>
      </Card>
    )
  }

  if (collapsed) {
    return (
      <Card className={cardClassName}>
        {header}
        {progressLine}
      </Card>
    )
  }

  const swatch = (status: AdviceProgressStatus) => (
    <NutrientAdviceSwatch {...NUTRIENT_ADVICE_STATUS_SWATCHES[status]} />
  )

  const percentageMax = excessExempt ? 100 : NUTRIENT_ADVICE_PERCENTAGE_MAX
  const overRow = excessExempt ? null : (
    <NutrientAdviceLegendRow
      swatch={swatch("over")}
      label={NUTRIENT_ADVICE_COPY.legendOver}
      count={counts.over}
    />
  )

  return (
    <Card className={cardClassName}>
      {header}
      <CardContent className="space-y-2 p-0">
        {mode === "advice" ? (
          <NutrientAdviceLegendRamp
            background={`linear-gradient(to right, ${NUTRIENT_ADVICE_SEQUENTIAL_RAMP.join(", ")})`}
            from={`${formatKgPerHa(scale.minAdvice)} ${unit}`}
            to={`${formatKgPerHa(scale.maxAdvice)} ${unit}`}
            label={NUTRIENT_ADVICE_COPY.legendAdvice}
          />
        ) : mode === "remaining" ? (
          <NutrientAdviceLegendRamp
            background={`linear-gradient(to right, ${NUTRIENT_ADVICE_REMAINING_RAMP.join(", ")})`}
            from={`0 ${unit}`}
            to={`${formatKgPerHa(scale.maxRemaining)} ${unit}`}
            label={NUTRIENT_ADVICE_COPY.legendRemaining}
          />
        ) : (
          <NutrientAdviceLegendRamp
            background={getNutrientAdvicePercentageGradient(percentageMax)}
            from="0%"
            middle={excessExempt ? undefined : "100%"}
            to={`≥ ${percentageMax}%`}
            label={NUTRIENT_ADVICE_COPY.legendPercentage}
          />
        )}
        <ul className="space-y-1">
          {mode === "percentage" && (
            <>
              <NutrientAdviceLegendRow
                swatch={swatch("under")}
                label={NUTRIENT_ADVICE_COPY.legendUnder}
                count={counts.under}
              />
              <NutrientAdviceLegendRow
                swatch={swatch("on-target")}
                label={NUTRIENT_ADVICE_COPY.legendMet}
                count={counts["on-target"]}
              />
              {overRow}
            </>
          )}
          {counts.zero > 0 && (
            <NutrientAdviceLegendRow
              swatch={
                <NutrientAdviceSwatch color={NUTRIENT_ADVICE_ZERO_COLOR} className="border" />
              }
              label={NUTRIENT_ADVICE_COPY.noNeed}
              count={counts.zero}
            />
          )}
          {counts.none > 0 && (
            <NutrientAdviceLegendRow
              swatch={<NutrientAdviceSwatch color={NUTRIENT_ADVICE_NONE_COLOR} />}
              label={NUTRIENT_ADVICE_COPY.noAdvice}
              count={counts.none}
            />
          )}
        </ul>
        {progressLine}
      </CardContent>
    </Card>
  )
}
