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
} from "./nl/2026/value/input"
import { getNL2026RenureGebruiksNorm } from "./nl/2026/value/renure-gebruiksnorm"
import { getNL2026StikstofGebruiksNorm } from "./nl/2026/value/stikstofgebruiksnorm"
import { calculateNL2027FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2027/filling/dierlijke-mest-gebruiksnorm"
import { getNL2027FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2027/filling/dierlijke-mest-gebruiksnorm-cache"
import { calculateNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2027/filling/fosfaatgebruiksnorm"
import { getNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2027/filling/fosfaatgebruiksnorm-cache"
import {
  collectNL2027InputForFertilizerApplicationFilling,
  collectNL2027InputForFertilizerApplicationFillingForFarm,
} from "./nl/2027/filling/input"
import { calculateNL2027FertilizerApplicationFillingForRenureGebruiksNorm } from "./nl/2027/filling/renure-gebruiksnorm"
import { getNL2027FertilizerApplicationFillingForRenureGebruiksNorm } from "./nl/2027/filling/renure-gebruiksnorm-cache"
import {
  calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNorm,
  getNL2027FertilizerApplicationFillingForStikstofGebruiksNorm,
} from "./nl/2027/filling/stikstofgebruiksnorm-cache"
import { getNL2027DierlijkeMestGebruiksNorm } from "./nl/2027/value/dierlijke-mest-gebruiksnorm"
import { getNL2027FosfaatGebruiksNorm } from "./nl/2027/value/fosfaatgebruiksnorm"
import {
  collectNL2027InputForNorms,
  collectNL2027InputForNormsForFarm,
} from "./nl/2027/value/input"
import { getNL2027RenureGebruiksNorm } from "./nl/2027/value/renure-gebruiksnorm"
import { getNL2027StikstofGebruiksNorm } from "./nl/2027/value/stikstofgebruiksnorm"

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
type Norms2027Functions = {
  collectInputForNorms: typeof collectNL2027InputForNorms
  collectInputForNormsForFarm: typeof collectNL2027InputForNormsForFarm
  calculateNormForNitrogen: typeof getNL2027StikstofGebruiksNorm
  calculateNormForManure: typeof getNL2027DierlijkeMestGebruiksNorm
  calculateNormForPhosphate: typeof getNL2027FosfaatGebruiksNorm
  calculateNormForRenure: typeof getNL2027RenureGebruiksNorm
  aggregateNormsToFarmLevel: typeof aggregateNormsToFarmLevel
}
// The shapes are keyed by year, so a year without an entry is a type error instead of
// silently getting the shape of another year. Indexing with a literal year gives the exact
// shape of that year; indexing with the wider `NormsYear` union gives the union of all shapes
// (for call sites that pass a runtime, non-literal year).
type NormsFunctionsByYear = {
  "2025": Norms2025Functions
  "2026": Norms2026Functions
  "2027": Norms2027Functions
}

/**
 * Returns the functions to collect the input for and calculate the legal application norms
 * (gebruiksnormen) of a region and year.
 *
 * The norms of 2027 are provisional: they are a copy of the 2026 norms until the official
 * 2027 RVO tables are published.
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
      return {
        collectInputForNorms: collectNL2026InputForNorms,
        collectInputForNormsForFarm: collectNL2026InputForNormsForFarm,
        calculateNormForNitrogen: getNL2026StikstofGebruiksNorm,
        calculateNormForManure: getNL2026DierlijkeMestGebruiksNorm,
        calculateNormForPhosphate: getNL2026FosfaatGebruiksNorm,
        calculateNormForRenure: getNL2026RenureGebruiksNorm,
        aggregateNormsToFarmLevel: aggregateNormsToFarmLevel,
      } satisfies Norms2026Functions as NormsFunctionsByYear[Y]
    }
    if (year === "2027") {
      return {
        collectInputForNorms: collectNL2027InputForNorms,
        collectInputForNormsForFarm: collectNL2027InputForNormsForFarm,
        calculateNormForNitrogen: getNL2027StikstofGebruiksNorm,
        calculateNormForManure: getNL2027DierlijkeMestGebruiksNorm,
        calculateNormForPhosphate: getNL2027FosfaatGebruiksNorm,
        calculateNormForRenure: getNL2027RenureGebruiksNorm,
        aggregateNormsToFarmLevel: aggregateNormsToFarmLevel,
      } satisfies Norms2027Functions as NormsFunctionsByYear[Y]
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
type FillingFunctions2027 = {
  collectInputForFertilizerApplicationFilling: typeof collectNL2027InputForFertilizerApplicationFilling
  collectInputForFertilizerApplicationFillingForFarm: typeof collectNL2027InputForFertilizerApplicationFillingForFarm
  calculateFertilizerApplicationFillingForNitrogen: typeof getNL2027FertilizerApplicationFillingForStikstofGebruiksNorm
  calculateFertilizerApplicationFillingForManure: typeof getNL2027FertilizerApplicationFillingForDierlijkeMestGebruiksNorm
  calculateFertilizerApplicationFillingForPhosphate: typeof getNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm
  calculateFertilizerApplicationFillingForRenure: typeof getNL2027FertilizerApplicationFillingForRenureGebruiksNorm
  aggregateNormFillingsToFarmLevel: typeof aggregateNormFillingsToFarmLevel
}
type FillingFunctionsByYear = {
  "2025": FillingFunctions2025
  "2026": FillingFunctions2026
  "2027": FillingFunctions2027
}

/**
 * Returns the cached functions to collect the input for and calculate how far the fertilizer
 * applications fill the legal application norms of a region and year.
 *
 * The norms of 2027 are provisional: they are a copy of the 2026 norms until the official
 * 2027 RVO tables are published.
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
      } satisfies FillingFunctions2026 as FillingFunctionsByYear[Y]
    }
    if (year === "2027") {
      return {
        collectInputForFertilizerApplicationFilling:
          collectNL2027InputForFertilizerApplicationFilling,
        collectInputForFertilizerApplicationFillingForFarm:
          collectNL2027InputForFertilizerApplicationFillingForFarm,
        calculateFertilizerApplicationFillingForNitrogen:
          getNL2027FertilizerApplicationFillingForStikstofGebruiksNorm,
        calculateFertilizerApplicationFillingForManure:
          getNL2027FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
        calculateFertilizerApplicationFillingForPhosphate:
          getNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm,
        calculateFertilizerApplicationFillingForRenure:
          getNL2027FertilizerApplicationFillingForRenureGebruiksNorm,
        aggregateNormFillingsToFarmLevel: aggregateNormFillingsToFarmLevel,
      } satisfies FillingFunctions2027 as FillingFunctionsByYear[Y]
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
type UncachedFillingFunctions2026 = {
  collectInputForFertilizerApplicationFilling: typeof collectNL2026InputForFertilizerApplicationFilling
  calculateFertilizerApplicationFillingForNitrogen: typeof calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm
  calculateFertilizerApplicationFillingForManure: typeof calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm
  calculateFertilizerApplicationFillingForPhosphate: typeof calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm
  calculateFertilizerApplicationFillingForRenure: typeof calculateNL2026FertilizerApplicationFillingForRenureGebruiksNorm
  aggregateNormFillingsToFarmLevel: typeof aggregateNormFillingsToFarmLevel
}
type UncachedFillingFunctions2027 = {
  collectInputForFertilizerApplicationFilling: typeof collectNL2027InputForFertilizerApplicationFilling
  calculateFertilizerApplicationFillingForNitrogen: typeof calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNorm
  calculateFertilizerApplicationFillingForManure: typeof calculateNL2027FertilizerApplicationFillingForDierlijkeMestGebruiksNorm
  calculateFertilizerApplicationFillingForPhosphate: typeof calculateNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm
  calculateFertilizerApplicationFillingForRenure: typeof calculateNL2027FertilizerApplicationFillingForRenureGebruiksNorm
  aggregateNormFillingsToFarmLevel: typeof aggregateNormFillingsToFarmLevel
}
type UncachedFillingFunctionsByYear = {
  "2025": UncachedFillingFunctions2025
  "2026": UncachedFillingFunctions2026
  "2027": UncachedFillingFunctions2027
}

/**
 * Creates uncached calculation functions for fertilizer application norm fillings.
 * Use this factory when evaluating proposed (not yet persisted) fertilizer plans,
 * where caching provides no benefit and direct calculation is preferred.
 * The returned functions take a single `input` argument (no `fdm` database instance).
 *
 * The norms of 2027 are provisional: they are a copy of the 2026 norms until the official
 * 2027 RVO tables are published.
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
      } satisfies UncachedFillingFunctions2026 as UncachedFillingFunctionsByYear[Y]
    }
    if (year === "2027") {
      return {
        collectInputForFertilizerApplicationFilling:
          collectNL2027InputForFertilizerApplicationFilling,
        calculateFertilizerApplicationFillingForNitrogen:
          calculateNL2027FertilizerApplicationFillingForStikstofGebruiksNorm,
        calculateFertilizerApplicationFillingForManure:
          calculateNL2027FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
        calculateFertilizerApplicationFillingForPhosphate:
          calculateNL2027FertilizerApplicationFillingForFosfaatGebruiksNorm,
        calculateFertilizerApplicationFillingForRenure:
          calculateNL2027FertilizerApplicationFillingForRenureGebruiksNorm,
        aggregateNormFillingsToFarmLevel: aggregateNormFillingsToFarmLevel,
      } satisfies UncachedFillingFunctions2027 as UncachedFillingFunctionsByYear[Y]
    }
    throw new Error("Year not supported")
  }
  throw new Error("Region not supported")
}
