import type { NormFilling } from "./nl/types"
import { aggregateNormFillingsToFarmLevel, aggregateNormsToFarmLevel } from "./farm"
import {
  calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
  getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
} from "./nl/2025/filling/dierlijke-mest-gebruiksnorm"
import {
  calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm,
  getNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm,
} from "./nl/2025/filling/fosfaatgebruiksnorm"
import {
  collectNL2025InputForFertilizerApplicationFilling,
  collectNL2025InputForFertilizerApplicationFillingForFarm,
} from "./nl/2025/filling/input"
import {
  calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
  getNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
} from "./nl/2025/filling/stikstofgebruiksnorm"
import { getNL2025DierlijkeMestGebruiksNorm } from "./nl/2025/value/dierlijke-mest-gebruiksnorm"
import { getNL2025FosfaatGebruiksNorm } from "./nl/2025/value/fosfaatgebruiksnorm"
import {
  collectNL2025InputForNorms,
  collectNL2025InputForNormsForFarm,
} from "./nl/2025/value/input"
import { getNL2025StikstofGebruiksNorm } from "./nl/2025/value/stikstofgebruiksnorm"
import {
  calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
  getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
} from "./nl/2026/filling/dierlijke-mest-gebruiksnorm"
import {
  calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
  getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
} from "./nl/2026/filling/fosfaatgebruiksnorm"
import {
  collectNL2026InputForFertilizerApplicationFilling,
  collectNL2026InputForFertilizerApplicationFillingForFarm,
} from "./nl/2026/filling/input"
import {
  calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm,
  getNL2026FertilizerApplicationFillingForRenureGebruiksNorm,
} from "./nl/2026/filling/renure-gebruiksnorm"
import {
  calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
  getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
} from "./nl/2026/filling/stikstofgebruiksnorm"
import { getNL2026DierlijkeMestGebruiksNorm } from "./nl/2026/value/dierlijke-mest-gebruiksnorm"
import { getNL2026FosfaatGebruiksNorm } from "./nl/2026/value/fosfaatgebruiksnorm"
import {
  collectNL2026InputForNorms,
  collectNL2026InputForNormsForFarm,
} from "./nl/2026/value/input"
import { getNL2026RenureGebruiksNorm } from "./nl/2026/value/renure-gebruiksnorm"
import { getNL2026StikstofGebruiksNorm } from "./nl/2026/value/stikstofgebruiksnorm"

type Years = "2025" | "2026"
type Regions = "NL"

type Norms2025Functions = {
  collectInputForNorms: typeof collectNL2025InputForNorms
  collectInputForNormsForFarm: typeof collectNL2025InputForNormsForFarm
  calculateNormForNitrogen: typeof getNL2025StikstofGebruiksNorm
  calculateNormForManure: typeof getNL2025DierlijkeMestGebruiksNorm
  calculateNormForPhosphate: typeof getNL2025FosfaatGebruiksNorm
  aggregateNormsToFarmLevel: typeof aggregateNormsToFarmLevel
}
type Norms2026Functions = {
  collectInputForNorms: typeof collectNL2026InputForNorms
  collectInputForNormsForFarm: typeof collectNL2026InputForNormsForFarm
  calculateNormForNitrogen: typeof getNL2026StikstofGebruiksNorm
  calculateNormForManure: typeof getNL2026DierlijkeMestGebruiksNorm
  calculateNormForPhosphate: typeof getNL2026FosfaatGebruiksNorm
  calculateNormForRenure: typeof getNL2026RenureGebruiksNorm
  aggregateNormsToFarmLevel: typeof aggregateNormsToFarmLevel
}
// Distributive conditional type: resolves to the exact per-year shape when `Y` is a
// literal ("2026" -> Norms2026Functions), and to the union of both shapes when `Y`
// is the wider `Years` union (matching the pre-Renure inferred-union behaviour for
// call sites that pass a runtime, non-literal year).
type NormsFunctionsByYear<Y extends Years> = Y extends "2026" ? Norms2026Functions : Norms2025Functions

