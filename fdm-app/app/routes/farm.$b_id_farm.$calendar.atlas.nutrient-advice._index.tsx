import type { FeatureCollection, Geometry } from "geojson"
import type { MapGeoJSONFeature } from "maplibre-gl"
import { getFields } from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import { Table as TableIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Layer, type LayerProps } from "react-map-gl/maplibre"
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useLoaderData,
  useNavigate,
  useRevalidator,
} from "react-router"
import type { NutrientDescription } from "~/components/blocks/nutrient-advice/types"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import {
  NUTRIENT_ADVICE_STATUS_SWATCHES,
  NutrientAdviceLegend,
  NutrientAdviceSwatch,
} from "~/components/blocks/atlas/atlas-legend"
import {
  applyNutrientAdviceShading,
  type AtlasNutrientAdviceRow,
  countNutrientAdviceClasses,
  formatKgPerHa,
  getNutrientAdviceFillStyle,
  getNutrientAdviceOutlineStyle,
  getNutrientAdviceScale,
  isNutrientAdviceMode,
  NUTRIENT_ADVICE_COPY,
  NUTRIENT_ADVICE_MODES,
  NUTRIENT_ADVICE_ZERO_COLOR,
} from "~/components/blocks/atlas/atlas-nutrient-advice"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import {
  AtlasTooltip,
  AtlasTooltipContent,
  AtlasTooltipFooter,
  AtlasTooltipHeader,
} from "~/components/blocks/atlas/atlas-tooltip"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { getNutrientsDescription } from "~/components/blocks/nutrient-advice/nutrients"
import {
  AdviceProgressBar,
  computeAdviceProgress,
} from "~/components/blocks/nutrient-advice/progress-bar"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "~/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useAnalytics } from "~/hooks/use-analytics"
import { useStreamedRows } from "~/hooks/use-streamed-rows"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { startFarmNutrientAdviceRows } from "~/lib/nutrient-advice.server"
import { useSelectedAtlasNutrientAdviceStore } from "~/store/selected-nutrient-advice"

