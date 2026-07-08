import type { Field } from "@nmi-agro/fdm-core"
import type { FeatureCollection, Geometry } from "geojson"
import type { StyleSpecification } from "maplibre-gl"
import type { ComponentType } from "react"
import type { CultivationHistory } from "~/components/blocks/atlas-fields/cultivation-history"
import type { BcsScores } from "~/components/blocks/soil-visual/bcs-color-utils"
import type { BcsPreviewResult } from "~/lib/bcs"
import type { CultivationSuggestionResult } from "~/lib/cultivation-suggestion.server"

export type AsyncTileResult<T> =
  | { status: "ready"; data: T }
  | { status: "empty"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }

export interface FieldDashboardMapFeatureProperties {
  b_id: string
  b_name: string | null
  b_area: number | null
}

export interface FieldDashboardMetric {
  label: string
  value: string
}

export interface FieldDashboardHarvestSummary {
  id: string
  date: string | null
  detailHref: string
  metrics: FieldDashboardMetric[]
}

export interface FieldDashboardCultivationSummary {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  detailHref: string
  b_lu_croprotation?: string | null
  b_lu_harvestable: "once" | "multiple" | "none"
  harvestTermPlural: string
  harvestDateTerm: string
  harvests: FieldDashboardHarvestSummary[]
}

export interface FieldDashboardCultivationHistoryEntry extends CultivationHistory {
  source: "fdm" | "nmi"
}

export interface FieldDashboardSoilParameterCard {
  parameter: string
  title: string
  description: string
  value: number | string | null
  label?: string
  unit: string
  type: "numeric" | "enum"
  date: string | null
  source: string | null
  sourceLabel: string
  link: string
}

export interface FieldDashboardBcsSummary extends BcsPreviewResult {
  scores: BcsScores
  measuredAt: string | null
}

export interface FieldDashboardMeasureSummary {
  b_id_measure: string
  m_name: string
  m_summary: string | null
  m_start: string | null
  m_end: string | null
}

export interface FieldDashboardNutrientAdviceSummary {
  items: Array<{
    label: string
    current: number
    target: number
    unit: string
  }>
}

export interface FieldDashboardNormSummary {
  items: Array<{
    label: string
    used: number
    limit: number
    unit: string
  }>
}

export interface FieldDashboardFertilizerAsyncSummary {
  advice: AsyncTileResult<FieldDashboardNutrientAdviceSummary>
  norms: AsyncTileResult<FieldDashboardNormSummary>
}

export interface FieldDashboardNitrogenBalanceSummary {
  balance: number
  target: number
  supply: number
  removal: number
  emissionAmmonia: number
  emissionNitrate: number
  unit: string
}

export interface FieldDashboardOrganicMatterBalanceSummary {
  balance: number
  supply: number
  degradation: number
  unit: string
}

export interface FieldDashboardBlnAggregationSummary {
  id: string
  label: string
  score: number | null
}

export interface FieldDashboardBlnSummary {
  score: number
  verdict: string
  attentionCount: number
  aggregations: FieldDashboardBlnAggregationSummary[]
}

export interface FieldDashboardFertilizerApplicationSummary {
  p_app_id: string
  p_name: string
  date: string | null
  amount: number | null
  unit: string
}

export interface FieldDashboardData {
  b_id: string
  b_id_farm: string
  calendar: string
  field: Field
  fieldWritePermission: boolean
  acquiringMethodOptions: Array<{ value: string; label: string }>
  mapStyle: string | StyleSpecification
  farmFieldsGeoJson: FeatureCollection<Geometry, FieldDashboardMapFeatureProperties>
  selectedFieldGeoJson: FeatureCollection<Geometry, FieldDashboardMapFeatureProperties>
  cultivation: {
    active: FieldDashboardCultivationSummary | null
    suggestionResult: CultivationSuggestionResult
  }
  fertilizer: {
    applicationCount: number
    lastApplicationDate: string | null
    applications: FieldDashboardFertilizerApplicationSummary[]
  }
  soil: {
    parameterCards: FieldDashboardSoilParameterCard[]
    analysisCount: number
    latestAnalysisDate: string | null
    measuredCount: number
    estimatedCount: number
    unknownCount: number
    bcs: FieldDashboardBcsSummary | null
  }
  measures: {
    items: FieldDashboardMeasureSummary[]
    activeCount: number
    ongoingCount: number
    endedCount: number
  }
  asyncInsights: {
    fertilizer: Promise<FieldDashboardFertilizerAsyncSummary>
    bln: Promise<AsyncTileResult<FieldDashboardBlnSummary>>
    cultivationHistory: Promise<AsyncTileResult<FieldDashboardCultivationHistoryEntry[]>>
    fieldCultivationColors: Promise<Record<string, string | null>>
    nitrogenBalance: Promise<AsyncTileResult<FieldDashboardNitrogenBalanceSummary>>
    organicMatterBalance: Promise<AsyncTileResult<FieldDashboardOrganicMatterBalanceSummary>>
  }
}

export type FieldDashboardSectionId =
  | "anchor"
  | "gewas"
  | "bemesting"
  | "balansen"
  | "bodem"
  | "bodemindicatoren"

export interface FieldDashboardTileProps {
  dashboard: FieldDashboardData
  tile: FieldDashboardTileDefinition
}

export interface FieldDashboardTileDefinition {
  id: string
  section: FieldDashboardSectionId
  title: string
  span: string
  detailHref: string
  dataKey: string
  Component: ComponentType<FieldDashboardTileProps>
}

export interface FieldDashboardSectionDefinition {
  id: FieldDashboardSectionId
  title: string
  gridClassName: string
  showHeading?: boolean
}
