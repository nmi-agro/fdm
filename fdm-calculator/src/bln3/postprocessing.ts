/**
 * Pure indicator post-processing helpers (no database or network access), shared by the
 * REST API and the web application.
 */
export { EXCLUDED_BLN3_BRP_CODES, isExcludedFromBln3 } from "./exclusion"
export type {
  ActiveMeasure,
  FieldVariantImpact,
  IndicatorImpact,
  FieldTopOpportunity,
  MeasureApplicabilityInfo,
  MeasureCatalogueEntry,
  MeasureOption,
  MeasureOptionApplicability,
  MeasureRecommendation,
} from "./recommendations"
export {
  buildMeasureOptions,
  buildPredictedImpacts,
  getBestVariantIds,
  getFarmBestVariantIds,
  getFieldOpportunityCandidates,
  getMeasureFamilyId,
  getTopOpportunitiesForField,
  MAX_RECOMMENDED_MEASURES,
} from "./recommendations"
export type { FarmScores, FieldScoreWithArea, ScoreTier } from "./scoring"
export {
  aggregateFarmScores,
  computeAreaWeightedAggregation,
  getFieldAggregationScore,
  getScoreTier,
  scoreToDisplay,
} from "./scoring"