export const meta: MetaFunction = () => {
  return [
    { title: `Bemestingsadvies - Atlas | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Bekijk het bemestingsadvies van alle percelen van uw bedrijf op één kaart: waar nog nutriënten nodig zijn, waar het advies behaald is en waar meer is gegeven dan geadviseerd.",
    },
  ]
}

/**
 * Loads the field geometries of the farm immediately and defers the per-field nutrient advice.
 *
 * The advice needs one NMI API call per field, so it is returned as one promise per field
 * (`rowPromises`) that React Router streams to the client. The map renders the field outlines
 * straight away and colours each field as soon as its advice arrives.
 *
 * @returns `fieldsData` (simplified GeoJSON, `undefined` without a farm) and `rowPromises` (slim
 * advice rows in kg/ha, one promise per field, `null` without a farm).
 * @throws {Response} When loading the fields fails.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const session = await getSession(request)
    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)

    let fieldsData: FeatureCollection | undefined
    let rowPromises: Promise<AtlasNutrientAdviceRow>[] | null = null

    if (b_id_farm && b_id_farm !== "undefined") {
      const fields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)

      fieldsData = {
        type: "FeatureCollection",
        features: fields.map((field) => ({
          type: "Feature" as const,
          properties: {
            b_id: field.b_id,
            b_name: field.b_name,
            b_area: Math.round((field.b_area ?? 0) * 10) / 10,
          },
          geometry: simplify(field.b_geometry as Geometry, {
            tolerance: 0.00001,
            highQuality: true,
          }),
        })),
      }

      // Same calculation as the Bemestingsadvies overview, then slimmed down to what the map needs.
      rowPromises = startFarmNutrientAdviceRows(
        { principal_id: session.principal_id, b_id_farm, calendar, timeframe },
        fields,
      ).map((promise) =>
        promise.then((row): AtlasNutrientAdviceRow => ({
          b_id: row.b_id,
          b_lu_name: row.mainCultivation?.b_lu_name ?? null,
          errorMessage: row.errorMessage,
          values: row.values,
        })),
      )
    }

    return {
      calendar,
      b_id_farm,
      fieldsData,
      rowPromises,
      nutrientsDescription: getNutrientsDescription(),
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Atlas layer "Bemestingsadvies": colours every field of the farm by its nutrient advice for the
 * selected nutrient (all in kg/ha). Hovering a field shows advice / applied / remaining for that
 * nutrient; clicking a field opens the full fertilization advice page of that field.
 */
export default function FarmAtlasNutrientAdviceBlock() {
  const { calendar, b_id_farm, fieldsData, rowPromises, nutrientsDescription } =
    useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const { capture } = useAnalytics()

  const fillLayerId = "fieldsNutrientAdvice"
  const outlineLayerId = "fieldsNutrientAdviceOutline"

  const nutrient = useSelectedAtlasNutrientAdviceStore((store) => store.nutrient)
  const mode = useSelectedAtlasNutrientAdviceStore((store) => store.mode)
  const setNutrient = useSelectedAtlasNutrientAdviceStore((store) => store.setNutrient)
  const setMode = useSelectedAtlasNutrientAdviceStore((store) => store.setMode)

  useEffect(() => {
    capture("atlas_viewed", { b_id_farm, calendar, layer: "nutrient_advice", nutrient, mode })
  }, [b_id_farm, calendar, nutrient, mode, capture])

  // The map source stays mounted while the advice streams in (Suspense would remove and re-add the
  // MapLibre source), and each field is coloured as soon as its advice arrives.
  const streamed = useStreamedRows(rowPromises)
  const loadFailed = streamed.failed
  // Re-runs the loader, which returns new `rowPromises` (shown as "loading" again).
  const revalidator = useRevalidator()
  const rows = useMemo(
    () => streamed.rows.filter((row): row is AtlasNutrientAdviceRow => row !== undefined),
    [streamed.rows],
  )
  const rowsById = useMemo(() => new Map(rows.map((row) => [row.b_id, row])), [rows])

  const nutrientDescription: NutrientDescription | undefined = nutrientsDescription.find(
    (item) => item.symbol === nutrient,
  )

  // Fields with `nav_class` / `nav_t` for the selected nutrient and mode.
  const shadedFields = useMemo(
    () =>
      fieldsData
        ? applyNutrientAdviceShading(fieldsData, rowsById, streamed.complete, nutrient, mode)
        : undefined,
    [fieldsData, rowsById, streamed.complete, nutrient, mode],
  )
  // `null` until the first field has arrived, so the legend shows its loading state.
  const scale = useMemo(
    () => (rows.length > 0 ? getNutrientAdviceScale(rows, nutrient) : null),
    [rows, nutrient],
  )
  const classCounts = useMemo(() => countNutrientAdviceClasses(shadedFields), [shadedFields])
  // Shown in the legend when no field has advice, e.g. when the advice service is unavailable.
  const noAdviceReason = rows.find((row) => row.errorMessage)?.errorMessage

  const initialViewState = getViewState(fieldsData)

  const [showFields, setShowFields] = useState(true)
  const layerLayout = { visibility: showFields ? "visible" : "none" } as const
  const fillLayer = { ...getNutrientAdviceFillStyle(), layout: layerLayout } as LayerProps
  // White dotted outline around every field; keep its round caps and add the visibility toggle.
  const outlineStyle = getNutrientAdviceOutlineStyle()
  const outlineLayer = {
    ...outlineStyle,
    layout: { ...outlineStyle.layout, ...layerLayout },
  } as LayerProps

  /** Opens the full fertilization advice page of the clicked field. */
  function onFieldClick(feature: MapGeoJSONFeature) {
    const b_id = feature.properties.b_id as string | undefined
    if (b_id) {
      void navigate(`/farm/${b_id_farm}/${calendar}/nutrient_advice/${b_id}`)
    }
  }

  // Nutrients grouped by type for the selector, in the order of `getNutrientsDescription()`.
  const nutrientGroups = (["primary", "secondary", "trace"] as const).map((type) => ({
    type,
    label: NUTRIENT_ADVICE_COPY.nutrientGroups[type],
    items: nutrientsDescription.filter((item) => item.type === type),
  }))

  return (
    <div className="relative">
      <Atlas
        initialViewState={initialViewState}
        interactive={true}
        interactiveLayerIds={[fillLayerId]}
      >
        <Controls
          showFlyToFields={fieldsData && fieldsData.features.length > 0}
          initialViewState={initialViewState}
          showFields={showFields}
          onToggleFields={() => setShowFields(!showFields)}
        />

        <MapTilerAttribution />

        {shadedFields && (
          <FieldsSourceNotClickable id={fillLayerId} fieldsData={shadedFields}>
            <Layer id={fillLayerId} {...fillLayer} />
            <Layer id={outlineLayerId} {...outlineLayer} />
          </FieldsSourceNotClickable>
        )}

        <AtlasTooltip
          layers={[fillLayerId]}
          onFeatureClicked={onFieldClick}
          render={({ features, mode: tooltipMode }) => {
            if (features.length === 0) return null
            const feature = features[0]
            const row = rowsById?.get(feature.properties.b_id as string)

            return (
              <>
                <AtlasTooltipHeader>
                  <p className="text-foreground font-semibold">{feature.properties.b_name}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {feature.properties.b_area != null &&
                      `${Number(feature.properties.b_area).toLocaleString("nl-NL")} ha`}
                    {row?.b_lu_name ? ` · ${row.b_lu_name}` : null}
                  </p>
                </AtlasTooltipHeader>
                {/* `block` overrides the default flex row of AtlasTooltipContent, so the body
                    uses the full width instead of sharing it with a second column. */}
                <AtlasTooltipContent className="block">
                  <NutrientAdviceTooltipBody
                    row={row}
                    // Per field: a field whose advice already arrived shows it, even while others
                    // are still loading or after a transport error.
                    isLoading={!row && !streamed.complete}
                    loadFailed={!row && loadFailed}
                    nutrient={nutrientDescription}
                  />
                </AtlasTooltipContent>
                {/* Footer separated by a line, mirroring the line under the header:
                    a hint on hover (desktop), a button in the touch popup (mobile). */}
                <AtlasTooltipFooter className="border-t pt-1.5">
                  {tooltipMode === "popup" ? (
                    <Button type="button" onClick={() => onFieldClick(feature)} className="grow">
                      {NUTRIENT_ADVICE_COPY.openAdvice}
                    </Button>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      {NUTRIENT_ADVICE_COPY.clickHint}
                    </p>
                  )}
                </AtlasTooltipFooter>
              </>
            )
          }}
        />
      </Atlas>

      {/* Nutrient selector + display mode (top left, like the soil parameter dropdown). On a phone it
          spans the width, leaving room for the map controls on the right; on touch screens the
          controls grow to a 40 px target. */}
      <Card className="absolute top-3 right-14 left-3 z-10 shadow-md md:right-auto md:w-72">
        <CardContent className="flex flex-col gap-2 p-2">
          <Select value={nutrient} onValueChange={setNutrient}>
            <SelectTrigger
              className="h-8 w-full text-xs pointer-coarse:h-10"
              aria-label="Kies een nutriënt"
            >
              {nutrientDescription
                ? `${nutrientDescription.name} (${nutrientDescription.symbol})`
                : null}
            </SelectTrigger>
            <SelectContent className="max-h-[min(var(--radix-select-content-available-height,100vh),calc(var(--radix-select-trigger-height,0)+100*var(--spacing)))]">
              {nutrientGroups.map((group) => (
                <SelectGroup key={group.type}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.items.map((item) => (
                    <SelectItem key={item.symbol} value={item.symbol}>
                      <div>
                        <div className="font-medium">
                          {item.name} ({item.symbol})
                        </div>
                        <div className="text-muted-foreground text-xs">{item.unit}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={mode}
            // Radix sends "" when the active item is clicked again; keep the current mode then.
            onValueChange={(value) => {
              if (isNutrientAdviceMode(value)) setMode(value)
            }}
            className="w-full"
            aria-label="Weergave"
          >
            {NUTRIENT_ADVICE_MODES.map((item) => (
              <ToggleGroupItem
                key={item}
                value={item}
                className="grow px-1.5 text-xs whitespace-nowrap pointer-coarse:h-10"
              >
                {NUTRIENT_ADVICE_COPY.modes[item]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {/* The legend title repeats the mode, so the hint gives way on a phone. */}
          <p className="text-muted-foreground hidden px-0.5 text-xs md:block">
            {NUTRIENT_ADVICE_COPY.modeHints[mode]}
          </p>
          {b_id_farm && b_id_farm !== "undefined" && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs pointer-coarse:h-10"
            >
              <NavLink to={`/farm/${b_id_farm}/${calendar}/nutrient_advice`}>
                <TableIcon className="h-3.5 w-3.5" />
                {NUTRIENT_ADVICE_COPY.openOverview}
              </NavLink>
            </Button>
          )}
          <p className="text-muted-foreground px-0.5 text-xs md:hidden">
            {NUTRIENT_ADVICE_COPY.desktopHint}
          </p>
        </CardContent>
      </Card>

      {/* Legend (bottom left) */}
      {nutrientDescription && rowPromises && (
        <div className="pointer-events-none absolute bottom-9 left-4">
          <NutrientAdviceLegend
            mode={mode}
            nutrientName={nutrientDescription.name}
            unit={nutrientDescription.unit}
            scale={scale}
            counts={classCounts}
            fieldCount={fieldsData?.features.length ?? 0}
            progress={{ settled: streamed.settled, total: streamed.total }}
            noAdviceReason={noAdviceReason}
            loadFailed={loadFailed}
            onRetry={() => void revalidator.revalidate()}
            isRetrying={revalidator.state === "loading"}
            excessExempt={nutrientDescription.symbol === "EOC"}
          />
        </div>
      )}
    </div>
  )
}

/** Legend label per applied-vs-advice class, reused in the tooltip. */
const STATUS_LABELS = {
  under: NUTRIENT_ADVICE_COPY.legendUnder,
  "on-target": NUTRIENT_ADVICE_COPY.legendMet,
  over: NUTRIENT_ADVICE_COPY.legendOver,
} as const

/**
 * Tooltip body for the hovered field: advice, already applied, percentage of the advice and the
 * remaining amount of the selected nutrient in kg/ha, plus the shared progress bar and the status
 * with the same swatch as on the map and in the legend. Shows the reason when there is no advice,
 * and "no need" when the advice is 0 and nothing was applied.
 */
function NutrientAdviceTooltipBody({
  row,
  isLoading,
  loadFailed,
  nutrient,
}: {
  row: AtlasNutrientAdviceRow | undefined
  isLoading: boolean
  loadFailed: boolean
  nutrient: NutrientDescription | undefined
}) {
  if (!nutrient) return null
  if (loadFailed) {
    return <p className="text-muted-foreground">{NUTRIENT_ADVICE_COPY.loadFailed}</p>
  }
  if (isLoading) {
    return <p className="text-muted-foreground">{NUTRIENT_ADVICE_COPY.loading}</p>
  }

  const value = row?.values[nutrient.symbol]
  if (!value) {
    return (
      <>
        <p className="text-muted-foreground">{nutrient.name}</p>
        <p>{row?.errorMessage ?? NUTRIENT_ADVICE_COPY.noAdvice}</p>
      </>
    )
  }

  const heading = (
    <p className="text-muted-foreground">
      {nutrient.name} ({nutrient.unit})
    </p>
  )

  // Same "no need" class as on the map: an advice of 0 with nothing applied is not "advice met".
  if (value.advice <= 0 && value.filling <= 0) {
    return (
      <div className="min-w-52 space-y-1.5">
        {heading}
        <p className="flex items-center gap-1.5 text-xs">
          <NutrientAdviceSwatch color={NUTRIENT_ADVICE_ZERO_COLOR} className="border" />
          {NUTRIENT_ADVICE_COPY.noNeed}
        </p>
      </div>
    )
  }

  const excessExempt = nutrient.symbol === "EOC"
  const remaining = value.advice - value.filling
  const { status } = computeAdviceProgress(value.filling, value.advice, excessExempt)
  const remainingLabel =
    remaining >= 0 ? NUTRIENT_ADVICE_COPY.remaining : NUTRIENT_ADVICE_COPY.surplus
  // A percentage of a zero advice is meaningless, so the row is left out then.
  const percentage = value.advice > 0 ? Math.round((value.filling / value.advice) * 100) : null

  return (
    // min-w keeps labels such as "Al gegeven" on one line.
    <div className="min-w-52 space-y-1.5">
      {heading}
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 whitespace-nowrap tabular-nums">
        <dt>{NUTRIENT_ADVICE_COPY.advice}</dt>
        <dd className="text-right">{formatKgPerHa(value.advice)}</dd>
        <dt>{NUTRIENT_ADVICE_COPY.applied}</dt>
        <dd className="text-right">{formatKgPerHa(value.filling)}</dd>
        {percentage !== null && (
          <>
            <dt>{NUTRIENT_ADVICE_COPY.percentageOfAdvice}</dt>
            <dd className="text-right">{percentage.toLocaleString("nl-NL")}%</dd>
          </>
        )}
        <dt className="font-medium">{remainingLabel}</dt>
        <dd className="text-right font-medium">{formatKgPerHa(Math.abs(remaining))}</dd>
      </dl>
      <AdviceProgressBar
        current={value.filling}
        target={value.advice}
        excessExempt={excessExempt}
      />
      {/* Same swatch + label as the field on the map and in the legend. */}
      <p className="flex items-center gap-1.5 text-xs">
        <NutrientAdviceSwatch {...NUTRIENT_ADVICE_STATUS_SWATCHES[status]} />
        {STATUS_LABELS[status]}
      </p>
    </div>
  )
}