export function createFunctionsForNorms<Y extends Years>(
  b_region: Regions,
  year: Y,
): NormsFunctionsByYear<Y> {
  if (b_region === "NL") {
    if (year === "2025") {
      return {
        collectInputForNorms: collectNL2025InputForNorms,
        collectInputForNormsForFarm: collectNL2025InputForNormsForFarm,
        calculateNormForNitrogen: getNL2025StikstofGebruiksNorm,
        calculateNormForManure: getNL2025DierlijkeMestGebruiksNorm,
        calculateNormForPhosphate: getNL2025FosfaatGebruiksNorm,
        aggregateNormsToFarmLevel: aggregateNormsToFarmLevel,
      } as NormsFunctionsByYear<Y>
    }
    if (year === "2026") {
      return {
        collectInputForNorms: collectNL2026InputForNorms,
        collectInputForNormsForFarm: collectNL2026InputForNormsForFarm,
        calculateNormForNitrogen: getNL2026StikstofGebruiksNorm,
        calculateNormForManure: getNL2026DierlijkeMestGebruiksNorm,
        calculateNormForPhosphate: getNL2026FosfaatGebruiksNorm,
        calculateNormForRenure: getNL2026RenureGebruiksNorm,
        aggregateNormsToFarmLevel: aggregateNormsToFarmLevel,
      } as NormsFunctionsByYear<Y>
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
type FillingFunctions2026 = {
  collectInputForFertilizerApplicationFilling: typeof collectNL2026InputForFertilizerApplicationFilling
  collectInputForFertilizerApplicationFillingForFarm: typeof collectNL2026InputForFertilizerApplicationFillingForFarm
  calculateFertilizerApplicationFillingForNitrogen: typeof getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm
  calculateFertilizerApplicationFillingForManure: typeof getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm
  calculateFertilizerApplicationFillingForPhosphate: typeof getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm
  calculateFertilizerApplicationFillingForRenure: typeof getNL2026FertilizerApplicationFillingForRenureGebruiksNorm
  aggregateNormFillingsToFarmLevel: typeof aggregateNormFillingsToFarmLevel
}
type FillingFunctionsByYear<Y extends Years> = Y extends "2026"
  ? FillingFunctions2026
  : FillingFunctions2025

export function createFunctionsForFertilizerApplicationFilling<Y extends Years>(
  b_region: Regions,
  year: Y,
): FillingFunctionsByYear<Y> {
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
      } as FillingFunctionsByYear<Y>
    }
    if (year === "2026") {
      return {
        collectInputForFertilizerApplicationFilling:
          collectNL2026InputForFertilizerApplicationFilling,
        collectInputForFertilizerApplicationFillingForFarm:
          collectNL2026InputForFertilizerApplicationFillingForFarm,
        calculateFertilizerApplicationFillingForNitrogen:
          getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
        calculateFertilizerApplicationFillingForManure:
          getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
        calculateFertilizerApplicationFillingForPhosphate:
          getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
        calculateFertilizerApplicationFillingForRenure:
          getNL2026FertilizerApplicationFillingForRenureGebruiksNorm,
        aggregateNormFillingsToFarmLevel: aggregateNormFillingsToFarmLevel,
      } as FillingFunctionsByYear<Y>
    }
    throw new Error("Year not supported")
  }
  throw new Error("Region not supported")
}
export type { NormFilling }

/**
 * Creates uncached calculation functions for fertilizer application norm fillings.
 * Use this factory when evaluating proposed (not yet persisted) fertilizer plans,
 * where caching provides no benefit and direct calculation is preferred.
 * The returned functions take a single `input` argument (no `fdm` database instance).
 */
type UncachedFillingFunctions2025 = {
  collectInputForFertilizerApplicationFilling: typeof collectNL2025InputForFertilizerApplicationFilling
  calculateFertilizerApplicationFillingForNitrogen: typeof calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm
  calculateFertilizerApplicationFillingForManure: typeof calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm
  calculateFertilizerApplicationFillingForPhosphate: typeof calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm
  aggregateNormFillingsToFarmLevel: typeof aggregateNormFillingsToFarmLevel
}
type UncachedFillingFunctions2026 = {
  collectInputForFertilizerApplicationFilling: typeof collectNL2026InputForFertilizerApplicationFilling
  calculateFertilizerApplicationFillingForNitrogen: typeof calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm
  calculateFertilizerApplicationFillingForManure: typeof calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm
  calculateFertilizerApplicationFillingForPhosphate: typeof calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm
  calculateFertilizerApplicationFillingForRenure: typeof calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm
  aggregateNormFillingsToFarmLevel: typeof aggregateNormFillingsToFarmLevel
}
type UncachedFillingFunctionsByYear<Y extends Years> = Y extends "2026"
  ? UncachedFillingFunctions2026
  : UncachedFillingFunctions2025

export function createUncachedFunctionsForFertilizerApplicationFilling<Y extends Years>(
  b_region: Regions,
  year: Y,
): UncachedFillingFunctionsByYear<Y> {
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
      } as UncachedFillingFunctionsByYear<Y>
    }
    if (year === "2026") {
      return {
        collectInputForFertilizerApplicationFilling:
          collectNL2026InputForFertilizerApplicationFilling,
        calculateFertilizerApplicationFillingForNitrogen:
          calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
        calculateFertilizerApplicationFillingForManure:
          calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
        calculateFertilizerApplicationFillingForPhosphate:
          calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
        calculateFertilizerApplicationFillingForRenure:
          calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm,
        aggregateNormFillingsToFarmLevel: aggregateNormFillingsToFarmLevel,
      } as UncachedFillingFunctionsByYear<Y>
    }
    throw new Error("Year not supported")
  }
  throw new Error("Region not supported")
}
