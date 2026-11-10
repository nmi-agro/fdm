import pkg from "./package"
export const fdmCalculator = pkg
export {
  calculateNitrogenBalance,
  calculateNitrogenBalanceField,
  calculateNitrogenBalanceForFarms,
  calculateNitrogenBalancesFieldToFarm,
  getNitrogenBalanceField,
} from "./balance/nitrogen/index"
export {
  collectInputForNitrogenBalance,
  collectInputForNitrogenBalanceForFarms,
} from "./balance/nitrogen/input"
export type {
  FieldInput,
  NitrogenBalanceFieldInput,
  NitrogenBalanceFieldNumeric,
  NitrogenBalanceFieldResultNumeric,
  NitrogenBalanceInput,
  NitrogenBalanceNumeric,
  NitrogenEmissionAmmoniaFertilizersNumeric,
  NitrogenEmissionAmmoniaNumeric,
  NitrogenEmissionAmmoniaResiduesNumeric,
  NitrogenEmissionNumeric,
  NitrogenRemovalHarvestsNumeric,
  NitrogenRemovalNumeric,
  NitrogenRemovalResiduesNumeric,
  NitrogenSupplyFertilizersNumeric,
  NitrogenSupplyFixationNumeric,
  NitrogenSupplyMineralizationNumeric,
  NitrogenSupplyNumeric,
} from "./balance/nitrogen/types"
export {
  calculateOrganicMatterBalance,
  calculateOrganicMatterBalanceField,
  calculateOrganicMatterBalanceForFarms,
  calculateOrganicMatterBalancesFieldToFarm,
  getOrganicMatterBalanceField,
} from "./balance/organic-matter/index"
export {
  collectInputForOrganicMatterBalance,
  collectInputForOrganicMatterBalanceForFarms,
} from "./balance/organic-matter/input"
export type {
  OrganicMatterBalanceFieldNumeric,
  OrganicMatterBalanceFieldResultNumeric,
  OrganicMatterBalanceInput,
  OrganicMatterBalanceNumeric,
  OrganicMatterDegradationNumeric,
  OrganicMatterSupplyCultivationsNumeric,
  OrganicMatterSupplyFertilizersNumeric,
  OrganicMatterSupplyNumeric,
  OrganicMatterSupplyResiduesNumeric,
} from "./balance/organic-matter/types"
export { currentSoilDataToSoilAnalyses } from "./balance/shared/soil"
export type { BalanceSoilAnalysis } from "./balance/shared/soil"
export type { CropPlanFractions, CultivationForCropPlan } from "./bcs/crop-plan"
export { deriveCropPlanFractions } from "./bcs/crop-plan"
export type {
  BcsIndicatorKey,
  BcsLabContext,
  BcsRawSoilData,
  BcsResult,
  BcsScores,
  OmCropCategory,
  OmSoiltypeN,
} from "./bcs/index"
export {
  BCS_INDICATORS,
  calculateBcs,
  deriveBcsLabContext,
  deriveOmBcs,
  derivePhBcs,
  getBcsScoreColor,
  getBcsScoreLabel,
} from "./bcs/index"
export type { BcsAnalysisLike, BcsVisualKey } from "./bcs/visual"
export { BCS_VISUAL_KEYS, isBcsAnalysis } from "./bcs/visual"
export type { CalcPhDeltaParams, SoiltypeAgr } from "./bcs/ph-delta"
export { calcPhDelta } from "./bcs/ph-delta"
export type { FarmIndicators, FieldIndicators, FieldMeasureOptions } from "./bln3"
export {
  getFarmIndicators,
  getFieldIndicators,
  getFieldMeasureOptions,
  getYearTimeframe,
  collectInputForBln3MeasureApplicability,
  collectInputForBln3Score,
  getBln3MeasureAdvice,
  getBln3MeasureApplicability,
  getBln3Score,
  requestBln3MeasureAdvice,
  requestBln3MeasureApplicability,
  requestBln3Score,
} from "./bln3"
export type {
  Bln3AggregationResult,
  Bln3IndicatorAdvice,
  Bln3IndicatorMeasureAdvice,
  Bln3IndicatorResult,
  Bln3MeasureAdviceInputs,
  Bln3MeasureAdviceResult,
  Bln3MeasureApplicabilityCollectedInputs,
  Bln3MeasureApplicabilityInputs,
  Bln3MeasureApplicabilityItem,
  Bln3MeasureApplicabilityResult,
  Bln3MeasureApplicabilityStatus,
  Bln3Score,
  Bln3ScoreCollectedInputs,
  Bln3ScoreInputs,
} from "./bln3/types"
export { IndicatorsUnavailableError } from "./bln3/errors"
export * from "./bln3/postprocessing"
export { getNitrogenBalanceForFarms, getOrganicMatterBalanceForFarms } from "./balance/farms"
export { combineFarmMeasureSummaries, getFarmMeasureSummary } from "./bln3/farm-measures"
export type {
  CombinedMeasureSummary,
  CombinedMeasureSummaryItem,
  FarmMainCultivationArea,
  FarmMeasureSummary,
  FarmMeasureSummaryItem,
} from "./bln3/farm-measures"
export type { FarmBalanceResult, MultiFarmBalance } from "./balance/farms"
export { calculateDose } from "./doses/calculate-dose"
export type { Dose } from "./doses/d"
export { getDoseForField } from "./doses/get-dose-field"
export { NormNotApplicableError } from "./error"
export type {
  DynaV2ApplicationMethod,
  DynaV2ComputeInput,
  DynaV2DailyPoint,
  DynaV2NitrogenBalance,
  DynaV2Request,
  DynaV2Result,
  HarvestParameterValues,
  MineralizationApplication,
  MineralizationCultivation,
  MineralizationEvent,
  MineralizationFertilizer,
  MineralizationFieldData,
  MineralizationHarvest,
  MineralizationInsights,
  MineralizationKpis,
  MineralizationPreparation,
  MineralizationScenario,
  MineralizationSignal,
  MineralizationSoilItem,
  MineralizationUsedInput,
  ScenarioDiff,
  ScenarioFertilizer,
  ScenarioFertilizerApplication,
  ScenarioHarvest,
  SeasonPhase,
  WeatherForecast,
  WeatherForecastDay,
  WeatherForecastInput,
} from "./mineralization"
export {
  getMainCultivation,
  NmiApiError,
  applyScenarioToRequest,
  deriveMineralizationInsights,
  determineSeasonPhase,
  diffScenario,
  DYNA_V2_MIN_DAYS_BETWEEN_HARVESTS,
  DYNA_V2_SOIL_PARAMETERS,
  getDynaV2,
  getMineralizationScenarioSchema,
  getWeatherForecast,
  HARVEST_PARAMETER_KEYS,
  isSameHarvestParameters,
  MINERALIZATION_THRESHOLDS,
  mapApplicationMethod,
  prepareMineralizationInput,
  requestDynaV2,
  requestWeatherForecast,
  restrictToMainCultivation,
  roundCoordinate,
} from "./mineralization"
export {
  createFunctionsForFertilizerApplicationFilling,
  createFunctionsForNorms,
  createUncachedFunctionsForFertilizerApplicationFilling,
} from "./norms"
export type {
  AggregatedNormFillingsToFarmLevel,
  AggregatedNormsToFarmLevel,
  InputAggregateNormFillingsToFarmLevel,
  InputAggregateNormsToFarmLevel,
} from "./norms/farm"
export { aggregateNormFillingsToFarmLevel, aggregateNormsToFarmLevel } from "./norms/farm"
export type {
  FertilizerApplicationFillingInputByYear,
  FertilizerApplicationFillings,
} from "./norms/filling"
export { calculateFertilizerApplicationFillingsWithRegion } from "./norms/filling"
export {
  isFieldInGWGBGebied,
  isFieldInNatura2000Gebied,
} from "./norms/nl/2025/value/dierlijke-mest-gebruiksnorm"
export { getRegion, isFieldInNVGebied } from "./norms/nl/2025/value/stikstofgebruiksnorm"
export type { NL2025NormsInput, RegionKey } from "./norms/nl/2025/value/types"
export type { GebruiksnormResult, NormFilling } from "./norms/nl/types"
export { getNutrientAdvice, requestNutrientAdvice } from "./nutrient-advice"
export {
  FARM_NUTRIENT_ADVICE_NUTRIENTS,
  findMainCultivation,
  getFarmNutrientAdviceRows,
  NUTRIENT_ADVICE_CONCURRENCY,
  startFarmNutrientAdviceRows,
} from "./nutrient-advice/farm"
export type {
  FarmNutrientAdviceErrorCode,
  FarmNutrientAdviceField,
  FarmNutrientAdviceInput,
  FarmNutrientAdviceRow,
  FarmNutrientAdviceValue,
  FarmNutrientSymbol,
} from "./nutrient-advice/farm"
export {
  getCultivationSuggestion,
  getCultivationSuggestionResult,
} from "./other/cultivation-suggestion"
export type {
  CultivationSuggestion,
  CultivationSuggestionResult,
} from "./other/cultivation-suggestion"
export type {
  AggregatedNutrientAdvice,
  InputAggregateNutrientAdviceToFarmLevel,
  NutrientAdviceAggregationMode,
  NutrientDoseAndAdvice,
} from "./nutrient-advice/aggregate"
export { aggregateNutrientAdviceToFarmLevel } from "./nutrient-advice/aggregate"
export type {
  NutrientAdvice,
  NutrientAdviceCut,
  NutrientAdviceInputs,
  NutrientAdviceResponse,
} from "./nutrient-advice/types"
export { collectInputForSoilParameterEstimates } from "./estimates/input"
export { getSoilParameterEstimates, requestSoilParameterEstimates } from "./estimates/index"
export {
  addSoilParameterEstimatesToField,
  getGeometryCentroid,
  getSoilParameterEstimatesForGeometry,
} from "./estimates/field"
export type { SoilParameterEstimatesInput, SoilParameterEstimatesResponse } from "./estimates/types"
export { bln3Client, soilEstimatesClient, soilReaderClient } from "./nmi/client"
export {
  extractSoilAnalysesFromPdfs,
  parseSamplingGeometry,
  parseSoilReaderField,
  SoilReaderError,
} from "./soilreader"
export type { ExtractedSoilAnalysis } from "./soilreader"
export { matchSoilAnalysisToField } from "./soilreader/match"
export type {
  SoilAnalysisFieldMatch,
  SoilAnalysisMatchField,
  SoilAnalysisMatchReason,
} from "./soilreader/match"
export type { NlvParams, NlvSupplyBySomParams } from "./other/nlv-supply"
export { calculateNlv, calculateNlvSupplyIncreaseBySomPotential } from "./other/nlv-supply"
export { enrichCurrentSoilDataWithNlv } from "./other/current-soil-data"
export type { WaterSupplyBySomParams } from "./other/water-supply-by-som"
export { calculateWaterSupplyBySom } from "./other/water-supply-by-som"
export type { CompleteHoofdteeltCultivation, CultivationForHoofdteelt } from "./shared/hoofdteelt"
export { findHoofdteelt, GROENE_BRAAK } from "./shared/hoofdteelt"
export type { FieldExclusionReason } from "./shared/field-exclusion"
export { getFieldExclusionReason, LANDSCAPE_ELEMENT_BRP_CODES } from "./shared/field-exclusion"
