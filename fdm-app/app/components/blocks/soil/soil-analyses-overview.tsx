import type { SoilAnalysis, SoilParameterDescription } from "@nmi-agro/fdm-core"
import type { MultiPolygon, Polygon } from "geojson"
import area from "@turf/area"
import { feature, featureCollection } from "@turf/helpers"
import intersect from "@turf/intersect"
import { lazy, Suspense, useState } from "react"
import { useNavigate, type useFetcher } from "react-router"
import type { MappedSoilAnalysis } from "./soil-analyses-map"
import { SoilAnalysesList } from "./list"
import { getSoilAnalysisColor } from "./soil-sampling-colors"
import { ZONE_EQUALS_FIELD_FRACTION } from "./soil-sampling-map-card"

// Lazy-loaded to avoid SSR issues with maplibre-gl and to keep it out of the initial bundle
const SoilAnalysesMap = lazy(() => import("./soil-analyses-map"))

/** Element id of the map, so that other parts of the page can scroll it into view. */
export const SOIL_ANALYSES_MAP_ID = "soil-analyses-map"

/**
 * The soil analyses of a field: a map that shows where each analysis was sampled, above the list of
 * analyses. Each analysis with a sampling zone or sample points gets its own colour in both.
 * Hovering or focusing an analysis on the map or in the list highlights it in the other; clicking
 * it on the map opens the analysis.
 *
 * A sampling zone that covers nearly the whole field is not drawn, because the analysis then
 * applies to the whole field. The map is only shown when at least one analysis has a zone to draw
 * or sample points.
 *
 * The highlight can be controlled by the parent through `highlightedIds` and `onHighlight`, for
 * example to highlight the analyses behind a value elsewhere on the page.
 */
export function SoilAnalysesOverview({
  soilAnalyses,
  soilParameterDescription,
  fetcher,
  canModifySoilAnalysis,
  fieldName,
  fieldGeometry,
  highlightedIds: controlledHighlightedIds,
  onHighlight: controlledOnHighlight,
}: {
  soilAnalyses: SoilAnalysis[]
  soilParameterDescription: SoilParameterDescription
  fetcher: ReturnType<typeof useFetcher>
  canModifySoilAnalysis?: Record<string, boolean>
  fieldName: string
  fieldGeometry: Polygon | MultiPolygon | null
  /** The analyses to highlight; when omitted, the component keeps its own highlight state. */
  highlightedIds?: string[]
  /** Called when an analysis is hovered or focused on the map or in the list. */
  onHighlight?: (a_ids: string[]) => void
}) {
  const navigate = useNavigate()
  const [ownHighlightedIds, setOwnHighlightedIds] = useState<string[]>([])
  const highlightedIds = controlledHighlightedIds ?? ownHighlightedIds
  const onHighlight = controlledOnHighlight ?? setOwnHighlightedIds

  // Share of the field covered by the zone of each analysis, with the zone clipped to the field
  // like in the soil data calculations; null when the analysis applies to the whole field
  const fieldArea = fieldGeometry ? area(fieldGeometry) : 0
  const coverageById: Record<string, number | null> = Object.fromEntries(
    soilAnalyses.map((analysis) => {
      const zone = analysis.b_sampling_geometry_zone
      if (!zone || !fieldGeometry || fieldArea <= 0) return [analysis.a_id, null]
      let clipped: ReturnType<typeof intersect> = null
      try {
        clipped = intersect(featureCollection([feature(fieldGeometry), feature(zone)]))
      } catch {
        // Invalid geometries: fall back to the unclipped zone
        clipped = feature(zone)
      }
      const fraction = clipped ? Math.min(1, area(clipped) / fieldArea) : 0
      return [analysis.a_id, fraction >= ZONE_EQUALS_FIELD_FRACTION ? null : fraction]
    }),
  )

  // Colours follow the order of the list (newest first); analyses with nothing to draw get none
  const mappedAnalyses: MappedSoilAnalysis[] = soilAnalyses
    .map((analysis) => ({
      a_id: analysis.a_id,
      zone: coverageById[analysis.a_id] !== null ? analysis.b_sampling_geometry_zone : null,
      points:
        (analysis.b_sampling_geometry?.coordinates.length ?? 0) > 0
          ? analysis.b_sampling_geometry
          : null,
    }))
    .filter((analysis) => analysis.zone || analysis.points)
    .map((analysis, index) => ({ ...analysis, color: getSoilAnalysisColor(index) }))
  const colorById = Object.fromEntries(
    mappedAnalyses.map((analysis) => [analysis.a_id, analysis.color]),
  )
  const hasZones = mappedAnalyses.some((analysis) => analysis.zone)
  const hasPoints = mappedAnalyses.some((analysis) => analysis.points)

  return (
    <div className="space-y-4">
      {mappedAnalyses.length > 0 && (
        <figure className="space-y-2" aria-labelledby={`${SOIL_ANALYSES_MAP_ID}-caption`}>
          <div id={SOIL_ANALYSES_MAP_ID} className="scroll-mt-4 overflow-hidden rounded-lg border">
            <Suspense fallback={<div className="bg-muted/40 h-[280px] animate-pulse" />}>
              <SoilAnalysesMap
                fieldGeometry={fieldGeometry}
                analyses={mappedAnalyses}
                highlightedIds={highlightedIds}
                onHighlight={onHighlight}
                onSelect={(a_id) => void navigate(`./analysis/${a_id}`)}
              />
            </Suspense>
          </div>
          <figcaption id={`${SOIL_ANALYSES_MAP_ID}-caption`} className="space-y-1.5">
            <p className="text-muted-foreground text-xs">
              Waar de bodemanalyses zijn bemonsterd. Elke kleur is één analyse uit de lijst
              hieronder.
            </p>
            <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-[#10b981]" aria-hidden />
                Perceelsgrens
              </li>
              {hasZones && (
                <li className="flex items-center gap-1.5">
                  <span
                    className="bg-muted-foreground/20 border-muted-foreground inline-block h-3 w-4 rounded-[2px] border"
                    aria-hidden
                  />
                  Bemonsterde zone
                </li>
              )}
              {hasPoints && (
                <li className="flex items-center gap-1.5">
                  <span
                    className="bg-muted-foreground inline-block size-2 rounded-full ring-1 ring-white"
                    aria-hidden
                  />
                  Monsterpunten
                </li>
              )}
            </ul>
          </figcaption>
        </figure>
      )}
      <SoilAnalysesList
        soilAnalyses={soilAnalyses}
        soilParameterDescription={soilParameterDescription}
        fetcher={fetcher}
        canModifySoilAnalysis={canModifySoilAnalysis}
        fieldName={fieldName}
        colorById={colorById}
        coverageById={coverageById}
        highlightedIds={highlightedIds}
        onHighlight={onHighlight}
      />
    </div>
  )
}
