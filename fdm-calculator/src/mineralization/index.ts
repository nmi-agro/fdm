/**
 * @packageDocumentation
 * @module mineralization
 *
 * Nitrogen mineralization calculations for the FDM platform.
 *
 * This module provides two NMI API integrations:
 *
 * ## N-Supply (static mineralization curve)
 * Computes a daily cumulative nitrogen mineralization curve for a field using
 * one of three soil models (MINIP, PMN, CENTURY).
 *
 * ```typescript
 * import { getNSupply, buildNSupplyRequest, assessDataCompleteness } from "@nmi-agro/fdm-calculator"
 * ```
 *
 * ## DYNA (dynamic nitrogen advice)
 * Simulates daily nitrogen dynamics through the growing season, combining soil N
 * supply, crop uptake, fertilizer releases, and NO₃ leaching. Returns a fertilizer
 * dose/timing recommendation and an optional optimal harvest date.
 *
 * ```typescript
 * import { getDyna, buildDynaRequest } from "@nmi-agro/fdm-calculator"
 * ```
 *
 * ## Typical usage pattern
 * 1. Fetch field, soil, cultivation, and fertilizer data from FDM (app layer).
 * 2. Build the request body using {@link buildNSupplyRequest} or {@link buildDynaRequest}.
 * 3. Call {@link getNSupply} or {@link getDyna} with the FDM instance and input bundle.
 *    Results are automatically cached in the FDM database.
 *
 * @see {@link module:mineralisatie/nsupply}
 * @see {@link module:mineralisatie/dyna}
 * @see {@link module:mineralisatie/builders}
 * @see {@link module:mineralisatie/assessment}
 */

export { assessDataCompleteness, methodRequirements } from "./assessment"
export {
    buildDynaRequest,
    buildNSupplyRequest,
    getMainCultivation,
} from "./builders"
export { getDyna, requestDyna } from "./dyna"
export { NmiApiError } from "./errors"
export { getNSupply, requestNSupply } from "./nsupply"
export { dynaResponseDataSchema } from "./schemas"
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
} from "./types"
