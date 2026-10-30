import type { SoilAnalysis, SoilParameterDescription } from "@nmi-agro/fdm-core"
import type { MultiPolygon, Polygon } from "geojson"
import { lazy, Suspense, useState } from "react"
import { useNavigate, type useFetcher } from "react-router"
import type { MappedSoilAnalysis } from "./soil-analyses-map"
import { SoilAnalysesList } from "./list"
import { getSoilAnalysisColor } from "./soil-sampling-colors"

// Lazy-loaded to avoid SSR issues with maplibre-gl and to keep it out of the initial bundle
const SoilAnalysesMap = lazy(() => import("./soil-analyses-map"))

/**
 * The soil analyses of a field: a map that shows where each analysis was sampled, above the list of
 * analyses. Each analysis with a sampling zone or sample points gets its own colour in both.
 * Hovering an analysis on the map or in the list highlights it in the other; clicking it on the
 * map opens the analysis.
 *
 * The map is only shown when at least one analysis has sampling geometries.
 */
export function SoilAnalysesOverview({
  soilAnalyses,
  soilParameterDescription,
  fetcher,
  canModifySoilAnalysis,
  fieldName,
  fieldGeometry,
}: {
  soilAnalyses: SoilAnalysis[]
  soilParameterDescription: SoilParameterDescription
  fetcher: ReturnType<typeof useFetcher>
  canModifySoilAnalysis?: Record<string, boolean>
  fieldName: string
  fieldGeometry: Polygon | MultiPolygon | null
}) {
  const navigate = useNavigate()
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  // Colours follow the order of the list (newest first); analyses without geometry get none
  const mappedAnalyses: MappedSoilAnalysis[] = soilAnalyses
    .filter((analysis) => analysis.b_sampling_geometry_zone || analysis.b_sampling_geometry)
    .map((analysis, index) => ({
      a_id: analysis.a_id,
      color: getSoilAnalysisColor(index),
      zone: analysis.b_sampling_geometry_zone,
      points: analysis.b_sampling_geometry,
    }))
  const colorById = Object.fromEntries(
    mappedAnalyses.map((analysis) => [analysis.a_id, analysis.color]),
  )
  const withoutLocation = soilAnalyses.length - mappedAnalyses.length

  return (
    <div className="space-y-4">
      {mappedAnalyses.length > 0 && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border">
            <Suspense fallback={<div className="bg-muted/40 h-[280px] animate-pulse" />}>
              <SoilAnalysesMap
                fieldGeometry={fieldGeometry}
                analyses={mappedAnalyses}
                highlightedId={highlightedId}
                onHighlight={setHighlightedId}
                onSelect={(a_id) => void navigate(`./analysis/${a_id}`)}
              />
            </Suspense>
          </div>
          <p className="text-muted-foreground text-xs">
            Elke kleur is een bodemanalyse: het vlak is de bemonsterde zone, de punten zijn de
            monsterpunten.
            {withoutLocation > 0 &&
              ` ${withoutLocation === 1 ? "Eén analyse heeft" : `${withoutLocation} analyses hebben`} geen locatie en ${withoutLocation === 1 ? "geldt" : "gelden"} voor het hele perceel.`}
          </p>
        </div>
      )}
      <SoilAnalysesList
        soilAnalyses={soilAnalyses}
        soilParameterDescription={soilParameterDescription}
        fetcher={fetcher}
        canModifySoilAnalysis={canModifySoilAnalysis}
        fieldName={fieldName}
        colorById={colorById}
        highlightedId={highlightedId}
        onHighlight={setHighlightedId}
      />
    </div>
  )
}
