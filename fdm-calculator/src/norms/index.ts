import {
    aggregateNormFillingsToFarmLevel,
    aggregateNormsToFarmLevel,
} from "./farm"
import { getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2025/filling/dierlijke-mest-gebruiksnorm"
import { getNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2025/filling/fosfaatgebruiksnorm"
import {
    collectNL2025InputForFertilizerApplicationFilling,
    collectNL2025InputForFertilizerApplicationFillingForFarm,
} from "./nl/2025/filling/input"
import { getNL2025FertilizerApplicationFillingForStikstofGebruiksNorm } from "./nl/2025/filling/stikstofgebruiksnorm"
import { getNL2025DierlijkeMestGebruiksNorm } from "./nl/2025/value/dierlijke-mest-gebruiksnorm"
import { getNL2025FosfaatGebruiksNorm } from "./nl/2025/value/fosfaatgebruiksnorm"
import {
    collectNL2025InputForNorms,
    collectNL2025InputForNormsForFarm,
} from "./nl/2025/value/input"
import { getNL2025StikstofGebruiksNorm } from "./nl/2025/value/stikstofgebruiksnorm"
import { getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm } from "./nl/2026/filling/dierlijke-mest-gebruiksnorm"
import { getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm } from "./nl/2026/filling/fosfaatgebruiksnorm"
import {
    collectNL2026InputForFertilizerApplicationFilling,
    collectNL2026InputForFertilizerApplicationFillingForFarm,
} from "./nl/2026/filling/input"
import { getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm } from "./nl/2026/filling/stikstofgebruiksnorm"
import { getNL2026DierlijkeMestGebruiksNorm } from "./nl/2026/value/dierlijke-mest-gebruiksnorm"
import { getNL2026FosfaatGebruiksNorm } from "./nl/2026/value/fosfaatgebruiksnorm"
import {
    collectNL2026InputForNorms,
    collectNL2026InputForNormsForFarm,
} from "./nl/2026/value/input"
import { getNL2026StikstofGebruiksNorm } from "./nl/2026/value/stikstofgebruiksnorm"
import type { NormFilling } from "./nl/types"

type Years = "2025" | "2026"
type Regions = "NL"

export function createFunctionsForNorms(b_region: Regions, year: Years) {
    if (b_region === "NL") {
        if (year === "2025") {
            return {
                collectInputForNorms: collectNL2025InputForNorms,
                collectInputForNormsForFarm: collectNL2025InputForNormsForFarm,
                calculateNormForNitrogen: getNL2025StikstofGebruiksNorm,
                calculateNormForManure: getNL2025DierlijkeMestGebruiksNorm,
                calculateNormForPhosphate: getNL2025FosfaatGebruiksNorm,
                aggregateNormsToFarmLevel: aggregateNormsToFarmLevel,
            }
        }
        if (year === "2026") {
            return {
                collectInputForNorms: collectNL2026InputForNorms,
                collectInputForNormsForFarm: collectNL2026InputForNormsForFarm,
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
                collectInputForFertilizerApplicationFillingForFarm:
                    collectNL2025InputForFertilizerApplicationFillingForFarm,
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
                collectInputForFertilizerApplicationFillingForFarm:
                    collectNL2026InputForFertilizerApplicationFillingForFarm,
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
