import { describe, expect, it } from "vitest"
import {
    aggregateNormFillingsToFarmLevel,
    aggregateNormsToFarmLevel,
} from "./farm"
import {
    createFunctionsForFertilizerApplicationFilling,
    createFunctionsForNorms,
    createUncachedFunctionsForFertilizerApplicationFilling,
} from "./index"
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

describe("createFunctionsForNorms", () => {
    it("should return the correct functions for NL region and year 2025", () => {
        const functions = createFunctionsForNorms("NL", "2025")
        expect(functions.collectInputForNorms).toBe(collectNL2025InputForNorms)
        expect(functions.calculateNormForNitrogen).toBe(
            getNL2025StikstofGebruiksNorm,
        )
        expect(functions.calculateNormForManure).toBe(
            getNL2025DierlijkeMestGebruiksNorm,
        )
        expect(functions.calculateNormForPhosphate).toBe(
            getNL2025FosfaatGebruiksNorm,
        )
        expect(functions.aggregateNormsToFarmLevel).toBe(
            aggregateNormsToFarmLevel,
        )
    })

    it("should return the correct functions for NL region and year 2026", () => {
        const functions = createFunctionsForNorms("NL", "2026")
        expect(functions.collectInputForNorms).toBe(collectNL2026InputForNorms)
        expect(functions.calculateNormForNitrogen).toBe(
            getNL2026StikstofGebruiksNorm,
        )
        expect(functions.calculateNormForManure).toBe(
            getNL2026DierlijkeMestGebruiksNorm,
        )
        expect(functions.calculateNormForPhosphate).toBe(
            getNL2026FosfaatGebruiksNorm,
        )
        expect(functions.aggregateNormsToFarmLevel).toBe(
            aggregateNormsToFarmLevel,
        )
    })

    it("should throw an error for an unsupported year", () => {
        //@ts-expect-error
        expect(() => createFunctionsForNorms("NL", "2024")).toThrow(
            "Year not supported",
        )
    })

    it("should throw an error for an unsupported region", () => {
        //@ts-expect-error
        expect(() => createFunctionsForNorms("BE", "2025")).toThrow(
            "Region not supported",
        )
    })
})

describe("createFunctionsForFertilizerApplicationFilling", () => {
    it("should return the correct functions for NL region and year 2025", () => {
        const functions = createFunctionsForFertilizerApplicationFilling(
            "NL",
            "2025",
        )
        expect(functions.collectInputForFertilizerApplicationFilling).toBe(
            collectNL2025InputForFertilizerApplicationFilling,
        )
        expect(functions.calculateFertilizerApplicationFillingForNitrogen).toBe(
            getNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
        )
        expect(functions.calculateFertilizerApplicationFillingForManure).toBe(
            getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
        )
        expect(
            functions.calculateFertilizerApplicationFillingForPhosphate,
        ).toBe(getNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm)
        expect(functions.aggregateNormFillingsToFarmLevel).toBe(
            aggregateNormFillingsToFarmLevel,
        )
    })

    it("should return the correct functions for NL region and year 2026", () => {
        const functions = createFunctionsForFertilizerApplicationFilling(
            "NL",
            "2026",
        )
        expect(functions.collectInputForFertilizerApplicationFilling).toBe(
            collectNL2026InputForFertilizerApplicationFilling,
        )
        expect(functions.calculateFertilizerApplicationFillingForNitrogen).toBe(
            getNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
        )
        expect(functions.calculateFertilizerApplicationFillingForManure).toBe(
            getNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
        )
        expect(
            functions.calculateFertilizerApplicationFillingForPhosphate,
        ).toBe(getNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm)
        expect(functions.aggregateNormFillingsToFarmLevel).toBe(
            aggregateNormFillingsToFarmLevel,
        )
    })

    it("should throw an error for an unsupported year", () => {
        expect(() =>
            //@ts-expect-error
            createFunctionsForFertilizerApplicationFilling("NL", "2024"),
        ).toThrow("Year not supported")
    })

    it("should throw an error for an unsupported region", () => {
        expect(() =>
            //@ts-expect-error
            createFunctionsForFertilizerApplicationFilling("BE", "2025"),
        ).toThrow("Region not supported")
    })
})

describe("createUncachedFunctionsForFertilizerApplicationFilling", () => {
    it("should return the correct uncached functions for NL region and year 2025", () => {
        const functions = createUncachedFunctionsForFertilizerApplicationFilling(
            "NL",
            "2025",
        )
        expect(functions.collectInputForFertilizerApplicationFilling).toBe(
            collectNL2025InputForFertilizerApplicationFilling,
        )
        expect(functions.calculateFertilizerApplicationFillingForNitrogen).toBe(
            calculateNL2025FertilizerApplicationFillingForStikstofGebruiksNorm,
        )
        expect(functions.calculateFertilizerApplicationFillingForManure).toBe(
            calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
        )
        expect(
            functions.calculateFertilizerApplicationFillingForPhosphate,
        ).toBe(calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm)
        expect(functions.aggregateNormFillingsToFarmLevel).toBe(
            aggregateNormFillingsToFarmLevel,
        )
    })

    it("should return the correct uncached functions for NL region and year 2026", () => {
        const functions = createUncachedFunctionsForFertilizerApplicationFilling(
            "NL",
            "2026",
        )
        expect(functions.collectInputForFertilizerApplicationFilling).toBe(
            collectNL2026InputForFertilizerApplicationFilling,
        )
        expect(functions.calculateFertilizerApplicationFillingForNitrogen).toBe(
            calculateNL2026FertilizerApplicationFillingForStikstofGebruiksNorm,
        )
        expect(functions.calculateFertilizerApplicationFillingForManure).toBe(
            calculateNL2026FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
        )
        expect(
            functions.calculateFertilizerApplicationFillingForPhosphate,
        ).toBe(calculateNL2026FertilizerApplicationFillingForFosfaatGebruiksNorm)
        expect(functions.aggregateNormFillingsToFarmLevel).toBe(
            aggregateNormFillingsToFarmLevel,
        )
    })

    it("should throw an error for an unsupported year", () => {
        expect(() =>
            //@ts-expect-error
            createUncachedFunctionsForFertilizerApplicationFilling("NL", "2024"),
        ).toThrow("Year not supported")
    })

    it("should throw an error for an unsupported region", () => {
        expect(() =>
            //@ts-expect-error
            createUncachedFunctionsForFertilizerApplicationFilling("BE", "2025"),
        ).toThrow("Region not supported")
    })
})
