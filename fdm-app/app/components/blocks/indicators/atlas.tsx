/**
 * Lazy-loaded map component for the farm indicators overview page.
 * Shows farm fields coloured by their average BLN3 score.
 * Clicking a field navigates to its detail page.
 *
 * Import with React.lazy to avoid SSR issues with maplibre-gl.
 */

import type { FeatureCollection, GeoJsonProperties } from "geojson"
import type { MapGeoJSONFeature, StyleSpecification } from "maplibre-gl"
import { LayoutList } from "lucide-react"
import { type Dispatch, type SetStateAction, useMemo, useRef } from "react"
import { Layer, type MapRef } from "react-map-gl/maplibre"
import { Link, useNavigate } from "react-router"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { ScoreLegend } from "~/components/blocks/atlas/atlas-legend"
import { FieldsPanelZoomWarning } from "~/components/blocks/atlas/atlas-panels"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import {
  getFieldsScoreOutlineStyle,
  getFieldsScoreStyle,
} from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { Bln3BetaBanner } from "~/components/blocks/indicators/bln3-beta-banner"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { INDICATORS } from "~/lib/indicators"
import { AtlasTooltip, AtlasTooltipFooter, AtlasTooltipHeader } from "../atlas/atlas-tooltip"
import { ScoreTooltipBody } from "./score-tooltip-body"

type ChildScoreEntry = {
  id: string
  label: string
  score: number | null
}

type IndicatorsMapProps = {
  fieldsGeoJSON: FeatureCollection
  mapStyle: string | StyleSpecification
  /** GeoJSON property name to colour fields by. Defaults to "avgScore". */
  selectedProperty?: string
  /** Human-readable label shown in the map legend. */
  label?: string
  height?: string
  /** Child aggregation/indicator entries to show in hover tooltip (one level below selected). */
  childEntries?: ChildScoreEntry[]
} & (
  | { basePath: string; basePathFormatter?: undefined }
  | {
      basePath?: undefined
      basePathFormatter: (props: GeoJsonProperties | undefined) => string
    }
)

const SCORE_LAYER = "indicatorsScore"
const OUTLINE_LAYER = "indicatorsScoreOutline"
const SOURCE_ID = "indicatorsFields"

export default function IndicatorsMap({
  fieldsGeoJSON,
  basePath,
  basePathFormatter,
  selectedProperty = "avgScore",
  label,
  height = "380px",
  childEntries,
}: IndicatorsMapProps) {
  const navigate = useNavigate()
  const mapRef = useRef<MapRef>(null)
  const initialViewState = getViewState(fieldsGeoJSON)

  // Recompute paint expressions only when the active property changes
  const scoreStyle = useMemo(
    () => getFieldsScoreStyle(SCORE_LAYER, selectedProperty),
    [selectedProperty],
  )
  const outlineStyle = useMemo(
    () => getFieldsScoreOutlineStyle(OUTLINE_LAYER, selectedProperty),
    [selectedProperty],
  )

  const onFeatureClicked = (feature: MapGeoJSONFeature) => {
    if (basePathFormatter) {
      const formatted = basePathFormatter(feature.properties)
      if (typeof formatted === "string") {
        void navigate(formatted)
      }
      return
    }
    const b_id = feature.properties.b_id
    if (!b_id) return
    void navigate(`${basePath}/${b_id}`)
  }

  return (
    <div className="relative" style={{ height }}>
      <Atlas
        ref={mapRef}
        initialViewState={initialViewState}
        interactive={true}
        interactiveLayerIds={[SCORE_LAYER]}
      >
        <Controls
          initialViewState={initialViewState}
          showFlyToFields={fieldsGeoJSON.features.length > 0 ? true : undefined}
        />
        <MapTilerAttribution />
        <FieldsSourceNotClickable id={SOURCE_ID} fieldsData={fieldsGeoJSON}>
          <Layer {...(scoreStyle as any)} id={SCORE_LAYER} source={SOURCE_ID} />
          <Layer {...(outlineStyle as any)} id={OUTLINE_LAYER} source={SOURCE_ID} />
        </FieldsSourceNotClickable>

        {/* Hover tooltip */}
        <AtlasTooltip
          layers={[SCORE_LAYER]}
          onFeatureClicked={onFeatureClicked}
          render={({ features, mode }) => {
            if (features.length === 0) return null
            const feature = features[0]

            // Current hover score (reactive to selectedProperty changes)
            const hoverScore =
              typeof feature.properties[selectedProperty] === "number" &&
              (feature.properties[selectedProperty] as number) >= 0
                ? (feature.properties[selectedProperty] as number)
                : null
            return (
              <div className="space-y-1.5">
                <AtlasTooltipHeader>
                  <div className="flex items-start justify-between gap-1.5">
                    <p className="text-foreground font-semibold">
                      {(feature.properties?.b_name as string) ??
                        (feature.properties?.b_id as string) ??
                        "Onbekend perceel"}
                    </p>
                    {Boolean(
                      feature.properties?.b_bufferstrip || feature.properties?.isBufferstrip,
                    ) && (
                      <span className="shrink-0 rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                        Bufferstrook
                      </span>
                    )}
                    {!feature.properties?.b_bufferstrip &&
                      !feature.properties?.isBufferstrip &&
                      Boolean(feature.properties?.isNature) && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Natuurperceel
                        </span>
                      )}
                  </div>
                  {feature.properties.b_area != null && (
                    <p className="text-muted-foreground mt-0.5">
                      {Number(feature.properties.b_area).toFixed(2)} ha
                    </p>
                  )}
                  {feature.properties.b_name_farm != null && (
                    <p className="text-muted-foreground mt-0.5">{feature.properties.b_name_farm}</p>
                  )}
                </AtlasTooltipHeader>
                {feature.properties?.b_bufferstrip ||
                feature.properties?.isBufferstrip ||
                feature.properties?.isNature ? (
                  <div className="mt-1.5 border-t pt-1.5">
                    <p className="text-muted-foreground italic">
                      {feature.properties.b_bufferstrip || feature.properties.isBufferstrip
                        ? "Geen indicatoren beschikbaar (bufferstrook)"
                        : "Geen indicatoren beschikbaar (natuurperceel)"}
                    </p>
                  </div>
                ) : (
                  <ScoreTooltipBody
                    score={hoverScore}
                    label={label}
                    childScores={childEntries?.map((child) => ({
                      id: child.id,
                      label: child.label,
                      score:
                        typeof feature.properties[child.id] === "number" &&
                        (feature.properties[child.id] as number) >= 0
                          ? (feature.properties[child.id] as number)
                          : null,
                    }))}
                  />
                )}
                {mode === "popup" && (
                  <AtlasTooltipFooter>
                    <Button
                      type="button"
                      className="grow"
                      onClick={() => onFeatureClicked(feature)}
                    >
                      Meer details
                    </Button>
                  </AtlasTooltipFooter>
                )}
              </div>
            )
          }}
        />
      </Atlas>

      {/* Legend overlay — pointer-events-none so it doesn't block field clicks */}
      <div className="absolute bottom-6 left-2 z-10">
        <ScoreLegend label={label} />
        {fieldsGeoJSON.features.length > 0 && <FieldsPanelZoomWarning />}
      </div>
    </div>
  )
}

