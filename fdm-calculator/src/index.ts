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
export type { CalcPhDeltaParams, SoiltypeAgr } from "./bcs/ph-delta"
export { calcPhDelta } from "./bcs/ph-delta"
export {
    collectInputForBln3Score,
    getBln3Score,
    requestBln3Score,
} from "./bln3"
export type {
    Bln3AggregationResult,
    Bln3IndicatorResult,
    Bln3Score,
    Bln3ScoreCollectedInputs,
    Bln3ScoreInputs,
} from "./bln3/types"
export { calculateDose } from "./doses/calculate-dose"
export type { Dose } from "./doses/d"
export { getDoseForField } from "./doses/get-dose-field"
export { NormNotApplicableError } from "./error"
export type {
    DataCompleteness,
    DynaComputeInput,
    DynaDailyPoint,
    DynaFertilizerAdvice,
    DynaNitrogenBalance,
    DynaResult,
    NSupplyComputeInput,
    NSupplyDataPoint,
    NSupplyMethod,
    NSupplyResult,
} from "./mineralization"
export {
    assessDataCompleteness,
    buildDynaRequest,
    buildNSupplyRequest,
    dynaResponseDataSchema,
    getDyna,
    getMainCultivation,
    getNSupply,
    methodRequirements,
    NmiApiError,
    requestDyna,
    requestNSupply,
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
export {
    aggregateNormFillingsToFarmLevel,
    aggregateNormsToFarmLevel,
} from "./norms/farm"
export {
    isFieldInGWGBGebied,
    isFieldInNatura2000Gebied,
} from "./norms/nl/2025/value/dierlijke-mest-gebruiksnorm"
export {
    getRegion,
    isFieldInNVGebied,
} from "./norms/nl/2025/value/stikstofgebruiksnorm"
export type { NL2025NormsInput } from "./norms/nl/2025/value/types"
export type {
    GebruiksnormResult,
    NormFilling,
} from "./norms/nl/types"
export {
    getNutrientAdvice,
    requestNutrientAdvice,
} from "./nutrient-advice"
export type {
    NutrientAdvice,
    NutrientAdviceInputs,
    NutrientAdviceResponse,
} from "./nutrient-advice/types"
export type { NlvSupplyBySomParams } from "./other/nlv-supply-by-som"
export { calculateNlvSupplyBySom } from "./other/nlv-supply-by-som"
export type { WaterSupplyBySomParams } from "./other/water-supply-by-som"
export { calculateWaterSupplyBySom } from "./other/water-supply-by-som"
export type { CultivationForHoofdteelt } from "./shared/hoofdteelt"
export {
    findHoofdteelt,
    GROENE_BRAAK,
} from "./shared/hoofdteelt"
