import {
    aggregateNormFillingsToFarmLevel,
    aggregateNormsToFarmLevel,
} from "./farm"
import {
    calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
    getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
} from "./nl/2025/filling/dierlijke-mest-gebruiksnorm"
import {
    calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm,
    getNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm,
} from "./nl/2025/filling/fosfaatgebruiksnorm"
import { collectNL2025InputForFertilizerApplicationFilling } from "./nl/2025/filling/input"
import {
    calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
    getNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
} from "./nl/2025/filling/stikstofgebruiksnorm"
import { getNL2025DierlijkeMestGebruiksNorm } from "./nl/2025/value/dierlijke-mest-gebruiksnorm"
import { getNL2025FosfaatGebruiksNorm } from "./nl/2025/value/fosfaatgebruiksnorm"
import { collectNL2025InputForNorms } from "./nl/2025/value/input"
import { getNL2025StikstofGebruiksNorm } from "./nl/2025/value/stikstofgebruiksnorm"
import {
    calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
    getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
} from "./nl/2026/filling/dierlijke-mest-gebruiksnorm"
import {
    calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
    getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
} from "./nl/2026/filling/fosfaatgebruiksnorm"
import { collectNL2026InputForFertilizerApplicationFilling } from "./nl/2026/filling/input"
import {
    calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
    getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
} from "./nl/2026/filling/stikstofgebruiksnorm"
import { getNL2026DierlijkeMestGebruiksNorm } from "./nl/2026/value/dierlijke-mest-gebruiksnorm"
import { getNL2026FosfaatGebruiksNorm } from "./nl/2026/value/fosfaatgebruiksnorm"
import { collectNL2026InputForNorms } from "./nl/2026/value/input"
import { getNL2026StikstofGebruiksNorm } from "./nl/2026/value/stikstofgebruiksnorm"
import type { NormFilling } from "./nl/types"

type Years = "2025" | "2026"
type Regions = "NL"

export function createFunctionsForNorms(b_region: Regions, year: Years) {
    if (b_region === "NL") {
        if (year === "2025") {
            return {
                collectInputForNorms: collectNL2025InputForNorms,
                calculateNormForNitrogen: getNL2025StikstofGebruiksNorm,
                calculateNormForManure: getNL2025DierlijkeMestGebruiksNorm,
                calculateNormForPhosphate: getNL2025FosfaatGebruiksNorm,
                aggregateNormsToFarmLevel: aggregateNormsToFarmLevel,
            }
        }
        if (year === "2026") {
            return {
                collectInputForNorms: collectNL2026InputForNorms,
                calculateNormForNitrogen: getNL2026StikstofGebruiksNorm,
                calculateNormForManure: getNL2026DierlijkeMestGebruiksNorm,
                calculateNormForPhosphate: getNL2026FosfaatGebruiksNorm,
                aggregateNormsToFarmLevel: aggregateNormsToFarmLevel,
            }
        }
        throw new Error("Year not supported")
    }
    throw new Error("Region not supported")
}

export function createFunctionsForFertilizerApplicationFilling(
    b_region: Regions,
    year: Years,
) {
    if (b_region === "NL") {
        if (year === "2025") {
            return {
                collectInputForFertilizerApplicationFilling:
                    collectNL2025InputForFertilizerApplicationFilling,
                calculateFertilizerApplicationFillingForNitrogen:
                    getNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
                calculateFertilizerApplicationFillingForManure:
                    getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
                calculateFertilizerApplicationFillingForPhosphate:
                    getNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm,
                aggregateNormFillingsToFarmLevel:
                    aggregateNormFillingsToFarmLevel,
            }
        }
        if (year === "2026") {
            return {
                collectInputForFertilizerApplicationFilling:
                    collectNL2026InputForFertilizerApplicationFilling,
                calculateFertilizerApplicationFillingForNitrogen:
                    getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
                calculateFertilizerApplicationFillingForManure:
                    getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
                calculateFertilizerApplicationFillingForPhosphate:
                    getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm,
                aggregateNormFillingsToFarmLevel:
                    aggregateNormFillingsToFarmLevel,
            }
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
export function createUncachedFunctionsForFertilizerApplicationFilling(
    b_region: Regions,
    year: Years,
) {
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
                aggregateNormFillingsToFarmLevel:
                    aggregateNormFillingsToFarmLevel,
            }
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
                aggregateNormFillingsToFarmLevel:
                    aggregateNormFillingsToFarmLevel,
            }
        }
        throw new Error("Year not supported")
    }
    throw new Error("Region not supported")
}
