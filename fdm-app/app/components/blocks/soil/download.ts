import { SoilAnalysis } from "@nmi-agro/fdm-core"

export function getSoilAnalysisDownloadName(analysis: {
  a_id: SoilAnalysis["a_id"]
  a_source?: SoilAnalysis["a_source"]
  b_sampling_date: SoilAnalysis["b_sampling_date"]
}): string {
  return `soil-analysis-${analysis.a_id}-${analysis.a_source ?? ""}-${analysis.b_sampling_date?.toISOString().split("T")[0]}.pdf`
}