export function ScoreSelect({
  selectedProperty,
  setSelectedProperty,
  detailPath,
}: {
  selectedProperty: string
  setSelectedProperty: Dispatch<SetStateAction<string>>
  detailPath: string
}) {
  {
    /* Floating indicator selector + info banner */
  }
  return (
    <Card className="absolute top-3 left-3 z-10 w-64 shadow-md">
      <CardContent className="space-y-2 p-2">
        <div className="flex items-center gap-2">
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[380px] overflow-y-auto">
              <SelectItem value="avgScore">Gemiddelde score</SelectItem>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-muted-foreground text-xs">Hoofdthema's</SelectLabel>
                <SelectItem value="S_BLN">BLN</SelectItem>
                <SelectItem value="S_BBWP">BedrijfsBodemWaterPlan (BBWP)</SelectItem>
                <SelectItem value="S_WAT_BLN">Water</SelectItem>
                <SelectItem value="S_NUT_BLN">Nutriëntenkringloop</SelectItem>
                <SelectItem value="S_CLIM_BLN">Klimaat</SelectItem>
                <SelectItem value="S_PROD_BLN">Productie (OBI)</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-muted-foreground text-xs">Waterthema's</SelectLabel>
                <SelectItem value="S_GW_QUANT_BLN">Grondwaterkwantiteit</SelectItem>
                <SelectItem value="S_GW_QUAL_BLN">Grondwaterkwaliteit</SelectItem>
                <SelectItem value="S_SW_QUAL_BLN">Oppervlaktewaterkwaliteit</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-muted-foreground text-xs">
                  Productiethema's
                </SelectLabel>
                <SelectItem value="S_PROD_BIOL_BLN">Biologische bodemkwaliteit</SelectItem>
                <SelectItem value="S_PROD_CHEM_BLN">Chemische bodemkwaliteit</SelectItem>
                <SelectItem value="S_PROD_PHYS_BLN">Fysische bodemkwaliteit</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-muted-foreground text-xs">
                  Water indicatoren
                </SelectLabel>
                {INDICATORS.filter((i) => i.ecosysteemdienst === "Water").map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-muted-foreground text-xs">
                  Nutriënten & klimaat indicatoren
                </SelectLabel>
                {INDICATORS.filter((i) =>
                  ["Nutriëntenkringloop", "Klimaat"].includes(i.ecosysteemdienst),
                ).map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-muted-foreground text-xs">
                  Productie (OBI) indicatoren
                </SelectLabel>
                {INDICATORS.filter((i) => i.ecosysteemdienst === "Productie").map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            asChild
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Tabelweergave"
          >
            <Link to={detailPath}>
              <LayoutList className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <Bln3BetaBanner />
      </CardContent>
    </Card>
  )
}
