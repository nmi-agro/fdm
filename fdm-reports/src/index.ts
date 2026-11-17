/**
 * Reports for the Farm Data Model (FDM), such as the yearly fertilizer plan (bemestingsplan).
 *
 * @packageDocumentation
 */
export {
  collectFertilizerPlanInput,
  computeFertilizerPlanData,
  getCalendarYearTimeframe,
  getFertilizerPlanInputHash,
} from "./fertilizer-plan/data"
export type { ComputeFertilizerPlanOptions, FertilizerPlanInput } from "./fertilizer-plan/data"
export {
  createFertilizerPlanStatusChecker,
  establishFertilizerPlan,
  removeFertilizerPlanWithFile,
  renderFertilizerPlanPdf,
} from "./fertilizer-plan/index"
export type { EstablishFertilizerPlanInput, FertilizerPlanStatus } from "./fertilizer-plan/index"
export { FertilizerPlanPdf } from "./fertilizer-plan/pdf/FertilizerPlanPdf"
export type { FertilizerPlanData, ReportBranding } from "./fertilizer-plan/types"
