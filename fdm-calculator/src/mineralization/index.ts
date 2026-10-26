/**
 * @packageDocumentation
 * @module mineralization
 *
 * Nitrogen mineralization for the FDM platform, based on the NMI Dyna v2 model.
 *
 * Dyna simulates the nitrogen dynamics of a field day by day: nitrogen that becomes available from
 * soil, fertilizers and crop residues, uptake by the crop and nitrate leaching. It uses measured
 * weather up to today, the weather forecast for the coming days and long-term climate data after.
 *
 * ## Typical usage
 * 1. Fetch the field, soil, cultivations, harvests and fertilizer applications from FDM.
 * 2. Prepare the request with {@link prepareMineralizationInput}; it also tells when a field is
 *    excluded or misses a harvest.
 * 3. Run the cached calculation with {@link getDynaV2} and optionally {@link getWeatherForecast}.
 * 4. Interpret the result with {@link deriveMineralizationInsights}.
 * 5. Explore changes with {@link applyScenarioToRequest} and save them using {@link diffScenario}.
 */

export { NmiApiError } from "./errors"
export { getDynaV2, requestDynaV2 } from "./dyna-v2"
export type {
  MineralizationInsights,
  MineralizationKpis,
  MineralizationSignal,
  SeasonPhase,
} from "./insights"
export {
  deriveMineralizationInsights,
  determineSeasonPhase,
  MINERALIZATION_THRESHOLDS,
} from "./insights"
export type {
  MineralizationApplication,
  MineralizationCultivation,
  MineralizationEvent,
  MineralizationFertilizer,
  MineralizationFieldData,
  MineralizationHarvest,
  MineralizationPreparation,
  MineralizationSoilItem,
  MineralizationUsedInput,
} from "./prepare"
export {
  DYNA_V2_MAX_HARVESTS_PER_CULTIVATION,
  DYNA_V2_SOIL_PARAMETERS,
  getMainCultivation,
  mapApplicationMethod,
  prepareMineralizationInput,
  restrictToMainCultivation,
} from "./prepare"
export type {
  MineralizationScenario,
  ScenarioDiff,
  ScenarioFertilizer,
  ScenarioFertilizerApplication,
} from "./scenario"
export { applyScenarioToRequest, diffScenario, getMineralizationScenarioSchema } from "./scenario"
export type { WeatherForecast, WeatherForecastDay, WeatherForecastInput } from "./weather"
export { getWeatherForecast, requestWeatherForecast, roundCoordinate } from "./weather"
export { dynaV2ResponseDataSchema } from "./schemas"
export type {
  DynaV2ApplicationMethod,
  DynaV2ComputeInput,
  DynaV2DailyPoint,
  DynaV2NitrogenBalance,
  DynaV2Request,
  DynaV2Result,
} from "./types"
