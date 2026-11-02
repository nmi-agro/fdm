import type { MultiPoint, MultiPolygon, Polygon } from "geojson"
import area from "@turf/area"
import { lazy, Suspense } from "react"
import { SAMPLING_POINT_COLOR, SAMPLING_ZONE_COLOR } from "./soil-sampling-colors"

// Lazy-loaded to avoid SSR issues with maplibre-gl and to keep it out of the initial bundle
const SoilSamplingMap = lazy(() => import("./soil-sampling-map"))

/**
 * Share of the field area above which a sampling zone is treated as the whole field and not drawn.
 */
export const ZONE_EQUALS_FIELD_FRACTION = 0.9

/**
 * Shows where a soil analysis was sampled: the field boundary, the sampling zone (when it differs
 * from the field) and the locations of the subsamples. Without sampling geometries only the field
 * boundary is shown.
 */
export function SoilSamplingMapCard({
  fieldGeometry,
  samplingZone,
  samplingPoints,
}: {
  fieldGeometry: Polygon | MultiPolygon | null
  samplingZone: Polygon | MultiPolygon | null | undefined
  samplingPoints: MultiPoint | null | undefined
}) {
  const fieldArea = fieldGeometry ? area(fieldGeometry) : 0
  const zoneArea = samplingZone ? area(samplingZone) : 0
  // The zone is clipped to the field for the calculations; drawing it is only useful when it
  // represents a clearly smaller part of the field.
  const showZone =
    samplingZone && !(fieldArea > 0 && zoneArea / fieldArea >= ZONE_EQUALS_FIELD_FRACTION)
  const hasPoints = (samplingPoints?.coordinates.length ?? 0) > 0

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium">Bemonstering</h4>
        <p className="text-muted-foreground text-sm">
          {showZone
            ? "Deze analyse geldt voor een zone binnen het perceel."
            : samplingZone
              ? "Deze analyse geldt voor het hele perceel."
              : hasPoints
                ? "Voor deze analyse is geen zone bekend; de analyse geldt voor het hele perceel."
                : "Voor deze analyse is geen bemonsteringslocatie bekend."}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Suspense fallback={<div className="bg-muted/40 h-80 animate-pulse" />}>
          <SoilSamplingMap
            fieldGeometry={fieldGeometry}
            samplingZone={showZone ? samplingZone : null}
            samplingPoints={samplingPoints ?? null}
          />
        </Suspense>
      </div>
      <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#10b981]" aria-hidden />
          Perceelsgrens
        </li>
        {showZone && (
          <li className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-4 border border-dashed"
              style={{
                backgroundColor: `${SAMPLING_ZONE_COLOR}40`,
                borderColor: SAMPLING_ZONE_COLOR,
              }}
              aria-hidden
            />
            Bemonsterde zone
          </li>
        )}
        {hasPoints && (
          <li className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-white"
              style={{ backgroundColor: SAMPLING_POINT_COLOR }}
              aria-hidden
            />
            Monsterpunten
          </li>
        )}
      </ul>
    </div>
  )
}
