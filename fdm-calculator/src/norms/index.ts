import type { FdmType, PrincipalId } from "@nmi-agro/fdm-core"
import type { NL2026NormsFillingInput } from "./nl/2026/filling/types"
import type { NL2026NormsInput, NL2026NormsYear } from "./nl/2026/value/types"
import type { NormFilling } from "./nl/types"
import type { NormsYear } from "./years"
import { aggregateNormFillingsToFarmLevel, aggregateNormsToFarmLevel } from "./farm"
import { calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2025/filling/dierlijke-mest-gebruiksnorm"
import { getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2025/filling/dierlijke-mest-gebruiksnorm-cache"
import { calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2025/filling/fosfaatgebruiksnorm"
import { getNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2025/filling/fosfaatgebruiksnorm-cache"
import {
  collectNL2025InputForFertilizerApplicationFilling,
  collectNL2025InputForFertilizerApplicationFillingForFarm,
} from "./nl/2025/filling/input"
import {
  calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
  getNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
} from "./nl/2025/filling/stikstofgebruiksnorm-cache"
import { getNL2025DierlijkeMestGebruiksNorm } from "./nl/2025/value/dierlijke-mest-gebruiksnorm"
import { getNL2025FosfaatGebruiksNorm } from "./nl/2025/value/fosfaatgebruiksnorm"
import {
  collectNL2025InputForNorms,
  collectNL2025InputForNormsForFarm,
} from "./nl/2025/value/input"
import { getNL2025StikstofGebruiksNorm } from "./nl/2025/value/stikstofgebruiksnorm"
import { calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2026/filling/dierlijke-mest-gebruiksnorm"
import { getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2026/filling/dierlijke-mest-gebruiksnorm-cache"
import { calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2026/filling/fosfaatgebruiksnorm"
import { getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2026/filling/fosfaatgebruiksnorm-cache"
import {
  collectNL2026InputForFertilizerApplicationFilling,
  collectNL2026InputForFertilizerApplicationFillingForFarm,
} from "./nl/2026/filling/input"
import { calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm } from "./nl/2026/filling/renure-gebruiksnorm"
import { getNL2026FertilizerApplicationFillingForRenureGebruiksNorm } from "./nl/2026/filling/renure-gebruiksnorm-cache"
import {
  calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
  getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
} from "./nl/2026/filling/stikstofgebruiksnorm-cache"
import { getNL2026DierlijkeMestGebruiksNorm } from "./nl/2026/value/dierlijke-mest-gebruiksnorm"
import { getNL2026FosfaatGebruiksNorm } from "./nl/2026/value/fosfaatgebruiksnorm"
import {
  collectNL2026InputForNorms,
  collectNL2026InputForNormsForFarm,
  type NL2026FarmFdmCoreOperations,
  type NL2026SingleFdmCoreOperations,
} from "./nl/2026/value/input"
import { getNL2026RenureGebruiksNorm } from "./nl/2026/value/renure-gebruiksnorm"
import { getNL2026StikstofGebruiksNorm } from "./nl/2026/value/stikstofgebruiksnorm"

// A norm year uses the functions of the earliest year whose rules it shares, until a regulation
// or RVO table changes them. Those functions read the norm year from their input, and the input
// collectors below are bound to it. For now:
// - 2025: the 2025 rules.
// - 2026 and 2027: the rules introduced in 2026. The 2027 norms are provisional: no regulation or
//   RVO table changes them compared with 2026 so far.

type Regions = "NL"

type Norms2025Functions = {
  collectInputForNorms: typeof collectNL2025InputForNorms
  collectInputForNormsForFarm: typeof collectNL2025InputForNormsForFarm
  calculateNormForNitrogen: typeof getNL2025StikstofGebruiksNorm
  calculateNormForManure: typeof getNL2025DierlijkeMestGebruiksNorm
  calculateNormForPhosphate: typeof getNL2025FosfaatGebruiksNorm
  aggregateNormsToFarmLevel: typeof aggregateNormsToFarmLevel
}
type NL2026NormsFunctions = {
  collectInputForNorms: (
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: string,
    operations?: NL2026SingleFdmCoreOperations,
  ) => Promise<NL2026NormsInput>
  collectInputForNormsForFarm: (
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id_farm: string,
    operations?: NL2026FarmFdmCoreOperations,
  ) => Promise<Map<string, NL2026NormsInput>>
  calculateNormForNitrogen: typeof getNL2026StikstofGebruiksNorm
  calculateNormForManure: typeof getNL2026DierlijkeMestGebruiksNorm
  calculateNormForPhosphate: typeof getNL2026FosfaatGebruiksNorm
  calculateNormForRenure: typeof getNL2026RenureGebruiksNorm
  aggregateNormsToFarmLevel: typeof aggregateNormsToFarmLevel
}
// The shapes are keyed by year, so a year without an entry is a type error instead of
// silently getting the shape of another year. Indexing with a literal year gives the exact
// shape of that year; indexing with the wider `NormsYear` union gives the union of all shapes
// (for call sites that pass a runtime, non-literal year).
type NormsFunctionsByYear = {
  "2025": Norms2025Functions
  "2026": NL2026NormsFunctions
  "2027": NL2026NormsFunctions
}

/**
 * Returns the norm functions of the rules introduced in 2026, with the input collectors bound
 * to a norm year that uses those rules.
 *
 * @param year - The norm year.
 * @returns The norm functions of that year.
 */
function createNL2026NormsFunctions(year: NL2026NormsYear): NL2026NormsFunctions {
  return {
    collectInputForNorms: (fdm, principal_id, b_id, operations) =>
      collectNL2026InputForNorms(fdm, principal_id, b_id, year, operations),
    collectInputForNormsForFarm: (fdm, principal_id, b_id_farm, operations) =>
      collectNL2026InputForNormsForFarm(fdm, principal_id, b_id_farm, year, operations),
    calculateNormForNitrogen: getNL2026StikstofGebruiksNorm,
    calculateNormForManure: getNL2026DierlijkeMestGebruiksNorm,
    calculateNormForPhosphate: getNL2026FosfaatGebruiksNorm,
    calculateNormForRenure: getNL2026RenureGebruiksNorm,
    aggregateNormsToFarmLevel: aggregateNormsToFarmLevel,
  }
}

/**
 * Returns the functions to collect the input for and calculate the legal application norms
 * (gebruiksnormen) of a region and year.
 *
 * The norms of 2027 are provisional: they use the 2026 rules until the official 2027 RVO tables
 * are published.
 *
 * @param b_region - The region of the norms.
 * @param year - The year of the norms.
 * @returns The norm functions of that region and year. From 2026 on, they include the Renure norm.
 * @throws When the region or year is not supported.
 */
export function createFunctionsForNorms<Y extends NormsYear>(
  b_region: Regions,
  year: Y,
): NormsFunctionsByYear[Y] {
  if (b_region === "NL") {
    if (year === "2025") {
      return {
        collectInputForNorms: collectNL2025InputForNorms,
        collectInputForNormsForFarm: collectNL2025InputForNormsForFarm,
        calculateNormForNitrogen: getNL2025StikstofGebruiksNorm,
        calculateNormForManure: getNL2025DierlijkeMestGebruiksNorm,
        calculateNormForPhosphate: getNL2025FosfaatGebruiksNorm,
        aggregateNormsToFarmLevel: aggregateNormsToFarmLevel,
      } satisfies Norms2025Functions as NormsFunctionsByYear[Y]
    }
    if (year === "2026") {
      return createNL2026NormsFunctions(2026) as NormsFunctionsByYear[Y]
    }
    if (year === "2027") {
      return createNL2026NormsFunctions(2027) as NormsFunctionsByYear[Y]
    }
    throw new Error("Year not supported")
  }
  throw new Error("Region not supported")
}

type FillingFunctions2025 = {
  collectInputForFertilizerApplicationFilling: typeof collectNL2025InputForFertilizerApplicationFilling
  collectInputForFertilizerApplicationFillingForFarm: typeof collectNL2025InputForFertilizerApplicationFillingForFarm
  calculateFertilizerApplicationFillingForNitrogen: typeof getNL2025FertilizerApplicationFillingForStikstofGebruiksNorm
  calculateFertilizerApplicationFillingForManure: typeof getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm
  calculateFertilizerApplicationFillingForPhosphate: typeof getNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm
  aggregateNormFillingsToFarmLevel: typeof aggregateNormFillingsToFarmLevel
}
type CollectNL2026FillingInput = (
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: string,
  fosfaatgebruiksnorm: number,
) => Promise<NL2026NormsFillingInput>
type CollectNL2026FillingInputForFarm = (
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  fosfaatgebruiksnormByField: Map<string, number>,
) => Promise<Map<string, NL2026NormsFillingInput>>
type NL2026FillingFunctions = {
  collectInputForFertilizerApplicationFilling: CollectNL2026FillingInput
  collectInputForFertilizerApplicationFillingForFarm: CollectNL2026FillingInputForFarm
  calculateFertilizerApplicationFillingForNitrogen: typeof getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm
  calculateFertilizerApplicationFillingForManure: typeof getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm
  calculateFertilizerApplicationFillingForPhosphate: typeof getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm
  calculateFertilizerApplicationFillingForRenure: typeof getNL2026FertilizerApplicationFillingForRenureGebruiksNorm
  aggregateNormFillingsToFarmLevel: typeof aggregateNormFillingsToFarmLevel
}
type FillingFunctionsByYear = {
  "2025": FillingFunctions2025
  "2026": NL2026FillingFunctions
  "2027": NL2026FillingFunctions
}

/**
 * Returns the cached filling functions of the rules introduced in 2026, with the input
 * collectors bound to a norm year that uses those rules.
 *
 * @param year - The norm year.
 * @returns The filling functions of that year.
 */
function createNL2026FillingFunctions(year: NL2026NormsYear): NL2026FillingFunctions {
  return {
    collectInputForFertilizerApplicationFilling: (fdm, principal_id, b_id, fosfaatgebruiksnorm) =>
      collectNL2026InputForFertilizerApplicationFilling(
        fdm,
        principal_id,
        b_id,
        fosfaatgebruiksnorm,
        year,
      ),
    collectInputForFertilizerApplicationFillingForFarm: (
      fdm,
      principal_id,
      b_id_farm,
      fosfaatgebruiksnormByField,
    ) =>
      collectNL2026InputForFertilizerApplicationFillingForFarm(
        fdm,
        principal_id,
        b_id_farm,
        fosfaatgebruiksnormByField,
        year,
      ),
    calculateFertilizerApplicationFillingForNitrogen:
      getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
    calculateFertilizerApplicationFillingForManure:
      getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
    calculateFertilizerApplicationFillingForPhosphate:
      getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
    calculateFertilizerApplicationFillingForRenure:
      getNL2026FertilizerApplicationFillingForRenureGebruiksNorm,
    aggregateNormFillingsToFarmLevel: aggregateNormFillingsToFarmLevel,
  }
}

/**
 * Returns the cached functions to collect the input for and calculate how far the fertilizer
 * applications fill the legal application norms of a region and year.
 *
 * The norms of 2027 are provisional: they use the 2026 rules until the official 2027 RVO tables
 * are published.
 *
 * @param b_region - The region of the norms.
 * @param year - The year of the norms.
 * @returns The filling functions of that region and year. From 2026 on, they include the Renure norm.
 * @throws When the region or year is not supported.
 */
export function createFunctionsForFertilizerApplicationFilling<Y extends NormsYear>(
  b_region: Regions,
  year: Y,
): FillingFunctionsByYear[Y] {
  if (b_region === "NL") {
    if (year === "2025") {
      return {
        collectInputForFertilizerApplicationFilling:
          collectNL2025InputForFertilizerApplicationFilling,
        collectInputForFertilizerApplicationFillingForFarm:
          collectNL2025InputForFertilizerApplicationFillingForFarm,
        calculateFertilizerApplicationFillingForNitrogen:
          getNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
        calculateFertilizerApplicationFillingForManure:
          getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
        calculateFertilizerApplicationFillingForPhosphate:
          getNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm,
        aggregateNormFillingsToFarmLevel: aggregateNormFillingsToFarmLevel,
      } satisfies FillingFunctions2025 as FillingFunctionsByYear[Y]
    }
    if (year === "2026") {
      return createNL2026FillingFunctions(2026) as FillingFunctionsByYear[Y]
    }
    if (year === "2027") {
      return createNL2026FillingFunctions(2027) as FillingFunctionsByYear[Y]
    }
    throw new Error("Year not supported")
  }
  throw new Error("Region not supported")
}
export type { NormFilling }
export type { NormsYear }

type UncachedFillingFunctions2025 = {
  collectInputForFertilizerApplicationFilling: typeof collectNL2025InputForFertilizerApplicationFilling
  calculateFertilizerApplicationFillingForNitrogen: typeof calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm
  calculateFertilizerApplicationFillingForManure: typeof calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm
  calculateFertilizerApplicationFillingForPhosphate: typeof calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm
  aggregateNormFillingsToFarmLevel: typeof aggregateNormFillingsToFarmLevel
}
type NL2026UncachedFillingFunctions = {
  collectInputForFertilizerApplicationFilling: CollectNL2026FillingInput
  calculateFertilizerApplicationFillingForNitrogen: typeof calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm
  calculateFertilizerApplicationFillingForManure: typeof calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm
  calculateFertilizerApplicationFillingForPhosphate: typeof calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm
  calculateFertilizerApplicationFillingForRenure: typeof calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm
  aggregateNormFillingsToFarmLevel: typeof aggregateNormFillingsToFarmLevel
}
type UncachedFillingFunctionsByYear = {
  "2025": UncachedFillingFunctions2025
  "2026": NL2026UncachedFillingFunctions
  "2027": NL2026UncachedFillingFunctions
}

/**
 * Returns the uncached filling functions of the rules introduced in 2026, with the input
 * collector bound to a norm year that uses those rules.
 *
 * @param year - The norm year.
 * @returns The uncached filling functions of that year.
 */
function createNL2026UncachedFillingFunctions(
  year: NL2026NormsYear,
): NL2026UncachedFillingFunctions {
  return {
    collectInputForFertilizerApplicationFilling:
      createNL2026FillingFunctions(year).collectInputForFertilizerApplicationFilling,
    calculateFertilizerApplicationFillingForNitrogen:
      calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
    calculateFertilizerApplicationFillingForManure:
      calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
    calculateFertilizerApplicationFillingForPhosphate:
      calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
    calculateFertilizerApplicationFillingForRenure:
      calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm,
    aggregateNormFillingsToFarmLevel: aggregateNormFillingsToFarmLevel,
  }
}

/**
 * Creates uncached calculation functions for fertilizer application norm fillings.
 * Use this factory when evaluating proposed (not yet persisted) fertilizer plans,
 * where caching provides no benefit and direct calculation is preferred.
 * The returned functions take a single `input` argument (no `fdm` database instance).
 *
 * The norms of 2027 are provisional: they use the 2026 rules until the official 2027 RVO tables
 * are published.
 *
 * @param b_region - The region of the norms.
 * @param year - The year of the norms.
 * @returns The uncached filling functions of that region and year. From 2026 on, they include
 *   the Renure norm.
 * @throws When the region or year is not supported.
 */
export function createUncachedFunctionsForFertilizerApplicationFilling<Y extends NormsYear>(
  b_region: Regions,
  year: Y,
): UncachedFillingFunctionsByYear[Y] {
  if (b_region === "NL") {
    if (year === "2025") {
      return {
        collectInputForFertilizerApplicationFilling:
          collectNL2025InputForFertilizerApplicationFilling,
        calculateFertilizerApplicationFillingForNitrogen:
          calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
        calculateFertilizerApplicationFillingForManure:
          calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
        calculateFertilizerApplicationFillingForPhosphate:
          calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm,
        aggregateNormFillingsToFarmLevel: aggregateNormFillingsToFarmLevel,
      } satisfies UncachedFillingFunctions2025 as UncachedFillingFunctionsByYear[Y]
    }
    if (year === "2026") {
      return createNL2026UncachedFillingFunctions(2026) as UncachedFillingFunctionsByYear[Y]
    }
    if (year === "2027") {
      return createNL2026UncachedFillingFunctions(2027) as UncachedFillingFunctionsByYear[Y]
    }
    throw new Error("Year not supported")
  }
  throw new Error("Region not supported")
}
